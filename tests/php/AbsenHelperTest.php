<?php

require_once __DIR__ . '/../../vendor/autoload.php';

use App\Helpers\AbsenHelper;

class AbsenHelperTest {
    private $passCount = 0;
    private $failCount = 0;

    public function runAllTests() {
        echo "\n=== MENJALANKAN UNIT TEST: AbsenHelper ===\n\n";

        $this->testAbsenCepatNonAdminThrows403();
        $this->testAbsenCepatKeteranganVerifikasiKosongThrows422();
        $this->testAbsenCepatSuccessDefault();
        $this->testAbsenCepatSuccessCustomStatus();

        $this->testAbsenMandiriUnauthenticatedThrows401();
        $this->testAbsenMandiriTanpaFotoThrows422();
        $this->testAbsenMandiriStrictTimeViolatedThrows422();
        $this->testAbsenMandiriStrictLocationViolatedThrows422();
        $this->testAbsenMandiriToleransiTerlambatTanpaKeteranganThrows422();
        $this->testAbsenMandiriToleransiTerlambatDenganKeteranganSuccess();
        $this->testAbsenMandiriTepatWaktuDanLokasiSuccess();
        $this->testAbsenMandiriIzinTanpaKeteranganThrows422();
        $this->testAbsenMandiriIzinDenganKeteranganSuccess();
        $this->testModeInvalidThrows400();
        $this->testSchemaOutputExact14Fields();

        echo "\n==========================================\n";
        echo "HASIL TEST: {$this->passCount} PASSED, {$this->failCount} FAILED\n";
        echo "==========================================\n\n";

        if ($this->failCount > 0) {
            exit(1);
        }
    }

    private function assertCondition($condition, $testName, $detail = '') {
        if ($condition) {
            $this->passCount++;
            echo "[PASS] $testName\n";
        } else {
            $this->failCount++;
            echo "[FAIL] $testName ($detail)\n";
        }
    }

    // 1. Absen Cepat - Role Non Admin
    private function testAbsenCepatNonAdminThrows403() {
        try {
            AbsenHelper::resolveAbsensiRecord(
                'absen_cepat',
                ['role' => 'asn', 'nip' => '198501012010011001'],
                ['nip' => '198501012010011001', 'nama_pegawai' => 'Budi'],
                ['kode_akses' => 'TEST'],
                0, 0, '-', null, '', 'Catatan'
            );
            $this->assertCondition(false, 'Absen Cepat Non-Admin harus throw 403', 'Tidak throw exception');
        } catch (Exception $e) {
            $this->assertCondition($e->getCode() === 403, 'Absen Cepat Non-Admin throw 403', $e->getMessage());
        }
    }

    // 2. Absen Cepat - Keterangan Verifikasi Kosong
    private function testAbsenCepatKeteranganVerifikasiKosongThrows422() {
        try {
            AbsenHelper::resolveAbsensiRecord(
                'absen_cepat',
                ['role' => 'admin', 'nip' => '198001012005011001'],
                ['nip' => '198501012010011001', 'nama_pegawai' => 'Budi'],
                ['kode_akses' => 'TEST'],
                0, 0, '-', null, '', ''
            );
            $this->assertCondition(false, 'Absen Cepat keterangan verifikasi kosong harus throw 422', 'Tidak throw exception');
        } catch (Exception $e) {
            $this->assertCondition($e->getCode() === 422, 'Absen Cepat keterangan verifikasi kosong throw 422', $e->getMessage());
        }
    }

    // 3. Absen Cepat - Sukses Default
    private function testAbsenCepatSuccessDefault() {
        try {
            $res = AbsenHelper::resolveAbsensiRecord(
                'absen_cepat',
                ['role' => 'admin', 'nip' => '198001012005011001'],
                ['nip' => '198501012010011001', 'nama_pegawai' => 'Budi', 'jabatan' => 'Staff', 'opd' => 'BKPSDM'],
                ['kode_akses' => 'APEL01', 'kategori' => 'Apel Pagi'],
                0, 0, '-', null, '', 'Hadir via Cepat'
            );

            $isValid = ($res['status_verifikasi'] === 'Terverifikasi Oleh Admin' &&
                        $res['status_kehadiran'] === 'Hadir' &&
                        $res['nama_file_foto'] === 'NO_PHOTO_ADMIN_FAST_INPUT.jpg' &&
                        $res['keterangan_verifikasi'] === 'Hadir via Cepat' &&
                        $res['keterangan'] === 'Hadir via Cepat');

            $this->assertCondition($isValid, 'Absen Cepat Sukses Default Status & Nilai');
        } catch (Exception $e) {
            $this->assertCondition(false, 'Absen Cepat Sukses Default Status & Nilai', $e->getMessage());
        }
    }

    // 4. Absen Cepat - Sukses Custom Status
    private function testAbsenCepatSuccessCustomStatus() {
        try {
            $res = AbsenHelper::resolveAbsensiRecord(
                'absen_cepat',
                ['role' => 'superadmin', 'nip' => '198001012005011001'],
                ['nip' => '198501012010011001', 'nama_pegawai' => 'Budi', 'jabatan' => 'Staff', 'opd' => 'BKPSDM'],
                ['kode_akses' => 'APEL01', 'kategori' => 'Apel Pagi'],
                0, 0, '-', null, 'Izin atasan langsung', 'Disetujui Admin', 'Izin Atasan', 'Terverifikasi Oleh Admin'
            );

            $isValid = ($res['status_kehadiran'] === 'Izin Atasan' &&
                        $res['keterangan'] === 'Izin atasan langsung' &&
                        $res['keterangan_verifikasi'] === 'Disetujui Admin');

            $this->assertCondition($isValid, 'Absen Cepat Sukses Custom Status Kehadiran & Keterangan');
        } catch (Exception $e) {
            $this->assertCondition(false, 'Absen Cepat Sukses Custom Status Kehadiran & Keterangan', $e->getMessage());
        }
    }

    // 5. Absen Mandiri - Unauthenticated
    private function testAbsenMandiriUnauthenticatedThrows401() {
        try {
            AbsenHelper::resolveAbsensiRecord(
                'absen_mandiri',
                null,
                ['nip' => '198501012010011001'],
                ['kode_akses' => 'APEL01'],
                -0.62, 100.11, 'Lokasi', 'foto_base64', '', ''
            );
            $this->assertCondition(false, 'Absen Mandiri Unauthenticated harus throw 401');
        } catch (Exception $e) {
            $this->assertCondition($e->getCode() === 401, 'Absen Mandiri Unauthenticated throw 401', $e->getMessage());
        }
    }

    // 6. Absen Mandiri - Tanpa Foto
    private function testAbsenMandiriTanpaFotoThrows422() {
        try {
            AbsenHelper::resolveAbsensiRecord(
                'absen_mandiri',
                ['nip' => '198501012010011001', 'role' => 'asn'],
                ['nip' => '198501012010011001'],
                ['kode_akses' => 'APEL01'],
                -0.62, 100.11, 'Lokasi', null, '', ''
            );
            $this->assertCondition(false, 'Absen Mandiri Tanpa Foto harus throw 422');
        } catch (Exception $e) {
            $this->assertCondition($e->getCode() === 422, 'Absen Mandiri Tanpa Foto throw 422', $e->getMessage());
        }
    }

    // 7. Absen Mandiri - Strict Time Violated
    private function testAbsenMandiriStrictTimeViolatedThrows422() {
        try {
            AbsenHelper::resolveAbsensiRecord(
                'absen_mandiri',
                ['nip' => '198501012010011001', 'role' => 'asn'],
                ['nip' => '198501012010011001'],
                [
                    'kode_akses' => 'APEL01',
                    'jam_mulai' => '06:00:00',
                    'jam_selesai' => '07:00:00',
                    'is_strict_time' => 1,
                    'is_strict_location' => 0,
                    'koordinat' => '-0.6267,100.1197',
                    'radius_meter' => 100
                ],
                -0.6267, 100.1197, 'Kantor Walikota', 'data:image/jpeg;base64,abc12345', 'Terlambat macet', ''
            );
            $this->assertCondition(false, 'Absen Mandiri Strict Time harus tolak waktu lewat');
        } catch (Exception $e) {
            $this->assertCondition($e->getCode() === 422, 'Absen Mandiri Strict Time tolak 422', $e->getMessage());
        }
    }

    // 8. Absen Mandiri - Strict Location Violated
    private function testAbsenMandiriStrictLocationViolatedThrows422() {
        try {
            AbsenHelper::resolveAbsensiRecord(
                'absen_mandiri',
                ['nip' => '198501012010011001', 'role' => 'asn'],
                ['nip' => '198501012010011001'],
                [
                    'kode_akses' => 'APEL01',
                    'jam_mulai' => '00:00:00',
                    'jam_selesai' => '23:59:59',
                    'is_strict_time' => 0,
                    'is_strict_location' => 1,
                    'koordinat' => '-0.6267,100.1197',
                    'radius_meter' => 50
                ],
                -0.9000, 100.5000, 'Di Luar Kota', 'data:image/jpeg;base64,abc12345', 'Luar radius', ''
            );
            $this->assertCondition(false, 'Absen Mandiri Strict Location harus tolak luar radius');
        } catch (Exception $e) {
            $this->assertCondition($e->getCode() === 422, 'Absen Mandiri Strict Location tolak 422', $e->getMessage());
        }
    }

    // 9. Absen Mandiri - Toleransi Terlambat/Luar Radius Tanpa Keterangan
    private function testAbsenMandiriToleransiTerlambatTanpaKeteranganThrows422() {
        try {
            AbsenHelper::resolveAbsensiRecord(
                'absen_mandiri',
                ['nip' => '198501012010011001', 'role' => 'asn'],
                ['nip' => '198501012010011001'],
                [
                    'kode_akses' => 'APEL01',
                    'jam_mulai' => '06:00:00',
                    'jam_selesai' => '07:00:00',
                    'is_strict_time' => 0,
                    'is_strict_location' => 0,
                    'koordinat' => '-0.6267,100.1197',
                    'radius_meter' => 100
                ],
                -0.6267, 100.1197, 'Kantor Walikota', 'data:image/jpeg;base64,abc12345', '', ''
            );
            $this->assertCondition(false, 'Absen Mandiri Toleransi tanpa keterangan harus throw 422');
        } catch (Exception $e) {
            $this->assertCondition($e->getCode() === 422, 'Absen Mandiri Toleransi tanpa keterangan throw 422', $e->getMessage());
        }
    }

    // 10. Absen Mandiri - Toleransi Terlambat/Luar Radius Dengan Keterangan
    private function testAbsenMandiriToleransiTerlambatDenganKeteranganSuccess() {
        try {
            $res = AbsenHelper::resolveAbsensiRecord(
                'absen_mandiri',
                ['nip' => '198501012010011001', 'role' => 'asn'],
                ['nip' => '198501012010011001', 'nama_pegawai' => 'Budi', 'jabatan' => 'Staff', 'opd' => 'BKPSDM'],
                [
                    'kode_akses' => 'APEL01',
                    'kategori' => 'Apel Pagi',
                    'jam_mulai' => '06:00:00',
                    'jam_selesai' => '07:00:00',
                    'is_strict_time' => 0,
                    'is_strict_location' => 0,
                    'koordinat' => '-0.6267,100.1197',
                    'radius_meter' => 100
                ],
                -0.6267, 100.1197, 'Kantor Walikota', 'data:image/jpeg;base64,abc12345', 'Ban bocor di jalan', ''
            );

            $isValid = ($res['status_verifikasi'] === 'Menunggu Verifikasi Admin' &&
                        $res['status_kehadiran'] === 'Hadir' &&
                        $res['keterangan'] === 'Ban bocor di jalan');

            $this->assertCondition($isValid, 'Absen Mandiri Toleransi status Menunggu Verifikasi Admin');
        } catch (Exception $e) {
            $this->assertCondition(false, 'Absen Mandiri Toleransi status Menunggu Verifikasi Admin', $e->getMessage());
        }
    }

    // 11. Absen Mandiri - Tepat Waktu & Dalam Radius
    private function testAbsenMandiriTepatWaktuDanLokasiSuccess() {
        try {
            $res = AbsenHelper::resolveAbsensiRecord(
                'absen_mandiri',
                ['nip' => '198501012010011001', 'role' => 'asn'],
                ['nip' => '198501012010011001', 'nama_pegawai' => 'Budi', 'jabatan' => 'Staff', 'opd' => 'BKPSDM'],
                [
                    'kode_akses' => 'APEL01',
                    'kategori' => 'Apel Pagi',
                    'jam_mulai' => '00:00:00',
                    'jam_selesai' => '23:59:59',
                    'is_strict_time' => 0,
                    'is_strict_location' => 0,
                    'koordinat' => '-0.6267,100.1197',
                    'radius_meter' => 500
                ],
                -0.6267, 100.1197, 'Kantor Walikota Pariaman', 'data:image/jpeg;base64,abc12345', '', ''
            );

            $isValid = ($res['status_verifikasi'] === 'Terverifikasi Oleh Sistem' &&
                        $res['status_kehadiran'] === 'Hadir' &&
                        $res['keterangan'] === '-');

            $this->assertCondition($isValid, 'Absen Mandiri Tepat Waktu/Lokasi status Terverifikasi Oleh Sistem & Keterangan Strip');
        } catch (Exception $e) {
            $this->assertCondition(false, 'Absen Mandiri Tepat Waktu/Lokasi status Terverifikasi Oleh Sistem & Keterangan Strip', $e->getMessage());
        }
    }

    // 12. Absen Mandiri - Izin Tanpa Keterangan
    private function testAbsenMandiriIzinTanpaKeteranganThrows422() {
        try {
            AbsenHelper::resolveAbsensiRecord(
                'absen_mandiri',
                ['nip' => '198501012010011001', 'role' => 'asn'],
                ['nip' => '198501012010011001'],
                ['kode_akses' => 'APEL01', 'kategori' => 'Apel Pagi'],
                0, 0, '-', 'data:application/pdf;base64,abc12345', '', '', 'Cuti'
            );
            $this->assertCondition(false, 'Absen Mandiri Izin/Cuti tanpa keterangan harus throw 422');
        } catch (Exception $e) {
            $this->assertCondition($e->getCode() === 422, 'Absen Mandiri Izin/Cuti tanpa keterangan throw 422', $e->getMessage());
        }
    }

    // 13. Absen Mandiri - Izin Dengan Keterangan
    private function testAbsenMandiriIzinDenganKeteranganSuccess() {
        try {
            $res = AbsenHelper::resolveAbsensiRecord(
                'absen_mandiri',
                ['nip' => '198501012010011001', 'role' => 'asn'],
                ['nip' => '198501012010011001', 'nama_pegawai' => 'Budi', 'jabatan' => 'Staff', 'opd' => 'BKPSDM'],
                ['kode_akses' => 'APEL01', 'kategori' => 'Apel Pagi'],
                0, 0, '-', 'data:application/pdf;base64,abc12345', 'Cuti tahunan urusan keluarga', '', 'Cuti'
            );

            $isValid = ($res['status_verifikasi'] === 'Menunggu Verifikasi Admin' &&
                        $res['status_kehadiran'] === 'Cuti' &&
                        $res['keterangan'] === 'Cuti tahunan urusan keluarga');

            $this->assertCondition($isValid, 'Absen Mandiri Izin/Cuti Sukses');
        } catch (Exception $e) {
            $this->assertCondition(false, 'Absen Mandiri Izin/Cuti Sukses', $e->getMessage());
        }
    }

    // 14. Mode Invalid
    private function testModeInvalidThrows400() {
        try {
            AbsenHelper::resolveAbsensiRecord(
                'mode_aneh',
                ['role' => 'admin'],
                [],
                [],
                0, 0, '-', null, '', ''
            );
            $this->assertCondition(false, 'Mode tidak valid harus throw 400');
        } catch (Exception $e) {
            $this->assertCondition($e->getCode() === 400, 'Mode tidak valid throw 400', $e->getMessage());
        }
    }

    // 15. Skema 14 Field Tabel app_absensi_data_absensi
    private function testSchemaOutputExact14Fields() {
        try {
            $res = AbsenHelper::resolveAbsensiRecord(
                'absen_cepat',
                ['role' => 'admin'],
                ['nip' => '198501012010011001', 'nama_pegawai' => 'Budi', 'jabatan' => 'Staff', 'opd' => 'BKPSDM'],
                ['kode_akses' => 'APEL01', 'kategori' => 'Apel Pagi'],
                -0.62, 100.11, 'Pariaman', null, '', 'Catatan Admin'
            );

            $expectedKeys = [
                'kode_akses', 'nip', 'nama_pegawai', 'opd', 'jabatan',
                'kategori', 'waktu', 'lokasi', 'lat', 'lng',
                'nama_file_foto', 'keterangan', 'keterangan_verifikasi',
                'status_verifikasi', 'status_kehadiran'
            ];

            $allKeysExist = true;
            foreach ($expectedKeys as $key) {
                if (!array_key_exists($key, $res)) {
                    $allKeysExist = false;
                    break;
                }
            }

            $this->assertCondition($allKeysExist && count($res) === 15, 'Output Record mencakup seluruh kolom tabel data_absensi');
        } catch (Exception $e) {
            $this->assertCondition(false, 'Output Record mencakup seluruh kolom tabel data_absensi', $e->getMessage());
        }
    }
}

$testRunner = new AbsenHelperTest();
$testRunner->runAllTests();
