<?php

namespace App\Helpers;

use Exception;

class AbsenHelper {
    /**
     * Memproses dan memvalidasi data absensi (Mandiri / Cepat) per-record item.
     * Mengembalikan array 1:1 sesuai kolom tabel app_absensi_data_absensi.
     */
    public static function resolveAbsensiRecord(
        string $mode,
        ?array $userAuth,
        array $pegawai,
        array $jadwal,
        $lat,
        $lng,
        ?string $lokasi,
        $foto,
        ?string $keteranganPegawai,
        ?string $keteranganVerifikasi,
        ?string $statusKehadiranInput = 'Hadir',
        ?string $statusVerifikasiInput = null,
        ?string $uploadDir = null
    ): array {
        $waktuSekarang = date('Y-m-d H:i:s');
        $namaFileFoto = 'NO_PHOTO_ADMIN_FAST_INPUT.jpg';

        if ($mode === 'absen_cepat') {
            // 1. Otorisasi Admin
            $userRole = strtolower($userAuth['role'] ?? '');
            if ($userRole !== 'admin' && $userRole !== 'superadmin') {
                throw new Exception("Akses ditolak. Fitur ini hanya untuk Admin.", 403);
            }

            // 1.1 Validasi Input Admin Cepat
            $keteranganVerifikasiClean = trim($keteranganVerifikasi ?? '');
            if ($keteranganVerifikasiClean === '') {
                throw new Exception("Keterangan verifikasi wajib diisi oleh Admin.", 422);
            }

            $statusKehadiran = !empty($statusKehadiranInput) ? $statusKehadiranInput : 'Hadir';
            $statusVerifikasi = !empty($statusVerifikasiInput) ? $statusVerifikasiInput : 'Terverifikasi Oleh Admin';
            $finalKeterangan = !empty(trim($keteranganPegawai ?? '')) ? trim($keteranganPegawai) : $keteranganVerifikasiClean;

            // Foto opsional
            if (!empty($foto) && $uploadDir) {
                $namaFileFoto = self::processAndSaveFoto($foto, $pegawai['nip'] ?? 'PEGAWAI', $jadwal['kode_akses'] ?? 'JADWAL', $uploadDir);
            }
        } elseif ($mode === 'absen_mandiri') {
            // 2. Otorisasi Pegawai / ASN
            if (!$userAuth || empty($userAuth['nip'])) {
                throw new Exception("Token tidak valid atau sesi berakhir.", 401);
            }

            // 2.1 Foto Wajib Ada
            if (empty($foto)) {
                throw new Exception("Foto / bukti dukung presensi wajib diisi.", 422);
            }

            $statusKehadiran = !empty($statusKehadiranInput) ? $statusKehadiranInput : 'Hadir';

            // 2.2 Opsi Kehadiran = Hadir
            if ($statusKehadiran === 'Hadir') {
                $latNum = (float)($lat ?? 0);
                $lngNum = (float)($lng ?? 0);
                $lokasiClean = trim($lokasi ?? '');

                $gpsInvalid = ($latNum == 0.0 || $lngNum == 0.0 || $lokasiClean === '' || stripos($lokasiClean, 'GPS') !== false);
                
                $jarakMeter = 0;
                if (!$gpsInvalid && !empty($jadwal['koordinat'])) {
                    $jarakMeter = self::calculateDistance($latNum, $lngNum, $jadwal['koordinat']);
                }

                $radiusMeter = (float)($jadwal['radius_meter'] ?? 0);
                $isLuarRadius = ($gpsInvalid || ($radiusMeter > 0 && $jarakMeter > $radiusMeter));

                $isTerlambat = false;
                $jamMulai = $jadwal['jam_mulai'] ?? null;
                $jamSelesai = $jadwal['jam_selesai'] ?? null;
                if ($jamMulai && $jamSelesai) {
                    $tglHariIni = date('Y-m-d');
                    $fullMulai = (strlen($jamMulai) <= 8) ? "$tglHariIni $jamMulai" : $jamMulai;
                    $fullSelesai = (strlen($jamSelesai) <= 8) ? "$tglHariIni $jamSelesai" : $jamSelesai;
                    if ($waktuSekarang < $fullMulai || $waktuSekarang > $fullSelesai) {
                        $isTerlambat = true;
                    }
                }

                $isStrictTime = !empty($jadwal['is_strict_time']);
                $isStrictLocation = !empty($jadwal['is_strict_location']);

                if ($isStrictTime && $isTerlambat) {
                    throw new Exception("Presensi ditolak. Waktu presensi di luar jadwal kegiatan.", 422);
                }
                if ($isStrictLocation && $isLuarRadius) {
                    throw new Exception("Presensi ditolak. Lokasi berada di luar radius kegiatan.", 422);
                }

                $keteranganClean = trim($keteranganPegawai ?? '');
                if ($isTerlambat || $isLuarRadius) {
                    if ($keteranganClean === '') {
                        throw new Exception("Anda terlambat atau berada di luar radius lokasi. Kolom keterangan wajib diisi.", 422);
                    }
                    $finalKeterangan = $keteranganClean;
                    $statusVerifikasi = 'Menunggu Verifikasi Admin';
                } else {
                    $finalKeterangan = '-';
                    $statusVerifikasi = 'Terverifikasi Oleh Sistem';
                }

                if ($uploadDir) {
                    $namaFileFoto = self::processAndSaveFoto($foto, $pegawai['nip'], $jadwal['kode_akses'], $uploadDir);
                }
            } else {
                // 2.3 Opsi Kehadiran != Hadir (Izin, Sakit, Cuti, dll)
                $keteranganClean = trim($keteranganPegawai ?? '');
                if ($keteranganClean === '') {
                    throw new Exception("Keterangan alasan tidak hadir wajib diisi.", 422);
                }

                $finalKeterangan = $keteranganClean;
                $statusVerifikasi = 'Menunggu Verifikasi Admin';
                $keteranganVerifikasiClean = '-';

                if ($uploadDir) {
                    $namaFileFoto = self::processAndSaveFoto($foto, $pegawai['nip'], $jadwal['kode_akses'], $uploadDir);
                }
            }
        } else {
            throw new Exception("Mode absensi tidak dikenali.", 400);
        }

        return [
            'kode_akses'            => $jadwal['kode_akses'] ?? '',
            'nip'                   => $pegawai['nip'] ?? '',
            'nama_pegawai'          => $pegawai['nama_pegawai'] ?? '',
            'opd'                   => $pegawai['opd'] ?? ($pegawai['perangkat_daerah'] ?? ''),
            'jabatan'               => $pegawai['jabatan'] ?? '',
            'kategori'              => $jadwal['kategori'] ?? '',
            'waktu'                 => $waktuSekarang,
            'lokasi'                => !empty($lokasi) ? $lokasi : '-',
            'lat'                   => (float)($lat ?? 0),
            'lng'                   => (float)($lng ?? 0),
            'nama_file_foto'        => $namaFileFoto,
            'keterangan'            => $finalKeterangan ?? '-',
            'keterangan_verifikasi' => $keteranganVerifikasiClean ?? '-',
            'status_verifikasi'     => $statusVerifikasi,
            'status_kehadiran'      => $statusKehadiran
        ];
    }

    private static function calculateDistance(float $lat1, float $lng1, string $koordinatTarget): float {
        $parts = explode(',', $koordinatTarget);
        if (count($parts) < 2) return 0;
        $lat2 = (float)trim($parts[0]);
        $lng2 = (float)trim($parts[1]);

        $earthRadius = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLng / 2) * sin($dLng / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $earthRadius * $c;
    }

    private static function processAndSaveFoto($foto, string $nip, string $kodeAkses, string $uploadDir): string {
        if (is_string($foto) && strpos($foto, 'base64,') !== false) {
            $cleanBase64 = preg_replace('#^data:(image|application)/\w+;base64,#i', '', $foto);
            $binaryData = base64_decode($cleanBase64);
            $ext = (strpos($foto, 'application/pdf') !== false) ? 'pdf' : 'jpg';
            $timestamp = time();
            $randomStr = bin2hex(random_bytes(4));
            $fileName = "{$nip}_{$kodeAkses}_{$timestamp}_{$randomStr}.{$ext}";
            $targetDir = rtrim($uploadDir, '/\\');
            if (!is_dir($targetDir)) {
                @mkdir($targetDir, 0775, true);
            }
            @file_put_contents($targetDir . '/' . $fileName, $binaryData);
            return $fileName;
        } elseif (is_array($foto) && isset($foto['tmp_name'])) {
            $ext = (isset($foto['type']) && $foto['type'] === 'application/pdf') ? 'pdf' : 'jpg';
            $timestamp = time();
            $randomStr = bin2hex(random_bytes(4));
            $fileName = "{$nip}_{$kodeAkses}_{$timestamp}_{$randomStr}.{$ext}";
            $targetDir = rtrim($uploadDir, '/\\');
            if (!is_dir($targetDir)) {
                @mkdir($targetDir, 0775, true);
            }
            @move_uploaded_file($foto['tmp_name'], $targetDir . '/' . $fileName);
            return $fileName;
        }
        return is_string($foto) && !empty($foto) ? $foto : 'NO_PHOTO_ADMIN_FAST_INPUT.jpg';
    }
}
