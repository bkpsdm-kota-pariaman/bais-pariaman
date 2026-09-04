<?php
// src/Controllers/AbsenController.php

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\Database;
use App\Helpers\AuthHelper;
use App\Helpers\AdminAuthHelper;
use App\Helpers\LogAbsensi; // Patch log absensi
use App\Helpers\LogHelper; // Tambahkan LogHelper
use PDO;
use DateTime;
use DateTimeZone;
// Add JWT for decoding
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class AbsenController {

    private function haversineDistance($lat1, $lon1, $lat2, $lon2) {
        $earthRadius = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat/2) * sin($dLat/2) + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon/2) * sin($dLon/2);
        $c = 2 * atan2(sqrt($a), sqrt(1-$a));
        return $earthRadius * $c;
    }

    /**
     * Helper internal untuk memproses dan menyimpan 1 item data absensi.
     */
    private function processAbsenRecord($db, $config, array $payload, $fotoFile = null, $isWorker = false, $callerPegawaiData = null) {
        $secretKey = $config['jwt_secret'];
        $uploadDir = '../uploads/foto_absensi/';

        $kodeAkses = $payload['kode_akses'] ?? null;
        $lat = (isset($payload['lat']) && $payload['lat'] !== '') ? $payload['lat'] : null;
        $lng = (isset($payload['lng']) && $payload['lng'] !== '') ? $payload['lng'] : null;
        $lokasi = (isset($payload['lokasi']) && $payload['lokasi'] !== '') ? $payload['lokasi'] : null;
        $keteranganInput = $payload['keterangan'] ?? null;
        $base64Foto = $payload['foto_absensi'] ?? $payload['foto_base64'] ?? $payload['foto'] ?? null;
        $statusKehadiranInput = $payload['status_kehadiran'] ?? 'Hadir';
        $statusVerifikasiInput = $payload['status_verifikasi'] ?? 'Terverifikasi Sistem';
        $submittedAtInput = $payload['submittedAt'] ?? $payload['submitted_at'] ?? null;
        $qrTokenInput = $payload['qr_token'] ?? null;

        if (!empty($qrTokenInput)) {
            try {
                $qrDecoded = JWT::decode($qrTokenInput, new Key($secretKey, 'HS256'));
                if (isset($qrDecoded->exp) && $qrDecoded->exp < time()) {
                    throw new \Exception("Token QR Code tidak valid atau sudah kedaluwarsa.", 401);
                }
            } catch (\Exception $e) {
                throw new \Exception("Token QR Code tidak valid atau sudah kedaluwarsa.", 401);
            }
        }

        // Tentukan Waktu Resmi Presensi
        if (!empty($submittedAtInput)) {
            try {
                $now = new DateTime($submittedAtInput);
                $now->setTimezone(new DateTimeZone('Asia/Jakarta'));
            } catch (\Exception $ex) {
                $now = new DateTime('now', new DateTimeZone('Asia/Jakarta'));
            }
        } else {
            $now = new DateTime('now', new DateTimeZone('Asia/Jakarta'));
        }
        $waktu = $now->format('Y-m-d H:i:s');
        $tanggalServer = $now->format('Y-m-d');

        // Identifikasi Pegawai dari JWT / Payload
        $pegawaiData = $callerPegawaiData;
        $authSource = $callerPegawaiData ? 'direct_jwt' : 'fallback_payload';

        if (!$pegawaiData) {
            $rawToken = $payload['jwt_token'] ?? '';
            $cleanToken = preg_replace('/^(Bearer|BP:|BB:)\s*/i', '', $rawToken);
            if (!empty($cleanToken)) {
                try {
                    $decoded = JWT::decode($cleanToken, new Key($secretKey, 'HS256'));
                    $pegawaiData = (array) ($decoded->data ?? []);
                    if (!empty($pegawaiData['nip'])) {
                        $authSource = 'jwt_token';
                    }
                } catch (\Exception $jwtEx) {
                    // Fallback identitas dari payload yang disuntikkan Worker
                }
            }
        }

        $nip = $pegawaiData['nip'] ?? $payload['nip'] ?? null;
        $nama = $pegawaiData['nama'] ?? $payload['nama'] ?? null;
        $opd = $pegawaiData['opd'] ?? $payload['opd'] ?? null;
        $jabatan = $pegawaiData['jabatan'] ?? $payload['jabatan'] ?? null;

        // Role Check
        $is_admin_cepat_fallback = ($statusVerifikasiInput === 'Terverifikasi Oleh Admin');
        $userRoles = isset($pegawaiData['role']) ? (array) $pegawaiData['role'] : (isset($payload['role']) ? (array)$payload['role'] : ['asn']);
        $userRoles = array_map('strtolower', array_map('trim', $userRoles));
        $isAdminOrSuperAdmin = in_array('admin', $userRoles) || in_array('super admin', $userRoles) || $is_admin_cepat_fallback;

        // Validasi dasar
        if (empty($kodeAkses)) {
            throw new \Exception("Kode akses kegiatan wajib diisi.", 422);
        }
        if (empty($statusKehadiranInput)) {
            throw new \Exception("Status kehadiran wajib dipilih.", 422);
        }
        if (!$nip || !$nama) {
            throw new \Exception("Waktu login Anda sudah habis. Silahkan login ulang.", 401);
        }

        // Ambil detail jadwal dari DB
        $stmtJadwal = $db->prepare("SELECT judul, kategori, tanggal, jam_mulai, jam_selesai, koordinat, radius_meter, is_strict_time, is_strict_location FROM app_absensi_jadwal_kegiatan WHERE kode_akses = :kode_akses LIMIT 1");
        $stmtJadwal->execute([':kode_akses' => $kodeAkses]);
        $jadwal = $stmtJadwal->fetch(PDO::FETCH_ASSOC);

        if (!$jadwal) {
            throw new \Exception("Jadwal kegiatan tidak valid atau tidak ditemukan.", 404);
        }

        // Validasi jadwal khusus Direct (non-worker)
        if (!$isWorker) {
            if ($tanggalServer !== $jadwal['tanggal']) {
                if ($tanggalServer > $jadwal['tanggal']) {
                    throw new \Exception("Gagal: Jadwal kegiatan ini sudah berlalu.", 403);
                } else {
                    throw new \Exception("Gagal: Jadwal kegiatan ini belum dimulai.", 403);
                }
            }

            $startTime = new DateTime($jadwal['tanggal'] . ' ' . $jadwal['jam_mulai'], new DateTimeZone('Asia/Jakarta'));
            if ($now < $startTime) {
                throw new \Exception("Absensi untuk kegiatan ini belum dibuka. Silakan coba lagi pada atau setelah pukul " . substr($jadwal['jam_mulai'], 0, 5) . " WIB.", 403);
            }
        }

        // Pengecekan Keterlambatan & Radius
        $endTime = new DateTime($jadwal['tanggal'] . ' ' . $jadwal['jam_selesai'], new DateTimeZone('Asia/Jakarta'));
        $isTerlambat = ($now > $endTime);

        $isLuarRadius = false;
        if (!empty($jadwal['koordinat']) && $jadwal['koordinat'] !== '-') {
            $tParts = explode(',', str_replace("'", '', $jadwal['koordinat']));
            if (count($tParts) >= 2) {
                $tLat = (float) trim($tParts[0]);
                $tLng = (float) trim($tParts[1]);
                $pLat = (float) ($lat ?? 0);
                $pLng = (float) ($lng ?? 0);
                $radius = (float) ($jadwal['radius_meter'] ?? 0);
                if ($radius > 0) {
                    $jarak = $this->haversineDistance($pLat, $pLng, $tLat, $tLng);
                    if ($jarak > $radius) {
                        $isLuarRadius = true;
                    }
                }
            }
        }

        $is_izin = (strtolower($statusKehadiranInput) !== 'hadir');

        // Validasi Strict Time & Location khusus Direct Hadir
        if (!$isWorker && !$is_izin) {
            if ($isTerlambat && !empty($jadwal['is_strict_time']) && $jadwal['is_strict_time'] == 1) {
                throw new \Exception("Gagal: Waktu Berakhir. Anda melanggar Aturan Waktu Berlaku.", 403);
            }
            if ($isLuarRadius && !empty($jadwal['is_strict_location']) && $jadwal['is_strict_location'] == 1) {
                throw new \Exception("Gagal: Di Luar Lokasi. Anda melanggar Aturan Wajib Sesuai Lokasi.", 403);
            }
        }

        // Status Verifikasi & Keterangan
        $statusKehadiran = $statusKehadiranInput;
        $statusVerifikasi = 'Terverifikasi Sistem';
        $keteranganPegawai = null;
        $keteranganVerifikasiAdmin = null;

        $has_file_foto = ($fotoFile && isset($fotoFile['error']) && $fotoFile['error'] === UPLOAD_ERR_OK);
        $has_base64_foto = (!empty($base64Foto) && trim((string)$base64Foto) !== '');

        if ($isAdminOrSuperAdmin) {
            $statusKehadiran = $statusKehadiranInput;
            $statusVerifikasi = $statusVerifikasiInput;
            $keteranganVerifikasiAdmin = $payload['keterangan_verifikasi'] ?? $payload['keterangan_admin'] ?? 'Absensi Cepat oleh Admin';
            $keteranganPegawai = $payload['keterangan'] ?? $keteranganVerifikasiAdmin;

            if ($has_base64_foto) {
                $cleanBase64 = preg_replace('#^data:(image|application)/\w+;base64,#i', '', $base64Foto);
                if (strlen(base64_decode($cleanBase64)) > 100 * 1024) {
                    throw new \Exception("Ukuran foto terlalu besar. Maksimal 100 KB.", 422);
                }
            } elseif ($has_file_foto && $fotoFile['size'] > 100 * 1024) {
                throw new \Exception("Ukuran foto terlalu besar. Maksimal 100 KB.", 422);
            }
        } else {
            $keteranganPegawai = trim((string)$keteranganInput);

            if (!$is_izin) {
                $is_lokasi_valid = ($lat !== null && $lng !== null && (float)$lat != 0 && (float)$lng != 0 && !empty($lokasi) && stripos((string)$lokasi, 'GPS') === false);
                if (!$is_lokasi_valid) {
                    throw new \Exception("Lokasi GPS wajib diisi untuk presensi Hadir.", 422);
                }
                if (!$has_file_foto && !$has_base64_foto) {
                    throw new \Exception("Foto / bukti dukung wajib diisi.", 422);
                }

                if ($has_base64_foto) {
                    $cleanBase64 = preg_replace('#^data:(image|application)/\w+;base64,#i', '', $base64Foto);
                    if (strlen(base64_decode($cleanBase64)) > 100 * 1024) {
                        throw new \Exception("Ukuran foto terlalu besar. Maksimal 100 KB.", 422);
                    }
                } elseif ($has_file_foto && $fotoFile['size'] > 100 * 1024) {
                    throw new \Exception("Ukuran foto terlalu besar. Maksimal 100 KB.", 422);
                }

                if ($isTerlambat || $isLuarRadius) {
                    if (empty($keteranganPegawai)) {
                        throw new \Exception("Anda terlambat atau berada di luar radius lokasi. Kolom keterangan wajib diisi.", 422);
                    }
                    $statusVerifikasi = 'Menunggu Verifikasi Admin';
                } else {
                    $statusVerifikasi = 'Terverifikasi Sistem';
                }
            } else {
                if (empty($keteranganPegawai)) {
                    throw new \Exception("Keterangan alasan tidak hadir wajib diisi.", 422);
                }

                if ($has_base64_foto) {
                    $cleanBase64 = preg_replace('#^data:(image|application)/\w+;base64,#i', '', $base64Foto);
                    if (strlen(base64_decode($cleanBase64)) > 1024 * 1024) {
                        throw new \Exception("Ukuran file bukti dukung terlalu besar. Maksimal 1 MB.", 422);
                    }
                } elseif ($has_file_foto && $fotoFile['size'] > 1024 * 1024) {
                    throw new \Exception("Ukuran file bukti dukung terlalu besar. Maksimal 1 MB.", 422);
                }

                $statusVerifikasi = 'Menunggu Verifikasi Admin';
            }
        }

        // Proses simpan foto
        $newFileName = 'NO_PHOTO_ADMIN_FAST_INPUT.jpg';
        $uploadPath = null;

        if ($has_base64_foto) {
            if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
                throw new \Exception("Server error. Gagal membuat direktori upload.", 500);
            }
            $cleanBase64 = preg_replace('#^data:(image|application)/\w+;base64,#i', '', $base64Foto);
            $binaryData = base64_decode($cleanBase64);
            $timestamp = time();
            $randomStr = bin2hex(random_bytes(4));
            $ext = (strpos($base64Foto, 'application/pdf') !== false) ? 'pdf' : 'jpg';
            $newFileName = $nip . '_' . $kodeAkses . '_' . $timestamp . '_' . $randomStr . '.' . $ext;
            $uploadPath = $uploadDir . $newFileName;

            if ($binaryData === false || file_put_contents($uploadPath, $binaryData) === false) {
                throw new \Exception("Server error. Gagal menyimpan foto Base64.", 500);
            }
        } elseif ($has_file_foto) {
            if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
                throw new \Exception("Server error. Gagal membuat direktori upload.", 500);
            }
            $ext = ($fotoFile['type'] === 'application/pdf') ? 'pdf' : 'jpg';
            $timestamp = time();
            $randomStr = bin2hex(random_bytes(4));
            $newFileName = $nip . '_' . $kodeAkses . '_' . $timestamp . '_' . $randomStr . '.' . $ext;
            $uploadPath = $uploadDir . $newFileName;

            if (!move_uploaded_file($fotoFile['tmp_name'], $uploadPath)) {
                throw new \Exception("Server error. Gagal memindahkan uploaded file.", 500);
            }
        }

        // UPSERT Database
        $sql = "INSERT INTO app_absensi_data_absensi 
                    (kode_akses, nip, nama_pegawai, opd, jabatan, kategori, waktu, lokasi, lat, lng, nama_file_foto, keterangan, keterangan_verifikasi, status_verifikasi, status_kehadiran) 
                VALUES 
                    (:kode_akses, :nip, :nama_pegawai, :opd, :jabatan, :kategori, :waktu, :lokasi, :lat, :lng, :nama_file_foto, :keterangan, :keterangan_verifikasi, :status_verifikasi, :status_kehadiran)
                ON DUPLICATE KEY UPDATE
                    waktu = VALUES(waktu),
                    lokasi = VALUES(lokasi),
                    lat = VALUES(lat),
                    lng = VALUES(lng),
                    nama_file_foto = VALUES(nama_file_foto),
                    kategori = VALUES(kategori),
                    keterangan = VALUES(keterangan),
                    keterangan_verifikasi = VALUES(keterangan_verifikasi),
                    nama_pegawai = VALUES(nama_pegawai),
                    opd = VALUES(opd),
                    jabatan = VALUES(jabatan),
                    status_verifikasi = IF(status_verifikasi IN ('Terverifikasi Oleh Admin', 'Ditolak Oleh Admin'), status_verifikasi, VALUES(status_verifikasi)),
                    status_kehadiran = IF(status_verifikasi IN ('Terverifikasi Oleh Admin', 'Ditolak Oleh Admin'), status_kehadiran, VALUES(status_kehadiran))";

        $stmt = $db->prepare($sql);
        $isSuccess = $stmt->execute([
            ':kode_akses' => $kodeAkses,
            ':nip' => $nip,
            ':nama_pegawai' => $nama,
            ':opd' => $opd,
            ':jabatan' => $jabatan,
            ':kategori' => $jadwal['kategori'],
            ':waktu' => $waktu,
            ':lokasi' => $lokasi ?? '-',
            ':lat' => $lat ?? 0,
            ':lng' => $lng ?? 0,
            ':nama_file_foto' => $newFileName,
            ':keterangan' => $keteranganPegawai,
            ':keterangan_verifikasi' => $keteranganVerifikasiAdmin,
            ':status_verifikasi' => $statusVerifikasi,
            ':status_kehadiran' => $statusKehadiran
        ]);

        if (!$isSuccess) {
            if ($uploadPath && file_exists($uploadPath)) {
                unlink($uploadPath);
            }
            throw new \Exception("Eksekusi database gagal: " . ($stmt->errorInfo()[2] ?? "Unknown error"), 500);
        }

        $affectedRows = $stmt->rowCount();
        LogHelper::write('info', "Absen Processed Item: NIP $nip, Kode $kodeAkses, Auth: $authSource, Status: $statusKehadiran, RowCount: $affectedRows");

        if ($isAdminOrSuperAdmin) {
            $jenisAksi = ($affectedRows > 1) ? 'edit' : 'tambah';
            LogAbsensi::log(
                $db,
                $kodeAkses,
                $nip,
                $nama,
                $jenisAksi,
                $pegawaiData['nip'] ?? ($payload['nip'] ?? ''),
                $pegawaiData['nama'] ?? ($payload['nama'] ?? ''),
                $_SERVER['REMOTE_ADDR'] ?? '',
                [
                    'kode_akses' => $kodeAkses,
                    'nip' => $nip,
                    'nama_pegawai' => $nama,
                    'opd' => $opd,
                    'jabatan' => $jabatan,
                    'kategori' => $jadwal['kategori'],
                    'waktu' => $waktu,
                    'lokasi' => $lokasi ?? '-',
                    'lat' => $lat ?? 0,
                    'lng' => $lng ?? 0,
                    'nama_file_foto' => $newFileName,
                    'keterangan' => $keteranganPegawai,
                    'keterangan_verifikasi' => $keteranganVerifikasiAdmin,
                    'status_verifikasi' => $statusVerifikasi,
                    'status_kehadiran' => $statusKehadiran,
                    'mode' => $isWorker ? 'submit-absen-bulk' : 'submit-absen-direct',
                ]
            );
        }

        return [
            'status_verifikasi' => $statusVerifikasi,
            'waktu' => $waktu,
            'nip' => $nip,
            'affected_rows' => $affectedRows
        ];
    }

    /**
     * Menerima dan menyimpan data absensi dari PWA (Single/Direct) maupun dari Worker Queue (Bulk).
     */
    public function submit() {
        $config = require APP_PATH . '/config/config.php';
        $workerSecret = $config['worker_secret'] ?? null;
        $requestSecret = $_SERVER['HTTP_X_WORKER_SECRET'] ?? null;
        $isWorker = ($workerSecret && $requestSecret && $requestSecret === $workerSecret);

        $inputJSON = file_get_contents('php://input');
        $inputData = json_decode($inputJSON, true);

        // MODE 1: REQUEST DARI WORKER QUEUE (BULK ATAU WORKER PRODUCER)
        if ($isWorker) {
            $absensiBatch = [];
            if (is_array($inputData)) {
                if (isset($inputData[0])) {
                    $absensiBatch = $inputData;
                } else {
                    $absensiBatch = [$inputData];
                }
            }

            if (empty($absensiBatch)) {
                Response::json(false, 400, "Data batch tidak valid atau kosong.");
                return;
            }

            $db = Database::getConnection();
            $uploadDir = '../uploads/foto_absensi/';
            if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
                Response::json(false, 500, "Server Error: Gagal membuat direktori upload.");
                return;
            }

            $successCount = 0;
            $failureCount = 0;
            $errorMessages = [];

            foreach ($absensiBatch as $item) {
                try {
                    $db->beginTransaction();
                    $payload = $item['body'] ?? $item;
                    if (!$payload || !is_array($payload)) {
                        throw new \Exception("Payload kosong.");
                    }

                    $res = $this->processAbsenRecord($db, $config, $payload, null, true);
                    $db->commit();
                    $successCount++;
                } catch (\Exception $e) {
                    if ($db->inTransaction()) {
                        $db->rollBack();
                    }
                    $failureCount++;
                    $errorMessages[] = "NIP " . ($item['body']['nip'] ?? $item['nip'] ?? 'unknown') . ": " . $e->getMessage();
                    LogHelper::write('error', "Bulk Absen Error: " . $e->getMessage(), ['item' => $item]);
                }
            }

            if ($failureCount > 0) {
                $errorDetail = implode("; ", $errorMessages);
                Response::json(false, 500, "Gagal memproses bulk absensi: $failureCount data gagal ($errorDetail).", [
                    'success_count' => $successCount,
                    'failure_count' => $failureCount,
                    'errors' => $errorMessages
                ]);
                return;
            }

            Response::json(true, 200, "$successCount data berhasil diproses.", [
                'success_count' => $successCount,
                'failure_count' => 0
            ]);
            return;
        }

        // MODE 2: REQUEST DIRECT DARI PWA (SINGLE RECORD VIA BEARER JWT)
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
        $token = $authHeader ? str_replace('Bearer ', '', $authHeader) : null;
        if (!$token) {
            Response::json(false, 401, "Waktu login Anda sudah habis. Silahkan login ulang.");
            return;
        }

        $secretKey = $config['jwt_secret'];
        $pegawaiData = null;
        try {
            $decoded = JWT::decode($token, new Key($secretKey, 'HS256'));
            if (isset($decoded->exp) && $decoded->exp < time()) {
                 Response::json(false, 401, "Waktu login Anda sudah habis. Silahkan login ulang.");
                 return;
            }
            $pegawaiData = (array) $decoded->data;
        } catch (\Exception $e) {
            Response::json(false, 401, "Waktu login Anda sudah habis. Silahkan login ulang.");
            return;
        }

        $payload = is_array($inputData) ? $inputData : [];
        foreach ($_POST as $k => $v) {
            $payload[$k] = $v;
        }
        $payload['jwt_token'] = $token;

        $db = Database::getConnection();
        try {
            $db->beginTransaction();
            $result = $this->processAbsenRecord($db, $config, $payload, $_FILES['foto'] ?? null, false, $pegawaiData);
            $db->commit();

            $pesanSukses = ($result['status_verifikasi'] === 'Menunggu Verifikasi Admin') 
                ? "Absen sudah terkirim. BKPSDM Kota Pariaman akan melakukan verifikasi absen Anda." 
                : "Absen sudah terkirim.";
            Response::json(true, 200, $pesanSukses);
        } catch (\Exception $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            $code = $e->getCode();
            if (!in_array($code, [400, 401, 403, 404, 422, 500])) {
                $code = 422;
            }
            Response::json(false, $code, $e->getMessage());
        }
    }

    /**
     * Menerima dan memproses absensi cepat dari Admin (Single/Direct).
     */
    public function submitCepat() {
        AdminAuthHelper::validate();
        $this->submit();
    }

    /**
     * Menerima dan menyimpan BATCH data absensi dari Cloudflare Worker.
     */
    public function submitBulk() {
        $this->submit();
    }

    // --- REKAP & AUDIT LOG METHODS (Merged from AdminRekapController & LogAbsensiController) ---

    // This function is now simplified to only get the initial page data
    public function getRekap($vars) {
        AdminAuthHelper::validate();
        $kodeAkses = $vars['kode_akses'] ?? null;
        $db = Database::getConnection();

        // 1. Dapatkan Detail Jadwal
        $stmtJadwal = $db->prepare("SELECT * FROM app_absensi_jadwal_kegiatan WHERE kode_akses = :ka");
        $stmtJadwal->execute([':ka' => $kodeAkses]);
        $jadwal = $stmtJadwal->fetch(PDO::FETCH_ASSOC);
        if (!$jadwal) {
            Response::json(false, 404, "Jadwal kegiatan tidak ditemukan.");
        }

        // 2. Dapatkan Daftar OPD Target (sekarang langsung dari data absensi)
        $stmtOpdFilter = $db->prepare("SELECT DISTINCT opd FROM app_absensi_data_absensi WHERE kode_akses = :ka AND opd IS NOT NULL ORDER BY opd");
        $stmtOpdFilter->execute([':ka' => $kodeAkses]);
        $opdForFilter = $stmtOpdFilter->fetchAll(PDO::FETCH_COLUMN, 0);
        $jadwal['target_opd'] = $opdForFilter;
        $responsePayload = [
            'jadwal' => $jadwal,
            'opd_for_filter' => $opdForFilter
        ];

        Response::json(true, 200, "Data dasar rekap berhasil diambil", $responsePayload);
    }

    // New function for summary
    public function getRekapSummary($vars) {
        AdminAuthHelper::validate();
        $kodeAkses = $vars['kode_akses'] ?? null;
        $db = Database::getConnection();

        // 1. Query agregasi data absensi per OPD
        $sql = "
            SELECT 
                opd as opd_name,
                COALESCE(status_kehadiran, 'Belum Absen') as status,
                status_verifikasi,
                COUNT(*) as count
            FROM app_absensi_data_absensi 
            WHERE kode_akses = ? AND opd IS NOT NULL AND opd != ''
            GROUP BY opd, status_kehadiran, status_verifikasi
        ";
        $stmt = $db->prepare($sql);
        $stmt->execute([$kodeAkses]);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Jika tidak ada data sama sekali, kembalikan data kosong
        if (empty($results)) {
            $responsePayload = [
                'summary' => [
                    'total_target' => 0, 
                    'statuses' => [],
                    'menunggu_verifikasi' => 0
                ],
                'per_opd_summary' => [],
            ];
            Response::json(true, 200, "Ringkasan rekap berhasil diambil", $responsePayload);
            return;
        }

        $opdData = [];
        $totalTarget = 0;
        $totalStatuses = [];
        $totalMenungguVerifikasi = 0;

        foreach ($results as $row) {
            $opd = $row['opd_name'];
            $status = $row['status'];
            $verifikasi = $row['status_verifikasi'];
            $count = (int)$row['count'];
            
            if (!isset($opdData[$opd])) {
                $opdData[$opd] = [
                    'opd_name' => $opd,
                    'target' => 0,
                    'statuses' => [],
                    'menunggu_verifikasi' => 0
                ];
            }
            
            $opdData[$opd]['target'] += $count;
            if (!isset($opdData[$opd]['statuses'][$status])) {
                $opdData[$opd]['statuses'][$status] = 0;
            }
            $opdData[$opd]['statuses'][$status] += $count;
            
            if ($verifikasi === 'Menunggu Verifikasi Admin') {
                $opdData[$opd]['menunggu_verifikasi'] += $count;
                $totalMenungguVerifikasi += $count;
            }
            
            $totalTarget += $count;
            if (!isset($totalStatuses[$status])) {
                $totalStatuses[$status] = 0;
            }
            $totalStatuses[$status] += $count;
        }

        $finalPerOpdStats = array_values($opdData);
        // Urutkan berdasarkan nama OPD
        usort($finalPerOpdStats, function($a, $b) {
            return strcmp($a['opd_name'], $b['opd_name']);
        });

        // 5. Siapkan payload response
        $responsePayload = [
            'summary' => [
                'total_target' => $totalTarget,
                'statuses' => $totalStatuses,
                'menunggu_verifikasi' => $totalMenungguVerifikasi
            ],
            'per_opd_summary' => $finalPerOpdStats,
        ];

        Response::json(true, 200, "Ringkasan rekap berhasil diambil", $responsePayload);
    }

    // New function for filtered details
    public function getRekapDetails($vars) {
        AdminAuthHelper::validate();
        $kodeAkses = $vars['kode_akses'] ?? null;
        $db = Database::getConnection();

        $inputJSON = file_get_contents('php://input');
        $filters = json_decode($inputJSON, true);
        $opdFilter = $filters['opd_list'] ?? 'semua';
        $statusKehadiranFilter = $filters['status_kehadiran'] ?? 'semua';
        $searchFilter = $filters['search'] ?? null;
        $statusVerifikasiFilter = $filters['status_verifikasi'] ?? 'semua';

        $sql = "
            SELECT
                nip, nama_pegawai, opd AS perangkat_daerah, jabatan,
                waktu AS waktu_absen, status_verifikasi, keterangan, keterangan_verifikasi,
                nama_file_foto, lokasi AS lokasi_absen, status_kehadiran
            FROM
                app_absensi_data_absensi
            WHERE
                kode_akses = ?
        ";
        $params = [$kodeAkses];

        // Tambahkan filter OPD hanya jika ada yang dipilih dan bukan 'semua'
        if ($opdFilter !== 'semua' && !empty($opdFilter)) {
            $sql .= " AND opd = ?";
            $params[] = $opdFilter;
        }

        // Tambahkan kondisi pencarian jika ada input dari user
        if (!empty($searchFilter)) {
            $sql .= " AND (nip LIKE ? OR nama_pegawai LIKE ? OR jabatan LIKE ?)";
            $params[] = '%' . $searchFilter . '%';
            $params[] = '%' . $searchFilter . '%';
            $params[] = '%' . $searchFilter . '%';
        }

        $sql .= " ORDER BY opd ASC, nama_pegawai ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Proses filter status di sisi PHP berdasarkan status efektif
        $detailPegawai = [];
        foreach ($results as $pegawai) {
            // Tentukan status kehadiran efektif
            $status_kehadiran_efektif = $pegawai['status_kehadiran'] ?? 'Hadir';
            if ($pegawai['status_verifikasi'] === 'Ditolak Oleh Admin') {
                $status_kehadiran_efektif = 'alpa';
            } elseif ($pegawai['status_kehadiran'] === null && $pegawai['waktu_absen'] === null) {
                $status_kehadiran_efektif = 'alpa';
            }

            // Tentukan status verifikasi efektif (menangani nilai NULL)
            $status_verifikasi_efektif = $pegawai['status_verifikasi'] ?? 'ALPA';

            // Cek kecocokan dengan filter. Jika 'semua', anggap cocok.
            $kehadiranMatch = ($statusKehadiranFilter === 'semua') || (strcasecmp($status_kehadiran_efektif, $statusKehadiranFilter) === 0);
            $verifikasiMatch = ($statusVerifikasiFilter === 'semua') || (strcasecmp($status_verifikasi_efektif, $statusVerifikasiFilter) === 0);

            if ($kehadiranMatch && $verifikasiMatch) {
                $detailPegawai[] = $pegawai;
            }
        }
        
        $totalRows = count($detailPegawai);
        $pendingVerifikasiCount = 0;
        foreach ($detailPegawai as $p) {
            if (($p['status_verifikasi'] ?? '') === 'Menunggu Verifikasi Admin') {
                $pendingVerifikasiCount++;
            }
        }

        $page = isset($filters['page']) ? max(1, (int)$filters['page']) : 1;
        $limit = isset($filters['limit']) ? max(1, (int)$filters['limit']) : 10;
        $offset = ($page - 1) * $limit;
        $paginatedData = array_slice($detailPegawai, $offset, $limit);

        $payload = [
            'data' => $paginatedData,
            'pagination' => [
                'total_rows' => $totalRows,
                'total_pages' => ceil($totalRows / $limit),
                'current_page' => $page,
                'limit' => $limit,
                'pending_verifikasi_count' => $pendingVerifikasiCount
            ]
        ];
        
        Response::json(true, 200, "Detail rekap berhasil diambil", $payload);
    }

    // New function for Rekap Keseluruhan
    public function getRekapKeseluruhan() {
        AdminAuthHelper::validate();
        $db = Database::getConnection();

        $inputJSON = file_get_contents('php://input');
        $filters = json_decode($inputJSON, true);
        
        $startDate = $filters['start_date'] ?? null;
        $endDate = $filters['end_date'] ?? null;
        $opdFilter = $filters['opd_list'] ?? 'semua';
        $statusKehadiranFilter = $filters['status_kehadiran'] ?? 'semua';
        $statusVerifikasiFilter = $filters['status_verifikasi'] ?? 'semua';
        $searchFilter = $filters['search'] ?? null;

        if (!$startDate || !$endDate) {
            Response::json(false, 400, "Tanggal mulai dan selesai wajib diisi.");
            return;
        }

        $sql = "
            SELECT
                a.nip, a.nama_pegawai, a.opd AS perangkat_daerah, a.jabatan,
                a.waktu AS waktu_absen, a.status_verifikasi, a.keterangan, a.keterangan_verifikasi,
                a.nama_file_foto, a.lokasi AS lokasi_absen, a.status_kehadiran,
                j.kode_akses, j.judul AS judul_kegiatan, j.tanggal, j.jam_mulai, j.jam_selesai
            FROM
                app_absensi_data_absensi a
            INNER JOIN
                app_absensi_jadwal_kegiatan j ON a.kode_akses = j.kode_akses
            WHERE
                j.tanggal BETWEEN ? AND ?
        ";
        
        $params = [$startDate, $endDate];

        if ($opdFilter !== 'semua' && !empty($opdFilter)) {
            $sql .= " AND a.opd = ?";
            $params[] = $opdFilter;
        }

        if (!empty($searchFilter)) {
            $sql .= " AND (a.nip LIKE ? OR a.nama_pegawai LIKE ? OR a.jabatan LIKE ?)";
            $params[] = '%' . $searchFilter . '%';
            $params[] = '%' . $searchFilter . '%';
            $params[] = '%' . $searchFilter . '%';
        }

        $sql .= " ORDER BY a.opd ASC, a.nama_pegawai ASC, j.tanggal DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $detailPegawai = [];
        foreach ($results as $pegawai) {
            $status_kehadiran_efektif = $pegawai['status_kehadiran'] ?? 'Hadir';
            if ($pegawai['status_verifikasi'] === 'Ditolak Oleh Admin') {
                $status_kehadiran_efektif = 'alpa';
            } elseif ($pegawai['status_kehadiran'] === null && $pegawai['waktu_absen'] === null) {
                $status_kehadiran_efektif = 'alpa';
            }

            $status_verifikasi_efektif = $pegawai['status_verifikasi'] ?? 'ALPA';

            $kehadiranMatch = ($statusKehadiranFilter === 'semua') || (strcasecmp($status_kehadiran_efektif, $statusKehadiranFilter) === 0);
            $verifikasiMatch = ($statusVerifikasiFilter === 'semua') || (strcasecmp($status_verifikasi_efektif, $statusVerifikasiFilter) === 0);

            if ($kehadiranMatch && $verifikasiMatch) {
                $detailPegawai[] = $pegawai;
            }
        }

        $totalRows = count($detailPegawai);
        $pendingVerifikasiCount = 0;
        foreach ($detailPegawai as $p) {
            if (($p['status_verifikasi'] ?? '') === 'Menunggu Verifikasi Admin') {
                $pendingVerifikasiCount++;
            }
        }

        $page = isset($filters['page']) ? max(1, (int)$filters['page']) : 1;
        $limit = isset($filters['limit']) ? max(1, (int)$filters['limit']) : 10;
        $offset = ($page - 1) * $limit;
        $paginatedData = array_slice($detailPegawai, $offset, $limit);

        $payload = [
            'data' => $paginatedData,
            'pagination' => [
                'total_rows' => $totalRows,
                'total_pages' => ceil($totalRows / $limit),
                'current_page' => $page,
                'limit' => $limit,
                'pending_verifikasi_count' => $pendingVerifikasiCount
            ]
        ];

        Response::json(true, 200, "Data rekap keseluruhan berhasil difilter", $payload);
    }

    public function getStatistikKehadiran() {
        AdminAuthHelper::validate();
        $db = Database::getConnection();

        $inputJSON = file_get_contents('php://input');
        $filters = json_decode($inputJSON, true);
        
        $startDate = $filters['start_date'] ?? null;
        $endDate = $filters['end_date'] ?? null;
        $opdFilter = $filters['opd_list'] ?? 'semua';
        $statusKehadiran = $filters['status_kehadiran'] ?? 'alpa';

        if (!$startDate || !$endDate) {
            Response::json(false, 400, "Tanggal mulai dan selesai wajib diisi.");
            return;
        }

        $sql = "
            SELECT 
                a.nip, 
                a.nama_pegawai, 
                a.jabatan,
                a.opd AS perangkat_daerah,
                SUM(
                    CASE 
                        WHEN ? = 'alpa' THEN 
                            CASE WHEN a.status_verifikasi = 'Ditolak Oleh Admin' OR a.status_kehadiran = 'Alpa' OR ((a.status_kehadiran IS NULL OR a.status_kehadiran = '') AND a.waktu IS NULL) THEN 1 ELSE 0 END
                        WHEN ? = 'Hadir' THEN
                            CASE WHEN a.status_verifikasi != 'Ditolak Oleh Admin' AND (a.status_kehadiran = 'Hadir' OR ((a.status_kehadiran IS NULL OR a.status_kehadiran = '') AND a.waktu IS NOT NULL)) THEN 1 ELSE 0 END
                        ELSE 
                            CASE WHEN a.status_verifikasi != 'Ditolak Oleh Admin' AND a.status_kehadiran = ? THEN 1 ELSE 0 END
                    END
                ) as jumlah
            FROM app_absensi_data_absensi a
            INNER JOIN app_absensi_jadwal_kegiatan j ON a.kode_akses = j.kode_akses
            WHERE j.tanggal BETWEEN ? AND ?
        ";
        
        $params = [
            $statusKehadiran, 
            $statusKehadiran, 
            $statusKehadiran, 
            $startDate, 
            $endDate
        ];

        if ($opdFilter !== 'semua' && !empty($opdFilter)) {
            $sql .= " AND a.opd = ?";
            $params[] = $opdFilter;
        }

        $sql .= " GROUP BY a.nip, a.nama_pegawai, a.jabatan, a.opd HAVING jumlah > 0 ORDER BY jumlah DESC, a.opd ASC, a.nama_pegawai ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalRows = count($results);
        $page = isset($filters['page']) ? max(1, (int)$filters['page']) : 1;
        $limit = isset($filters['limit']) ? max(1, (int)$filters['limit']) : 10;
        $offset = ($page - 1) * $limit;
        $paginatedData = array_slice($results, $offset, $limit);

        $payload = [
            'data' => $paginatedData,
            'pagination' => [
                'total_rows' => $totalRows,
                'total_pages' => ceil($totalRows / $limit),
                'current_page' => $page,
                'limit' => $limit
            ]
        ];

        Response::json(true, 200, "Data statistik kehadiran berhasil diambil", $payload);
    }

    public function getStatistikDetail() {
        AdminAuthHelper::validate();
        $db = Database::getConnection();

        $inputJSON = file_get_contents('php://input');
        $filters = json_decode($inputJSON, true);
        
        $startDate = $filters['start_date'] ?? null;
        $endDate = $filters['end_date'] ?? null;
        $nip = $filters['nip'] ?? null;
        $statusKehadiran = $filters['status_kehadiran'] ?? 'alpa';

        if (!$startDate || !$endDate || !$nip) {
            Response::json(false, 400, "Parameter tidak lengkap.");
            return;
        }

        $sql = "
            SELECT 
                j.judul AS judul_kegiatan,
                j.tanggal,
                j.jam_mulai,
                j.jam_selesai,
                a.waktu AS waktu_absen,
                a.lokasi AS lokasi_absen,
                a.status_verifikasi
            FROM app_absensi_data_absensi a
            INNER JOIN app_absensi_jadwal_kegiatan j ON a.kode_akses = j.kode_akses
            WHERE j.tanggal BETWEEN ? AND ? AND a.nip = ?
        ";
        
        $params = [$startDate, $endDate, $nip];

        // Apply status condition exactly like the SUM query
        if (strcasecmp($statusKehadiran, 'alpa') === 0) {
            $sql .= " AND (a.status_verifikasi = 'Ditolak Oleh Admin' OR a.status_kehadiran = 'Alpa' OR ((a.status_kehadiran IS NULL OR a.status_kehadiran = '') AND a.waktu IS NULL))";
        } elseif (strcasecmp($statusKehadiran, 'Hadir') === 0) {
            $sql .= " AND a.status_verifikasi != 'Ditolak Oleh Admin' AND (a.status_kehadiran = 'Hadir' OR ((a.status_kehadiran IS NULL OR a.status_kehadiran = '') AND a.waktu IS NOT NULL))";
        } else {
            $sql .= " AND a.status_verifikasi != 'Ditolak Oleh Admin' AND a.status_kehadiran = ?";
            $params[] = $statusKehadiran;
        }

        $sql .= " ORDER BY j.tanggal DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::json(true, 200, "Data detail statistik berhasil diambil", $results);
    }

    public function getRekapOpdList($vars) {
        AdminAuthHelper::validate();
        $kodeAkses = $vars['kode_akses'] ?? null;
        if (!$kodeAkses) {
            Response::json(false, 400, "Kode akses tidak disediakan.");
        }
        $db = Database::getConnection();

        $stmtOpdFilter = $db->prepare("SELECT DISTINCT opd FROM app_absensi_data_absensi WHERE kode_akses = :ka AND opd IS NOT NULL ORDER BY opd");
        $stmtOpdFilter->execute([':ka' => $kodeAkses]);
        $opdForFilter = $stmtOpdFilter->fetchAll(PDO::FETCH_COLUMN, 0);

        Response::json(true, 200, "Daftar OPD untuk filter berhasil diambil.", $opdForFilter);
    }

    public function verifikasiAbsen() {
        $adminData = AdminAuthHelper::validate();
        $db = Database::getConnection();
        $now = new \DateTime('now', new \DateTimeZone('Asia/Jakarta'));
        
        $inputJSON = file_get_contents('php://input');
        $input = json_decode($inputJSON, true) ?: [];

        $kodeAkses = $_POST['kode_akses'] ?? $input['kode_akses'] ?? null;
        $nip = $_POST['nip'] ?? $input['nip'] ?? null;
        $statusVerifikasi = $_POST['status_verifikasi'] ?? $input['status_verifikasi'] ?? null;
        $statusKehadiranBaru = $_POST['status_kehadiran'] ?? $input['status_kehadiran'] ?? null; // Added
        $keteranganAdmin = $_POST['keterangan'] ?? $input['keterangan'] ?? null;
        $opd = $_POST['opd'] ?? $input['opd'] ?? null;
        $jabatan = $_POST['jabatan'] ?? $input['jabatan'] ?? null;
        $buktiDukung = $_FILES['bukti_dukung'] ?? null;

        if (!$kodeAkses || !$nip || !$statusVerifikasi) {
            Response::json(false, 400, "Data tidak lengkap: kode_akses, nip, dan status_verifikasi wajib diisi.");
            return;
        }

        // Ambil data absensi saat ini terlebih dahulu
        $stmtCurrent = $db->prepare("SELECT waktu, status_kehadiran, nama_file_foto FROM app_absensi_data_absensi WHERE kode_akses = :ka AND nip = :nip");
        $stmtCurrent->execute([':ka' => $kodeAkses, ':nip' => $nip]);
        $currentAbsenData = $stmtCurrent->fetch(PDO::FETCH_ASSOC);

        $newFileName = null;

        // Cek apakah ada upload file baru
        if (!empty($buktiDukung) && $buktiDukung['error'] === UPLOAD_ERR_OK) {
            if ($buktiDukung['size'] > 1048576) {
                Response::json(false, 400, "Ukuran file bukti dukung maksimal 1 MB.");
                return;
            }

            $allowedExts = ['jpg', 'jpeg', 'png', 'pdf'];
            $ext = strtolower(pathinfo($buktiDukung['name'], PATHINFO_EXTENSION));
            if (!in_array($ext, $allowedExts)) {
                Response::json(false, 400, "Tipe file tidak diizinkan. Hanya JPG, PNG, dan PDF yang diperbolehkan.");
                return;
            }

            // Simpan file
            $uploadDir = '../uploads/foto_absensi/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            
            $randomString = bin2hex(random_bytes(4));
            $newFileName = 'verif_' . $kodeAkses . '_' . $nip . '_' . time() . '_' . $randomString . '.' . $ext;
            $uploadPath = $uploadDir . $newFileName;

            if (!move_uploaded_file($buktiDukung['tmp_name'], $uploadPath)) {
                Response::json(false, 500, "Gagal menyimpan file bukti dukung.");
                return;
            }
        } else {
            // Jika tidak ada upload baru oleh admin, gunakan foto lama atau default jika belum ada
            $newFileName = ($currentAbsenData && !empty($currentAbsenData['nama_file_foto']) && $currentAbsenData['nama_file_foto'] !== '-')
                ? $currentAbsenData['nama_file_foto']
                : 'MANUAL_INPUT.jpg';
        }

        if (!$currentAbsenData) {
            // Jika data tidak ada, buat baru (mirip seperti set masal)
            $stmtPegawai = $db->prepare("SELECT nama_pegawai, perangkat_daerah, jabatan FROM app_absensi_data_pegawai WHERE nip = :nip");
            $stmtPegawai->execute([':nip' => $nip]);
            $peg = $stmtPegawai->fetch(PDO::FETCH_ASSOC);
            if (!$peg) {
                Response::json(false, 404, "Data absensi tidak ditemukan untuk NIP ini pada kegiatan ini.");
                return;
            }

            $sql = "INSERT INTO app_absensi_data_absensi 
                    (kode_akses, nip, nama_pegawai, opd, jabatan, waktu, lokasi, nama_file_foto, keterangan_verifikasi, status_verifikasi, status_kehadiran)
                    VALUES 
                    (:ka, :nip, :nama, :opd, :jabatan, :waktu, 'Diubah oleh Admin (Manual)', :foto, :ket, :sv, :sk)";
            
            $stmt = $db->prepare($sql);
            $stmt->execute([
                ':ka' => $kodeAkses,
                ':nip' => $nip,
                ':nama' => $peg['nama_pegawai'],
                ':opd' => $opd ?? $peg['perangkat_daerah'],
                ':jabatan' => $jabatan ?? $peg['jabatan'],
                ':waktu' => $now->format('Y-m-d H:i:s'),
                ':foto' => $newFileName,
                ':ket' => $keteranganAdmin,
                ':sv' => $statusVerifikasi,
                ':sk' => $statusKehadiranBaru ?? 'Hadir Terlambat Diluar Lokasi'
            ]);

            // Log Absensi
            LogAbsensi::log(
                $db,
                $kodeAkses,
                $nip,
                $peg['nama_pegawai'],
                'tambah',
                $adminData['username'] ?? '',
                $adminData['nama'] ?? '',
                $_SERVER['REMOTE_ADDR'] ?? '',
                [
                    'kode_akses' => $kodeAkses,
                    'nip' => $nip,
                    'status_verifikasi' => $statusVerifikasi,
                    'status_kehadiran' => $statusKehadiranBaru ?? 'Hadir Terlambat Diluar Lokasi',
                    'keterangan' => $keteranganAdmin
                ]
            );

            $insertedWaktu = $now->format('Y-m-d H:i:s');
            $insertedKehadiran = $statusKehadiranBaru ?? 'Hadir Terlambat Diluar Lokasi';

            Response::json(true, 200, "Status absensi berhasil ditambahkan.", [
                'waktu'                 => $insertedWaktu,
                'waktu_absen'           => $insertedWaktu,
                'status_kehadiran'      => $insertedKehadiran,
                'status_verifikasi'     => $statusVerifikasi,
                'nama_file_foto'        => $newFileName,
                'keterangan_verifikasi' => $keteranganAdmin,
                'lokasi'                => 'Diubah oleh Admin (Manual)'
            ]);
            return;
        }

        // --- UPDATE DATA YANG SUDAH ADA ---
        $updateWaktu = $currentAbsenData['waktu'];
        $updateStatusKehadiran = $statusKehadiranBaru ?? $currentAbsenData['status_kehadiran'];

        if ($statusVerifikasi === 'Terverifikasi Oleh Admin' && ($currentAbsenData['waktu'] === null || $currentAbsenData['waktu'] === '' || $currentAbsenData['waktu'] === '0000-00-00 00:00:00')) {
            $updateWaktu = $now->format('Y-m-d H:i:s');
            if (!$statusKehadiranBaru) $updateStatusKehadiran = 'Hadir Terlambat Diluar Lokasi';
        }

        $sql = "UPDATE app_absensi_data_absensi 
                SET 
                    status_verifikasi = :sv, 
                    keterangan_verifikasi = :ket,
                    opd = :opd,
                    jabatan = :jabatan,
                    waktu = :waktu_new,
                    status_kehadiran = :status_kehadiran_new,
                    nama_file_foto = :foto
                WHERE kode_akses = :ka AND nip = :nip";

        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':sv' => $statusVerifikasi,
            ':ket' => $keteranganAdmin,
            ':opd' => $opd,
            ':jabatan' => $jabatan,
            ':waktu_new' => $updateWaktu,
            ':status_kehadiran_new' => $updateStatusKehadiran,
            ':foto' => $newFileName,
            ':ka' => $kodeAkses,
            ':nip' => $nip
        ]);

        // Ambil nama target untuk log
        $stmtTarget = $db->prepare("SELECT nama_pegawai FROM app_absensi_data_absensi WHERE kode_akses = :ka AND nip = :nip");
        $stmtTarget->execute([':ka' => $kodeAkses, ':nip' => $nip]);
        $namaTarget = $stmtTarget->fetchColumn() ?: '-';

        // Log Absensi
        LogAbsensi::log(
            $db,
            $kodeAkses,
            $nip,
            $namaTarget,
            'edit',
            $adminData['username'] ?? '',
            $adminData['nama'] ?? '',
            $_SERVER['REMOTE_ADDR'] ?? '',
            [
                'kode_akses' => $kodeAkses,
                'nip' => $nip,
                'status_verifikasi' => $statusVerifikasi,
                'status_kehadiran' => $updateStatusKehadiran,
                'keterangan' => $keteranganAdmin
            ]
        );

        Response::json(true, 200, "Status absensi berhasil diperbarui.", [
            'waktu'                 => $updateWaktu,
            'waktu_absen'           => $updateWaktu,
            'status_kehadiran'      => $updateStatusKehadiran,
            'status_verifikasi'     => $statusVerifikasi,
            'nama_file_foto'        => $newFileName,
            'keterangan_verifikasi' => $keteranganAdmin
        ]);
    }

    public function verifikasiAbsenMasal() {
        $adminData = AdminAuthHelper::validate();
        $db = Database::getConnection();
        $now = new \DateTime('now', new \DateTimeZone('Asia/Jakarta'));
        
        $inputJSON = file_get_contents('php://input');
        $input = json_decode($inputJSON, true) ?: [];

        $kodeAkses = $_POST['kode_akses'] ?? $input['kode_akses'] ?? null;
        $nips = isset($_POST['nips']) 
            ? (is_array($_POST['nips']) ? $_POST['nips'] : json_decode($_POST['nips'], true)) 
            : ($input['nips'] ?? $input['nip_list'] ?? []);
        $statusVerifikasi = $_POST['status_verifikasi'] ?? $input['status_verifikasi'] ?? null;
        $statusKehadiran = $_POST['status_kehadiran'] ?? $input['status_kehadiran'] ?? null;
        $keteranganAdmin = $_POST['keterangan'] ?? $input['keterangan'] ?? null;
        $buktiDukung = $_FILES['bukti_dukung'] ?? null;

        if (!$kodeAkses || empty($nips) || !$statusVerifikasi || !$statusKehadiran) {
            Response::json(false, 400, "Data tidak lengkap: kode_akses, nips, status_verifikasi, status_kehadiran wajib diisi.");
            return;
        }

        $newFileName = 'MANUAL_INPUT.jpg';
        if (!empty($buktiDukung) && $buktiDukung['error'] === UPLOAD_ERR_OK) {
            if ($buktiDukung['size'] > 1048576) {
                Response::json(false, 400, "Ukuran file bukti dukung maksimal 1 MB.");
                return;
            }

            $allowedExts = ['jpg', 'jpeg', 'png', 'pdf'];
            $ext = strtolower(pathinfo($buktiDukung['name'], PATHINFO_EXTENSION));
            if (!in_array($ext, $allowedExts)) {
                Response::json(false, 400, "Tipe file tidak diizinkan. Hanya JPG, PNG, dan PDF yang diperbolehkan.");
                return;
            }

            // Simpan file
            $uploadDir = '../uploads/foto_absensi/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            
            $randomString = bin2hex(random_bytes(4));
            $newFileName = 'bulk_' . $kodeAkses . '_' . time() . '_' . $randomString . '.' . $ext;
            $uploadPath = $uploadDir . $newFileName;

            if (!move_uploaded_file($buktiDukung['tmp_name'], $uploadPath)) {
                Response::json(false, 500, "Gagal menyimpan file bukti dukung.");
                return;
            }
        }

        $successCount = 0;
        foreach ($nips as $nip) {
            $stmtPegawai = $db->prepare("SELECT nama_pegawai, perangkat_daerah, jabatan FROM app_absensi_data_pegawai WHERE nip = :nip");
            $stmtPegawai->execute([':nip' => $nip]);
            $peg = $stmtPegawai->fetch(PDO::FETCH_ASSOC);
            if (!$peg) continue;

            $sql = "INSERT INTO app_absensi_data_absensi 
                    (kode_akses, nip, nama_pegawai, opd, jabatan, waktu, lokasi, nama_file_foto, keterangan_verifikasi, status_verifikasi, status_kehadiran)
                    VALUES 
                    (:ka, :nip, :nama, :opd, :jabatan, :waktu, 'Diubah oleh Admin (Masal)', :foto, :ket, :sv, :sk)
                    ON DUPLICATE KEY UPDATE 
                    waktu = IF(waktu IS NULL OR waktu = '0000-00-00 00:00:00', VALUES(waktu), waktu),
                    status_verifikasi = VALUES(status_verifikasi),
                    status_kehadiran = VALUES(status_kehadiran),
                    keterangan_verifikasi = VALUES(keterangan_verifikasi),
                    nama_file_foto = VALUES(nama_file_foto)";
            
            $stmt = $db->prepare($sql);
            $stmt->execute([
                ':ka' => $kodeAkses,
                ':nip' => $nip,
                ':nama' => $peg['nama_pegawai'],
                ':opd' => $peg['perangkat_daerah'],
                ':jabatan' => $peg['jabatan'],
                ':waktu' => $now->format('Y-m-d H:i:s'),
                ':foto' => $newFileName,
                ':ket' => $keteranganAdmin,
                ':sv' => $statusVerifikasi,
                ':sk' => $statusKehadiran
            ]);
            LogAbsensi::log(
                $db,
                $kodeAkses,
                $nip,
                $peg['nama_pegawai'],
                'edit',
                $adminData['username'] ?? '',
                $adminData['nama'] ?? '',
                $_SERVER['REMOTE_ADDR'] ?? '',
                [
                    'kode_akses' => $kodeAkses,
                    'nip' => $nip,
                    'status_verifikasi' => $statusVerifikasi,
                    'status_kehadiran' => $statusKehadiran,
                    'keterangan' => $keteranganAdmin
                ]
            );
            $successCount++;
        }

        Response::json(true, 200, "Berhasil memperbarui $successCount data pegawai.");
    }

    public function deleteAbsensiEntry($vars) {
        $adminData = AdminAuthHelper::validate();
        $db = Database::getConnection();
        
        $kodeAkses = $vars['kode_akses'] ?? null;
        $nip = $vars['nip'] ?? null;

        if (!$kodeAkses || !$nip) {
            Response::json(false, 400, "Data tidak lengkap: kode_akses dan nip wajib diisi.");
            return;
        }

        // Ambil nama pegawai dan nama file foto sebelum delete untuk log & cleanup file
        $stmtTarget = $db->prepare("SELECT nama_pegawai, nama_file_foto FROM app_absensi_data_absensi WHERE kode_akses = :ka AND nip = :nip");
        $stmtTarget->execute([':ka' => $kodeAkses, ':nip' => $nip]);
        $targetData = $stmtTarget->fetch(PDO::FETCH_ASSOC);
        $namaTarget = $targetData['nama_pegawai'] ?? '-';
        $fotoTarget = $targetData['nama_file_foto'] ?? null;

        $sql = "DELETE FROM app_absensi_data_absensi WHERE kode_akses = :ka AND nip = :nip";
        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':ka' => $kodeAkses,
            ':nip' => $nip
        ]);

        if ($stmt->rowCount() > 0) {
            // Hapus file foto fisik jika ada dan bukan link URL atau file default
            if ($fotoTarget && $fotoTarget !== '-' && $fotoTarget !== 'MANUAL_INPUT.jpg') {
                if (!preg_match('/^https?:\/\//i', $fotoTarget)) {
                    $filePath = __DIR__ . '/../../uploads/foto_absensi/' . $fotoTarget;
                    if (file_exists($filePath)) {
                        @unlink($filePath);
                    }
                }
            }

            LogAbsensi::log(
                $db,
                $kodeAkses,
                $nip,
                $namaTarget,
                'hapus',
                $adminData['username'] ?? '',
                $adminData['nama'] ?? '',
                $_SERVER['REMOTE_ADDR'] ?? '',
                ['kode_akses' => $kodeAkses, 'nip' => $nip]
            );
            Response::json(true, 200, "Data absensi pegawai berhasil dihapus dari rekap.");
        } else {
            Response::json(false, 404, "Data absensi tidak ditemukan untuk dihapus.");
        }
    }

    public function getEligiblePegawai($vars) {
        AdminAuthHelper::validate();
        $kodeAkses = $vars['kode_akses'] ?? null;
        $db = Database::getConnection();

        if (!$kodeAkses) {
            Response::json(false, 400, "Kode akses kegiatan tidak disediakan.");
        }

        // Ambil filter dari body request POST
        $inputJSON = file_get_contents('php://input');
        $filters = json_decode($inputJSON, true);
        $opdFilter = $filters['opd_list'] ?? 'semua';
        $searchFilter = $filters['search'] ?? null;
        $includeAll = $filters['include_all'] ?? false;

        $params = [];
        
        if ($includeAll) {
            $sql = "SELECT nip, nama_pegawai, jabatan, perangkat_daerah FROM app_absensi_data_pegawai WHERE 1=1";
        } else {
            // Query untuk mendapatkan semua NIP yang sudah ada di rekap kegiatan ini
            $subQuery = "SELECT nip FROM app_absensi_data_absensi WHERE kode_akses = ?";
            // Query utama untuk mendapatkan semua pegawai yang NIP-nya TIDAK ADA di subquery
            $sql = "SELECT nip, nama_pegawai, jabatan, perangkat_daerah FROM app_absensi_data_pegawai WHERE nip NOT IN ($subQuery)";
            $params[] = $kodeAkses;
        }


        // Tambahkan filter pencarian
        if (!empty($searchFilter)) {
            $sql .= " AND (nip LIKE ? OR nama_pegawai LIKE ? OR jabatan LIKE ?)";
            $params[] = '%' . $searchFilter . '%';
            $params[] = '%' . $searchFilter . '%';
            $params[] = '%' . $searchFilter . '%';
        }

        // Tambahkan filter OPD
        if ($opdFilter !== 'semua' && !empty($opdFilter)) {
            $sql .= " AND perangkat_daerah = ?";
            $params[] = $opdFilter;
        }

        $sql .= " ORDER BY nama_pegawai ASC";
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $eligiblePegawai = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::json(true, 200, "Daftar pegawai yang dapat ditambahkan berhasil diambil.", $eligiblePegawai);
    }

    public function addAbsensiEntry($vars) {
        $adminData = AdminAuthHelper::validate();
        $kodeAkses = $vars['kode_akses'] ?? null;
        $db = Database::getConnection();

        $inputJSON = file_get_contents('php://input');
        $input = json_decode($inputJSON, true);

        $nip = $input['nip'] ?? null;
        $statusKehadiran = $input['status_kehadiran'] ?? null;
        $statusVerifikasi = $input['status_verifikasi'] ?? null;
        $keterangan = $input['keterangan'] ?? null;

        if (!$kodeAkses || !$nip || !$statusKehadiran || !$statusVerifikasi || !$keterangan) {
            Response::json(false, 400, "Data tidak lengkap. Semua field wajib diisi.");
        }

        // 1. Cek apakah pegawai sudah ada di rekap ini
        $stmtCheck = $db->prepare("SELECT COUNT(*) FROM app_absensi_data_absensi WHERE kode_akses = :ka AND nip = :nip");
        $stmtCheck->execute([':ka' => $kodeAkses, ':nip' => $nip]);
        if ($stmtCheck->fetchColumn() > 0) {
            Response::json(false, 409, "Pegawai ini sudah ada dalam daftar absensi kegiatan ini.");
        }

        // 2. Ambil detail pegawai dari tabel master
        $stmtPegawai = $db->prepare("SELECT nama_pegawai, perangkat_daerah, jabatan FROM app_absensi_data_pegawai WHERE nip = :nip");
        $stmtPegawai->execute([':nip' => $nip]);
        $pegawai = $stmtPegawai->fetch(PDO::FETCH_ASSOC);
        if (!$pegawai) {
            Response::json(false, 404, "Data master untuk NIP yang dipilih tidak ditemukan.");
        }

        // 3. Ambil kategori dari jadwal
        $stmtJadwal = $db->prepare("SELECT kategori FROM app_absensi_jadwal_kegiatan WHERE kode_akses = :ka");
        $stmtJadwal->execute([':ka' => $kodeAkses]);
        $jadwal = $stmtJadwal->fetch(PDO::FETCH_ASSOC);
        if (!$jadwal) {
            Response::json(false, 404, "Jadwal kegiatan tidak ditemukan.");
        }

        // 4. Tentukan waktu berdasarkan status kehadiran
        $waktu = null;
        if ($statusKehadiran !== 'Alpa') {
            $now = new \DateTime('now', new \DateTimeZone('Asia/Jakarta'));
            $waktu = $now->format('Y-m-d H:i:s');
        }

        // 5. Insert data baru ke tabel absensi
        $sql = "INSERT INTO app_absensi_data_absensi 
                    (kode_akses, nip, nama_pegawai, opd, jabatan, kategori, status_verifikasi, status_kehadiran, keterangan_verifikasi, waktu, nama_file_foto, lokasi) 
                VALUES 
                    (:ka, :nip, :nama, :opd, :jabatan, :kategori, :sv, :sk, :ket, :waktu, 'MANUAL_INPUT.jpg', 'MANUAL_INPUT_ADMIN')";
        
        $stmtInsert = $db->prepare($sql);
        $stmtInsert->execute([
            ':ka' => $kodeAkses,
            ':nip' => $nip,
            ':nama' => $pegawai['nama_pegawai'],
            ':opd' => $pegawai['perangkat_daerah'],
            ':jabatan' => $pegawai['jabatan'],
            ':kategori' => $jadwal['kategori'],
            ':sv' => $statusVerifikasi,
            ':sk' => $statusKehadiran,
            ':ket' => $keterangan,
            ':waktu' => $waktu
        ]);

        if ($stmtInsert->rowCount() > 0) {
            LogAbsensi::log(
                $db,
                $kodeAkses,
                $nip,
                $pegawai['nama_pegawai'],
                'tambah',
                $adminData['username'] ?? '',
                $adminData['nama'] ?? '',
                $_SERVER['REMOTE_ADDR'] ?? '',
                [
                    'kode_akses' => $kodeAkses,
                    'nip' => $nip,
                    'status_verifikasi' => $statusVerifikasi,
                    'status_kehadiran' => $statusKehadiran,
                    'keterangan' => $keterangan
                ]
            );
            Response::json(true, 200, "Peserta berhasil ditambahkan ke dalam rekap.");
        } else {
            Response::json(false, 500, "Gagal menambahkan peserta ke dalam rekap.");
        }
    }

    public function addAbsensiEntryBulk($vars) {
        $adminData = AdminAuthHelper::validate();
        $kodeAkses = $vars['kode_akses'] ?? null;
        $db = Database::getConnection();

        // 1. Ambil data POST
        $nipsRaw = $_POST['nips'] ?? null;
        if (!$nipsRaw) {
            $inputJSON = file_get_contents('php://input');
            $data = json_decode($inputJSON, true);
            $pesertaBatch = $data;
        } else {
            $pesertaBatch = json_decode($nipsRaw, true);
        }
        
        $statusKehadiran = $_POST['status_kehadiran'] ?? 'Belum Absen';
        $statusVerifikasi = $_POST['status_verifikasi'] ?? 'Terverifikasi Oleh Admin';
        $keteranganAdmin = $_POST['keterangan'] ?? 'Ditambahkan ke daftar peserta oleh admin.';
        $buktiDukung = $_FILES['bukti_dukung'] ?? null;

        if (empty($pesertaBatch) || !is_array($pesertaBatch)) {
            Response::json(false, 400, "Data batch tidak valid atau kosong.");
            return;
        }

        // Ambil detail jadwal sekali saja
        $stmtJadwal = $db->prepare("SELECT kategori FROM app_absensi_jadwal_kegiatan WHERE kode_akses = :ka");
        $stmtJadwal->execute([':ka' => $kodeAkses]);
        $jadwal = $stmtJadwal->fetch(PDO::FETCH_ASSOC);
        if (!$jadwal) {
            Response::json(false, 404, "Jadwal kegiatan tidak ditemukan.");
            return;
        }

        $newFileName = null;
        if ($statusKehadiran !== 'Belum Absen' && !empty($buktiDukung) && $buktiDukung['error'] === UPLOAD_ERR_OK) {
            if ($buktiDukung['size'] > 1048576) {
                Response::json(false, 400, "Ukuran file bukti dukung maksimal 1 MB.");
                return;
            }
            $allowedExts = ['jpg', 'jpeg', 'png', 'pdf'];
            $ext = strtolower(pathinfo($buktiDukung['name'], PATHINFO_EXTENSION));
            if (!in_array($ext, $allowedExts)) {
                Response::json(false, 400, "Tipe file tidak diizinkan. Hanya JPG, PNG, dan PDF yang diperbolehkan.");
                return;
            }
            
            $uploadDir = '../uploads/foto_absensi/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            $randomString = bin2hex(random_bytes(4));
            $newFileName = 'bulk_' . $kodeAkses . '_' . time() . '_' . $randomString . '.' . $ext;
            $uploadPath = $uploadDir . $newFileName;
            if (!move_uploaded_file($buktiDukung['tmp_name'], $uploadPath)) {
                Response::json(false, 500, "Gagal menyimpan file bukti dukung.");
                return;
            }
        }

        $berhasil = 0;
        $gagal = 0;
        $dilewati = 0;
        $now = new \DateTime('now', new \DateTimeZone('Asia/Jakarta'));
        $waktuSekarang = $now->format('Y-m-d H:i:s');

        $db->beginTransaction();
        try {
            $stmtCheck = $db->prepare("SELECT COUNT(*) FROM app_absensi_data_absensi WHERE kode_akses = :ka AND nip = :nip");
            $stmtPegawai = $db->prepare("SELECT nama_pegawai, perangkat_daerah, jabatan FROM app_absensi_data_pegawai WHERE nip = :nip");
            
            // Query Upsert
            $sql = "INSERT INTO app_absensi_data_absensi 
                    (kode_akses, nip, nama_pegawai, opd, jabatan, kategori, status_verifikasi, status_kehadiran, keterangan_verifikasi, waktu, nama_file_foto, lokasi) 
                    VALUES 
                    (:ka, :nip, :nama, :opd, :jabatan, :kategori, :sv, :sk, :ket, :waktu, :foto, 'Diubah oleh Admin (Masal)')
                    ON DUPLICATE KEY UPDATE 
                    waktu = IF(:waktu2 IS NULL OR waktu = '0000-00-00 00:00:00' OR status_kehadiran = 'Alpa', VALUES(waktu), waktu),
                    status_verifikasi = VALUES(status_verifikasi),
                    status_kehadiran = VALUES(status_kehadiran),
                    keterangan_verifikasi = VALUES(keterangan_verifikasi),
                    nama_file_foto = IF(VALUES(nama_file_foto) IS NOT NULL, VALUES(nama_file_foto), nama_file_foto)";
            $stmtInsertUpdate = $db->prepare($sql);

            foreach ($pesertaBatch as $peserta) {
                // Support both format: `["123", "456"]` or `[{"nip": "123"}]` depending on old/new FE logic
                $nip = is_array($peserta) ? ($peserta['nip'] ?? null) : $peserta;
                if (!$nip) {
                    $gagal++;
                    continue;
                }

                if ($statusKehadiran === 'Belum Absen') {
                    // Logika lama: skip jika sudah ada
                    $stmtCheck->execute([':ka' => $kodeAkses, ':nip' => $nip]);
                    if ($stmtCheck->fetchColumn() > 0) {
                        $dilewati++;
                        continue;
                    }
                }

                $stmtPegawai->execute([':nip' => $nip]);
                $pegawai = $stmtPegawai->fetch(PDO::FETCH_ASSOC);
                if (!$pegawai) {
                    $gagal++;
                    continue;
                }
                
                $sk = ($statusKehadiran === 'Belum Absen') ? 'Alpa' : $statusKehadiran;
                $sv = ($statusKehadiran === 'Belum Absen') ? 'ALPA' : $statusVerifikasi;
                $ket = ($statusKehadiran === 'Belum Absen' && empty($_POST['keterangan'])) ? 'Ditambahkan ke daftar peserta oleh admin.' : $keteranganAdmin;
                $wkt = ($statusKehadiran === 'Belum Absen') ? null : $waktuSekarang;

                $stmtInsertUpdate->execute([
                    ':ka' => $kodeAkses,
                    ':nip' => $nip,
                    ':nama' => $pegawai['nama_pegawai'],
                    ':opd' => $pegawai['perangkat_daerah'],
                    ':jabatan' => $pegawai['jabatan'],
                    ':kategori' => $jadwal['kategori'],
                    ':sv' => $sv,
                    ':sk' => $sk,
                    ':ket' => $ket,
                    ':waktu' => $wkt,
                    ':foto' => $newFileName,
                    ':waktu2' => $wkt // for IF check in ON DUPLICATE KEY
                ]);

                if ($stmtInsertUpdate->rowCount() > 0) {
                    $berhasil++;
                    LogAbsensi::log(
                        $db,
                        $kodeAkses,
                        $nip,
                        $pegawai['nama_pegawai'],
                        'tambah',
                        $adminData['username'] ?? '',
                        $adminData['nama'] ?? '',
                        $_SERVER['REMOTE_ADDR'] ?? '',
                        [
                            'kode_akses' => $kodeAkses,
                            'nip' => $nip,
                            'status_verifikasi' => $sv,
                            'status_kehadiran' => $sk,
                            'keterangan' => $ket
                        ]
                    );
                } else $gagal++;
            }

            $db->commit();

            $message = "$berhasil peserta berhasil diproses.";
            if ($dilewati > 0) $message .= " $dilewati peserta dilewati (sudah ada).";
            if ($gagal > 0) $message .= " $gagal peserta gagal diproses.";
            
            Response::json(true, 200, $message);

        } catch (\Exception $e) {
            $db->rollBack();
            Response::json(false, 500, "Terjadi kesalahan server saat proses bulk insert/update: " . $e->getMessage());
        }
    }

    public function deleteAbsensiEntryBulk() {
        $adminData = AdminAuthHelper::validate();
        $db = Database::getConnection();
        
        $inputJSON = file_get_contents('php://input');
        $input = json_decode($inputJSON, true);

        $kodeAkses = $input['kode_akses'] ?? null;
        $nips = $input['nips'] ?? [];

        if (empty($kodeAkses) || empty($nips) || !is_array($nips)) {
            Response::json(false, 400, "Data tidak lengkap: kode_akses dan daftar NIP wajib diisi.");
            return;
        }

        // Sanitize NIPs to be safe
        $sanitizedNips = array_filter($nips, function($nip) {
            return !empty($nip) && is_string($nip);
        });

        if (empty($sanitizedNips)) {
            Response::json(false, 400, "Daftar NIP yang valid tidak ditemukan.");
            return;
        }

        $placeholders = implode(',', array_fill(0, count($sanitizedNips), '?'));
        $params = array_merge([$kodeAkses], $sanitizedNips);

        // Ambil nama pegawai dan foto yang akan dihapus untuk audit log & cleanup file
        $stmtTargets = $db->prepare("SELECT nip, nama_pegawai, nama_file_foto FROM app_absensi_data_absensi WHERE kode_akses = ? AND nip IN ($placeholders)");
        $stmtTargets->execute($params);
        $targetsData = $stmtTargets->fetchAll(PDO::FETCH_ASSOC);

        $targets = [];
        $fotosToClean = [];
        foreach ($targetsData as $row) {
            $targets[$row['nip']] = $row['nama_pegawai'];
            if (!empty($row['nama_file_foto']) && $row['nama_file_foto'] !== '-' && $row['nama_file_foto'] !== 'MANUAL_INPUT.jpg') {
                if (!preg_match('/^https?:\/\//i', $row['nama_file_foto'])) {
                    $fotosToClean[] = $row['nama_file_foto'];
                }
            }
        }

        $sql = "DELETE FROM app_absensi_data_absensi WHERE kode_akses = ? AND nip IN ($placeholders)";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        $deletedCount = $stmt->rowCount();

        if ($deletedCount > 0) {
            // Hapus file fisik lokal yang terkait
            foreach ($fotosToClean as $fotoFile) {
                $filePath = __DIR__ . '/../../uploads/foto_absensi/' . $fotoFile;
                if (file_exists($filePath)) {
                    @unlink($filePath);
                }
            }

            foreach ($sanitizedNips as $nipDel) {
                LogAbsensi::log(
                    $db,
                    $kodeAkses,
                    $nipDel,
                    $targets[$nipDel] ?? '-',
                    'hapus',
                    $adminData['username'] ?? '',
                    $adminData['nama'] ?? '',
                    $_SERVER['REMOTE_ADDR'] ?? '',
                    ['kode_akses' => $kodeAkses, 'nip' => $nipDel]
                );
            }
            Response::json(true, 200, "$deletedCount data absensi berhasil dihapus dari rekap.");
        } else {
            Response::json(false, 404, "Tidak ada data absensi yang cocok untuk dihapus.");
        }
    }

    public function importCsv() {
        $adminData = AdminAuthHelper::validate();
        $db = Database::getConnection();
        
        $inputJSON = file_get_contents('php://input');
        $input = json_decode($inputJSON, true);

        $kodeAkses = $input['kode_akses'] ?? null;
        $statusKehadiranDef = $input['status_kehadiran'] ?? 'Hadir';
        $statusVerifikasiDef = $input['status_verifikasi'] ?? 'Terverifikasi Oleh Admin';
        $keteranganAdminDef = $input['keterangan_admin'] ?? $input['keterangan'] ?? '';
        $dataRows = $input['data'] ?? [];

        if (!$kodeAkses || empty($dataRows)) {
            Response::json(false, 400, "Kode akses dan data import wajib diisi.");
            return;
        }

        $berhasil = 0;
        $db->beginTransaction();
        try {
            foreach ($dataRows as $data) {
                // Ensure data has required fields
                $waktu = trim($data['waktu'] ?? '');
                $nip = trim($data['nip'] ?? '');
                $nama = trim($data['nama_pegawai'] ?? '');
                $jabatan = trim($data['jabatan'] ?? '');
                $opd = trim($data['opd'] ?? '');
                $lokasi = trim($data['lokasi'] ?? '');
                $lat = (isset($data['lat']) && is_numeric($data['lat'])) ? floatval($data['lat']) : 0;
                $lng = (isset($data['lng']) && is_numeric($data['lng'])) ? floatval($data['lng']) : 0;
                $foto = trim($data['nama_file_foto'] ?? '');
                $keteranganCsv = trim($data['keterangan'] ?? '');

                if (empty($nip)) continue;
                if (empty($waktu)) $waktu = null;

                $sql = "INSERT INTO app_absensi_data_absensi 
                        (kode_akses, nip, nama_pegawai, opd, jabatan, waktu, lokasi, lat, lng, nama_file_foto, keterangan, keterangan_verifikasi, status_verifikasi, status_kehadiran)
                        VALUES 
                        (:ka, :nip, :nama, :opd, :jabatan, :waktu, :lokasi, :lat, :lng, :foto, :ket_csv, :ket_admin, :sv, :sk)
                        ON DUPLICATE KEY UPDATE 
                        nama_pegawai = VALUES(nama_pegawai),
                        jabatan = VALUES(jabatan),
                        opd = VALUES(opd),
                        waktu = VALUES(waktu),
                        lokasi = VALUES(lokasi),
                        lat = VALUES(lat),
                        lng = VALUES(lng),
                        nama_file_foto = VALUES(nama_file_foto),
                        keterangan = VALUES(keterangan),
                        keterangan_verifikasi = VALUES(keterangan_verifikasi),
                        status_verifikasi = VALUES(status_verifikasi),
                        status_kehadiran = VALUES(status_kehadiran)";

                $stmt = $db->prepare($sql);
                $stmt->execute([
                    ':ka' => $kodeAkses,
                    ':nip' => $nip,
                    ':nama' => $nama,
                    ':opd' => $opd,
                    ':jabatan' => $jabatan,
                    ':waktu' => $waktu,
                    ':lokasi' => $lokasi,
                    ':lat' => $lat,
                    ':lng' => $lng,
                    ':foto' => empty($foto) ? 'MANUAL_INPUT.jpg' : $foto,
                    ':ket_csv' => $keteranganCsv,
                    ':ket_admin' => $keteranganAdminDef,
                    ':sv' => $statusVerifikasiDef,
                    ':sk' => $statusKehadiranDef
                ]);

                LogAbsensi::log(
                    $db,
                    $kodeAkses,
                    $nip,
                    $nama,
                    'tambah',
                    $adminData['username'] ?? '',
                    $adminData['nama'] ?? '',
                    $_SERVER['REMOTE_ADDR'] ?? '',
                    [
                        'kode_akses' => $kodeAkses,
                        'nip' => $nip,
                        'status_verifikasi' => $statusVerifikasiDef,
                        'status_kehadiran' => $statusKehadiranDef,
                        'keterangan' => $keteranganCsv,
                        'keterangan_admin' => $keteranganAdminDef,
                        'sumber' => 'Import CSV'
                    ]
                );

                $berhasil++;
            }
            $db->commit();
            Response::json(true, 200, "$berhasil data berhasil diimport/diupdate.");
        } catch (\Exception $e) {
            $db->rollBack();
            Response::json(false, 500, "Terjadi kesalahan saat import: " . $e->getMessage());
        }
    }



    public function listLog() {
        // 1. Validasi hak akses: hanya Super Admin yang diizinkan
        $adminData = AdminAuthHelper::validate();
        $roles = isset($adminData['role']) ? (array) $adminData['role'] : [];
        if (!in_array('super admin', $roles)) {
            Response::json(false, 403, "Hak akses ditolak.");
            return;
        }

        // 2. Filter wajib: kode_akses
        $kodeAkses = trim($_GET['kode_akses'] ?? '');
        if (empty($kodeAkses)) {
            Response::json(false, 400, "Kode akses kegiatan wajib dipilih.");
            return;
        }

        // 3. Filter opsional
        $searchPegawai = trim($_GET['search_pegawai'] ?? '');
        $jenisAksi = trim($_GET['jenis_aksi'] ?? '');
        $searchPelaku = trim($_GET['search_pelaku'] ?? '');
        $tanggal = trim($_GET['tanggal'] ?? '');

        // 4. Pagination parameter
        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $limit = isset($_GET['limit']) ? max(1, (int)$_GET['limit']) : 10;
        $offset = ($page - 1) * $limit;

        $db = Database::getConnection();

        // 5. Bangun Query SQL dinamis
        $conditions = ["kode_akses = :kode_akses"];
        $params = [':kode_akses' => $kodeAkses];

        if (!empty($searchPegawai)) {
            $conditions[] = "(nip LIKE :search_pegawai_nip OR nama LIKE :search_pegawai_nama)";
            $params[':search_pegawai_nip'] = '%' . $searchPegawai . '%';
            $params[':search_pegawai_nama'] = '%' . $searchPegawai . '%';
        }

        if (!empty($jenisAksi) && in_array(strtolower($jenisAksi), ['tambah', 'edit', 'hapus'])) {
            $conditions[] = "jenis_aksi = :jenis_aksi";
            $params[':jenis_aksi'] = strtolower($jenisAksi);
        }

        if (!empty($searchPelaku)) {
            $conditions[] = "(nip_pelaku LIKE :search_pelaku_nip OR nama_pelaku LIKE :search_pelaku_nama)";
            $params[':search_pelaku_nip'] = '%' . $searchPelaku . '%';
            $params[':search_pelaku_nama'] = '%' . $searchPelaku . '%';
        }

        if (!empty($tanggal)) {
            $conditions[] = "DATE(waktu_aksi) = :tanggal";
            $params[':tanggal'] = $tanggal;
        }

        $whereSql = implode(' AND ', $conditions);

        // Hitung total baris yang cocok
        $countStmt = $db->prepare("SELECT COUNT(*) FROM app_absensi_log_absensi WHERE {$whereSql}");
        $countStmt->execute($params);
        $totalRows = (int)$countStmt->fetchColumn();

        // Ambil data log sesuai pagination
        $sql = "SELECT id_log_absensi, kode_akses, nip, nama, jenis_aksi, nip_pelaku, nama_pelaku, ip_address, user_agent, waktu_aksi, data 
                FROM app_absensi_log_absensi 
                WHERE {$whereSql} 
                ORDER BY waktu_aksi DESC, id_log_absensi DESC 
                LIMIT :limit OFFSET :offset";
        
        $stmt = $db->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $payload = [
            'data' => $logs,
            'pagination' => [
                'total_rows' => $totalRows,
                'total_pages' => ($limit > 0) ? (int)ceil($totalRows / $limit) : 1,
                'current_page' => $page,
                'limit' => $limit
            ]
        ];

        Response::json(true, 200, "Berhasil mengambil log absensi.", $payload);
    }

}
