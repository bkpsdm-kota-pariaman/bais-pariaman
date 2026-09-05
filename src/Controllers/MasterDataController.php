<?php
// src/Controllers/MasterDataController.php

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\Database;
use App\Helpers\AuthHelper;
use App\Helpers\AdminAuthHelper;
use App\Helpers\LogHelper;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use PDO;
use DateTime;
use DateTimeZone;

class MasterDataController {

    // =========================================================================
    // 1. PEGAWAI MANAGEMENT (ADMIN)
    // =========================================================================


    public function listPegawai() {
        AdminAuthHelper::validate();
        $db = Database::getConnection();
        
        $opd = $_GET['opd'] ?? '';
        $installStatus = $_GET['install'] ?? 'semua';
        $syncStatus = $_GET['sync'] ?? 'semua'; // Filter baru untuk status sinkronisasi KV
        $search = isset($_GET['search']) ? (string)$_GET['search'] : '';

        $sql = "SELECT p.nama_pegawai, p.nip, p.perangkat_daerah, p.jabatan, p.nik, p.jenis_asn, p.last_login, p.kv_sync_status, p.role
                FROM app_absensi_data_pegawai p";
        
        $conditions = [];
        $params = [];

        if (!empty($opd)) {
            $conditions[] = "p.perangkat_daerah = ?";
            $params[] = $opd;
        }

        if ($installStatus === 'sudah') {
            $conditions[] = "p.last_login IS NOT NULL AND p.last_login != ''";
        } elseif ($installStatus === 'belum') {
            // Use parenthesis for OR condition to be safe
            $conditions[] = "(p.last_login IS NULL OR p.last_login = '')";
        }

        if ($syncStatus === '0' || $syncStatus === '1') {
            $conditions[] = "p.kv_sync_status = ?";
            $params[] = $syncStatus;
        }

        if (!empty($search)) {
            // Penambahan pencarian berdasarkan jabatan
            $conditions[] = "(p.nip LIKE ? OR p.nama_pegawai LIKE ? OR p.jabatan LIKE ?)";
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
        }

        if (count($conditions) > 0) {
            $sql .= " WHERE " . implode(' AND ', $conditions);
        }
        
        $sql .= " ORDER BY p.nama_pegawai ASC";

        // Query hitung total (sebelum LIMIT/OFFSET)
        $countSql = "SELECT COUNT(*) FROM app_absensi_data_pegawai p";
        if (count($conditions) > 0) {
            $countSql .= " WHERE " . implode(' AND ', $conditions);
        }
        $countStmt = $db->prepare($countSql);
        $countStmt->execute($params);
        $totalRows = $countStmt->fetchColumn();

        // Paginasi
        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $limit = isset($_GET['limit']) ? max(1, (int)$_GET['limit']) : 10;
        $offset = ($page - 1) * $limit;

        $sql .= " LIMIT $limit OFFSET $offset";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $pegawai = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $payload = [
            'data' => $pegawai,
            'pagination' => [
                'total_rows' => (int)$totalRows,
                'total_pages' => ceil($totalRows / $limit),
                'current_page' => $page,
                'limit' => $limit
            ]
        ];

        Response::json(true, 200, "Data pegawai berhasil diambil", $payload);
    }

    public function getPegawaiStats() {
        AdminAuthHelper::validate();
        $db = Database::getConnection();

        $stmtTotal = $db->query("SELECT COUNT(*) FROM app_absensi_data_pegawai");
        $totalCount = $stmtTotal->fetchColumn();

        $stmtInstalled = $db->query("SELECT COUNT(*) FROM app_absensi_data_pegawai WHERE last_login IS NOT NULL AND last_login != ''");
        $installedCount = $stmtInstalled->fetchColumn();

        // Yang belum install adalah total dikurangi yang sudah install
        $notInstalledCount = $totalCount - $installedCount;

        $stats = [
            'total' => (int) $totalCount,
            'installed' => (int) $installedCount,
            'not_installed' => (int) $notInstalledCount
        ];

        Response::json(true, 200, "Statistik pegawai berhasil diambil", $stats);
    }

    public function createPegawai() {
        $currentUser = AdminAuthHelper::validate();
        $isSuperAdmin = in_array('super admin', $currentUser['role'] ?? []);
        
        $db = Database::getConnection();
        $input = json_decode(file_get_contents('php://input'), true);

        // Validasi
        if (empty($input['nip']) || empty($input['nama_pegawai']) || empty($input['nik']) || empty($input['perangkat_daerah']) || empty($input['jenis_asn']) || empty($input['role'])) {
            Response::json(false, 400, "Semua field wajib diisi.");
        }

        // Cek duplikat NIP
        $stmtCheck = $db->prepare("SELECT COUNT(*) FROM app_absensi_data_pegawai WHERE nip = :nip");
        $stmtCheck->execute([':nip' => $input['nip']]);
        if ($stmtCheck->fetchColumn() > 0) {
            Response::json(false, 409, "NIP sudah terdaftar.");
        }

        $newRoles = is_array($input['role']) ? $input['role'] : explode(',', $input['role']);
        $newRoles = array_map('trim', $newRoles);
        
        // RBAC Check
        if (!$isSuperAdmin) {
            if (in_array('admin', $newRoles) || in_array('super admin', $newRoles)) {
                Response::json(false, 403, "Hanya Super Admin yang dapat memberikan hak akses Admin atau Super Admin.");
            }
            $newRoles = ['asn'];
        }
        
        // Ensure asn is always present
        if (!in_array('asn', $newRoles)) $newRoles[] = 'asn';

        $rolesStr = implode(',', $newRoles);
        $rawNikInput = (string)trim($input['nik']);
        $hashedNik = (strlen($rawNikInput) === 64 && ctype_xdigit($rawNikInput)) ? strtolower($rawNikInput) : hash('sha256', $rawNikInput);

        $sql = "INSERT INTO app_absensi_data_pegawai (nip, nama_pegawai, nik, perangkat_daerah, jabatan, jenis_asn, role, kv_sync_status) 
                VALUES (:nip, :nama_pegawai, :nik, :perangkat_daerah, :jabatan, :jenis_asn, :role, 0)";
        $stmt = $db->prepare($sql);
        $isSuccess = $stmt->execute([
            ':nip'              => $input['nip'],
            ':nama_pegawai'     => $input['nama_pegawai'],
            ':nik'              => $hashedNik,
            ':perangkat_daerah' => $input['perangkat_daerah'],
            ':jabatan'          => $input['jabatan'] ?? null,
            ':jenis_asn'        => $input['jenis_asn'],
            ':role'             => $rolesStr,
        ]);

        if ($isSuccess) {
            $payloadForKv = [
                'nip' => $input['nip'],
                'nik' => $hashedNik,
                'nama_pegawai' => $input['nama_pegawai'],
                'perangkat_daerah' => $input['perangkat_daerah'],
                'jabatan' => $input['jabatan'] ?? null,
                'jenis_asn' => $input['jenis_asn'],
                'role' => $newRoles
            ];
            $syncSuccess = $this->syncPegawaiToKv('PUT', $input['nip'], $payloadForKv, true);
            if ($syncSuccess) {
                $db->prepare("UPDATE app_absensi_data_pegawai SET kv_sync_status = 1 WHERE nip = :nip")->execute([':nip' => $input['nip']]);
            }

            $message = "Pegawai berhasil ditambahkan.";
            if (!$syncSuccess) { $message .= " Gagal sinkronisasi ke cache."; }
            Response::json(true, 200, $message);
        } else {
            Response::json(false, 500, "Gagal menambahkan pegawai.");
        }
    }

    public function updatePegawai($vars) {
        $currentUser = AdminAuthHelper::validate();
        $isSuperAdmin = in_array('super admin', $currentUser['role'] ?? []);
        
        $db = Database::getConnection();
        $nip = $vars['nip'];
        $input = json_decode(file_get_contents('php://input'), true);

        // Validasi (NIK boleh kosong saat update)
        if (empty($input['nama_pegawai']) || empty($input['perangkat_daerah']) || empty($input['jenis_asn']) || empty($input['role'])) {
            Response::json(false, 400, "Semua field selain NIK wajib diisi.");
        }

        // Ambil data lama
        $stmtCurrent = $db->prepare("SELECT nik, role FROM app_absensi_data_pegawai WHERE nip = :nip");
        $stmtCurrent->execute([':nip' => $nip]);
        $currentPegawai = $stmtCurrent->fetch();

        $rawNikInput = !empty($input['nik']) ? trim($input['nik']) : '';
        if ($rawNikInput !== '') {
            $nikToSave = (strlen($rawNikInput) === 64 && ctype_xdigit($rawNikInput)) ? strtolower($rawNikInput) : hash('sha256', $rawNikInput);
        } else {
            $nikToSave = $currentPegawai['nik'];
        }

        $newRoles = is_array($input['role']) ? $input['role'] : explode(',', $input['role']);
        $newRoles = array_map('trim', $newRoles);
        
        // RBAC Check
        if (!$isSuperAdmin) {
            // Check if they are trying to add admin/super admin
            if (in_array('admin', $newRoles) || in_array('super admin', $newRoles)) {
                // If they didn't have it before, reject
                $oldRoles = explode(',', $currentPegawai['role'] ?? '');
                $oldRoles = array_map('trim', $oldRoles);
                if (!in_array('admin', $oldRoles) && !in_array('super admin', $oldRoles)) {
                     Response::json(false, 403, "Hanya Super Admin yang dapat memberikan hak akses Admin atau Super Admin.");
                } else {
                     // Keep their old admin privileges since this user can't modify them
                     $newRoles = array_unique(array_merge(['asn'], array_intersect($oldRoles, ['admin', 'super admin'])));
                }
            } else {
                // If trying to remove admin roles while not super admin
                $oldRoles = explode(',', $currentPegawai['role'] ?? '');
                $oldRoles = array_map('trim', $oldRoles);
                if (in_array('admin', $oldRoles) || in_array('super admin', $oldRoles)) {
                     $newRoles = array_unique(array_merge(['asn'], array_intersect($oldRoles, ['admin', 'super admin'])));
                } else {
                     $newRoles = ['asn'];
                }
            }
        }
        
        if (!in_array('asn', $newRoles)) $newRoles[] = 'asn';
        $rolesStr = implode(',', $newRoles);

        $sql = "UPDATE app_absensi_data_pegawai 
                SET nama_pegawai = :nama_pegawai, nik = :nik, perangkat_daerah = :perangkat_daerah, jabatan = :jabatan, jenis_asn = :jenis_asn, role = :role, kv_sync_status = 0
                WHERE nip = :nip";
        
        $stmt = $db->prepare($sql);
        $isSuccess = $stmt->execute([
            ':nama_pegawai'     => $input['nama_pegawai'],
            ':nik'              => $nikToSave,
            ':perangkat_daerah' => $input['perangkat_daerah'],
            ':jabatan'          => $input['jabatan'] ?? null,
            ':jenis_asn'        => $input['jenis_asn'],
            ':role'             => $rolesStr,
            ':nip'              => $nip
        ]);

        if (!$isSuccess) {
            Response::json(false, 500, "Gagal memperbarui data pegawai.");
        }

        $payloadForKv = [
            'nip' => $nip, 
            'nik' => $nikToSave,
            'nama_pegawai' => $input['nama_pegawai'],
            'perangkat_daerah' => $input['perangkat_daerah'],
            'jabatan' => $input['jabatan'] ?? null,
            'jenis_asn' => $input['jenis_asn'],
            'role' => $newRoles
        ];
        $syncSuccess = $this->syncPegawaiToKv('PUT', $nip, $payloadForKv, true);
        if ($syncSuccess) {
            $db->prepare("UPDATE app_absensi_data_pegawai SET kv_sync_status = 1 WHERE nip = :nip")->execute([':nip' => $nip]);
        }

        $message = "Data pegawai berhasil diperbarui.";
        if (!$syncSuccess) { $message .= " Gagal sinkronisasi ulang ke cache."; }
        Response::json(true, 200, $message);
    }

    public function deletePegawai($vars) {
        AdminAuthHelper::validate();
        $db = Database::getConnection();
        $nip = $vars['nip'];

        $stmt = $db->prepare("DELETE FROM app_absensi_data_pegawai WHERE nip = :nip");
        $stmt->execute([':nip' => $nip]);

        if ($stmt->rowCount() > 0) {
            // --- LOGIKA BARU: Kirim perintah hapus ke Worker KV (Fire-and-forget) ---
            $this->syncPegawaiToKv('DELETE', $nip);

            Response::json(true, 200, "Pegawai berhasil dihapus.");
        } else {
            Response::json(false, 404, "Pegawai tidak ditemukan atau gagal dihapus.");
        }
    }

    public function syncPegawaiKvCache($vars) {
        AdminAuthHelper::validate();
        $db = Database::getConnection();
        $nip = $vars['nip'] ?? null;

        if (!$nip) {
            Response::json(false, 400, "NIP wajib diisi.");
            return;
        }

        // 1. Ambil data pegawai terbaru dari DB untuk memastikan data di KV adalah yang paling mutakhir.
        $stmtPegawai = $db->prepare("SELECT nip, nik, nama_pegawai, perangkat_daerah, jabatan, jenis_asn, role FROM app_absensi_data_pegawai WHERE nip = :nip");
        $stmtPegawai->execute([':nip' => $nip]);
        $pegawai = $stmtPegawai->fetch(PDO::FETCH_ASSOC);

        if (!$pegawai) {
            Response::json(false, 404, "Pegawai dengan NIP $nip tidak ditemukan di database.");
            return;
        }

        $rolesStr = isset($pegawai['role']) ? trim($pegawai['role']) : '';
        $roles = $rolesStr !== '' ? array_map('trim', explode(',', $rolesStr)) : ['asn'];

        $payloadForKv = [
            'nip' => $pegawai['nip'],
            'nik' => $pegawai['nik'],
            'nama_pegawai' => $pegawai['nama_pegawai'],
            'perangkat_daerah' => $pegawai['perangkat_daerah'],
            'jabatan' => $pegawai['jabatan'],
            'jenis_asn' => $pegawai['jenis_asn'],
            'role' => $roles // Menggunakan role yang sudah dicek
        ];

        // 3. Trigger a BLOCKING sync process and wait for the result.
        $syncSuccess = $this->syncPegawaiToKv('PUT', $nip, $payloadForKv, true);

        if ($syncSuccess) {
            try {
                $stmt = $db->prepare("UPDATE app_absensi_data_pegawai SET kv_sync_status = 1 WHERE nip = :nip");
                $stmt->execute([':nip' => $nip]);
                Response::json(true, 200, "Cache berhasil disinkronkan dengan Cloudflare KV.");
            } catch (\Exception $e) {
                // This is an edge case where the sync worked but the DB update failed.
                Response::json(false, 500, "Sinkronisasi berhasil, tetapi gagal mengupdate status di database: " . $e->getMessage());
            }
        } else {
            Response::json(false, 503, "Gagal menyinkronkan cache. Cloudflare KV mungkin sedang sibuk atau tidak dapat dijangkau. Coba lagi nanti.");
        }
    }


    /**
     * Menjalankan permintaan ke Cloudflare Worker untuk menyinkronkan (PUT/DELETE) cache KV.
     * Dapat berjalan dalam mode fire-and-forget atau blocking.
     *
     * @param string $method Metode HTTP (PUT atau DELETE).
     * @param string $nip NIP pegawai yang cache-nya akan disinkronkan.
     * @param array|null $payload Data yang akan dikirim (untuk PUT).
     * @param bool $waitForResponse Jika true, akan menunggu respons dari worker. Jika false, berjalan di latar belakang.
     * @return bool|void Mengembalikan boolean jika $waitForResponse true, void jika false.
     */
    private function syncPegawaiToKv($method, $nip, $payload = null, $waitForResponse = false) {
        $config = require APP_PATH . '/config/config.php';
        $workerUrl = $config['worker_url'] ?? null;
        $workerSecret = $config['worker_secret'] ?? null;

        if (!$workerUrl || !$workerSecret || !$nip) {
            error_log("[Pegawai KV Sync] Gagal: Konfigurasi Worker URL/secret atau NIP tidak ada untuk NIP: " . $nip);
            return $waitForResponse ? false : null;
        }

        $url = rtrim($workerUrl, '/') . '/api/pegawai/' . $nip;

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'X-Worker-Secret: ' . $workerSecret
        ]);

        if ($waitForResponse) {
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        } else {
            curl_setopt($ch, CURLOPT_TIMEOUT_MS, 500);
        }

        if ($payload !== null && $method === 'PUT') {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        }

        $responseBody = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErrorNo = curl_errno($ch);
        $curlErrorMsg = curl_error($ch);
        curl_close($ch);

        if ($waitForResponse) {
            if ($curlErrorNo === 0 && $httpCode >= 200 && $httpCode < 300) {
                return true; // Sukses
            }
            error_log("[Blocking Pegawai KV Sync] Gagal untuk NIP $nip. HTTP Code: $httpCode, cURL Error: $curlErrorMsg");
            return false; // Gagal
        } elseif ($curlErrorNo !== 0 && $curlErrorNo !== CURLE_OPERATION_TIMEDOUT) {
            error_log("[Fire-and-forget Pegawai KV Sync] cURL error untuk NIP $nip: " . $curlErrorMsg);
        }
    }


    // =========================================================================
    // 2. OPD MANAGEMENT (ADMIN & PUBLIC)
    // =========================================================================


    public function listOpd() {
        AdminAuthHelper::validate();
        $db = Database::getConnection();
        // Mengambil nama_opd dan mengaliaskannya sebagai 'id' agar sesuai dengan ekspektasi frontend
        $stmt = $db->query("SELECT nama_opd, nama_opd as id FROM app_absensi_list_opd ORDER BY nama_opd ASC");
        $opdList = $stmt->fetchAll(PDO::FETCH_ASSOC);
        Response::json(true, 200, "OK", $opdList);
    }

    public function createOpd() {
        AdminAuthHelper::validate();
        $input = json_decode(file_get_contents('php://input'), true);
        $namaOpd = $input['nama_opd'] ?? null;

        if (empty($namaOpd)) {
            Response::json(false, 400, "Nama OPD wajib diisi.");
            return;
        }

        $db = Database::getConnection();
        
        // Cek duplikat
        $stmtCheck = $db->prepare("SELECT COUNT(*) FROM app_absensi_list_opd WHERE nama_opd = ?");
        $stmtCheck->execute([$namaOpd]);
        if ($stmtCheck->fetchColumn() > 0) {
            Response::json(false, 409, "Nama OPD sudah ada.");
            return;
        }

        $stmt = $db->prepare("INSERT INTO app_absensi_list_opd (nama_opd) VALUES (?)");
        if ($stmt->execute([$namaOpd])) {
            Response::json(true, 200, "OPD berhasil ditambahkan.");
        } else {
            Response::json(false, 500, "Gagal menambahkan OPD ke database.");
        }
    }

    public function updateOpd($vars) {
        AdminAuthHelper::validate();
        $oldNamaOpd = $vars['id'] ?? null;
        $input = json_decode(file_get_contents('php://input'), true);
        $newNamaOpd = $input['nama_opd'] ?? null;

        if (empty($oldNamaOpd) || empty($newNamaOpd)) {
            Response::json(false, 400, "Nama OPD lama dan baru wajib diisi.");
            return;
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("UPDATE app_absensi_list_opd SET nama_opd = ? WHERE nama_opd = ?");
        if ($stmt->execute([$newNamaOpd, $oldNamaOpd])) {
            Response::json(true, 200, "OPD berhasil diperbarui.");
        } else {
            Response::json(false, 500, "Gagal memperbarui OPD.");
        }
    }

    public function deleteOpd($vars) {
        AdminAuthHelper::validate();
        $namaOpd = $vars['id'] ?? null;
        if (empty($namaOpd)) {
            Response::json(false, 400, "Nama OPD wajib diisi.");
            return;
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("DELETE FROM app_absensi_list_opd WHERE nama_opd = ?");
        if ($stmt->execute([$namaOpd])) {
            Response::json(true, 200, "OPD berhasil dihapus.");
        } else {
            Response::json(false, 500, "Gagal menghapus OPD.");
        }
    }
    
    public function syncOpdToKv() {
        AdminAuthHelper::validate();
        $db = Database::getConnection();

        $stmt = $db->query("SELECT nama_opd FROM app_absensi_list_opd ORDER BY nama_opd ASC");
        $opdList = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);

        if ($opdList === false) {
            Response::json(false, 500, "Gagal mengambil daftar OPD dari database.");
            return;
        }

        $syncSuccess = $this->syncOpdListToKv('PUT', $opdList, true);

        if ($syncSuccess) {
            Response::json(true, 200, "Daftar OPD berhasil disinkronkan ke cache (KV).");
        } else {
            Response::json(false, 503, "Gagal menyinkronkan cache. Worker mungkin sibuk atau tidak dapat dijangkau.");
        }
    }

    private function syncOpdListToKv($method, $payload = null, $waitForResponse = false) {
        $config = require APP_PATH . '/config/config.php';
        $workerUrl = $config['worker_url'] ?? null;
        $workerSecret = $config['worker_secret'] ?? null;

        if (!$workerUrl || !$workerSecret) {
            error_log("[OPD List KV Sync] Gagal: Konfigurasi Worker URL/secret tidak ada.");
            return $waitForResponse ? false : null;
        }

        $url = rtrim($workerUrl, '/') . '/api/opd-list/sync';

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'X-Worker-Secret: ' . $workerSecret]);

        if ($waitForResponse) {
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        } else {
            curl_setopt($ch, CURLOPT_TIMEOUT_MS, 500);
        }

        if ($payload !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        }

        curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErrorNo = curl_errno($ch);
        curl_close($ch);

        return $curlErrorNo === 0 && $httpCode >= 200 && $httpCode < 300;
    }



    
    /**
     * Mengambil seluruh list OPD dari tabel master.
     * Endpoint ini dilindungi dan memerlukan token JWT.
     */
    public function getListOpdPublic() {
        // Memvalidasi token, hanya user yang sudah login yang bisa mengakses
        AuthHelper::validateToken();

        $db = Database::getConnection();
        
        // Query untuk mengambil semua nama_opd dari tabel master, diurutkan berdasarkan abjad
        $stmt = $db->prepare("SELECT nama_opd FROM app_absensi_list_opd ORDER BY nama_opd ASC");
        $stmt->execute();
        
        $listOpd = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);

        // Kembalikan response sukses dengan data list OPD dalam bentuk array
        Response::json(true, 200, "List OPD berhasil diambil", $listOpd);
    }


    // =========================================================================
    // 3. PROFIL USER (ASN)
    // =========================================================================

    
    public function refreshProfil() {
        $pegawaiData = AuthHelper::validateToken();
        $nip = $pegawaiData['nip'];

        $db = Database::getConnection();
        $sql = "SELECT 
                    p.nama_pegawai, p.nip, p.nik, p.perangkat_daerah, p.jabatan, p.jenis_asn, p.role
                FROM 
                    app_absensi_data_pegawai p
                WHERE p.nip = :nip LIMIT 1";
        $stmt = $db->prepare($sql);
        $stmt->bindParam(':nip', $nip);
        $stmt->execute();
        
        $pegawai = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$pegawai) {
            Response::json(false, 404, "Data pegawai tidak ditemukan di database.", null);
            return;
        }

        // Tentukan role berdasarkan kolom comma-separated
        $rolesStr = isset($pegawai['role']) ? trim($pegawai['role']) : '';
        $roles = $rolesStr !== '' ? array_map('trim', explode(',', $rolesStr)) : ['asn'];

        // Siapkan payload untuk di-cache oleh worker.
        $payloadForCache = [
            'nip' => $pegawai['nip'], 'nik' => $pegawai['nik'],
            'nama_pegawai' => $pegawai['nama_pegawai'], 'perangkat_daerah' => $pegawai['perangkat_daerah'],
            'jabatan' => $pegawai['jabatan'],
            'role' => $roles,
            'jenis_asn' => $pegawai['jenis_asn']
        ];

        $config = require APP_PATH . '/config/config.php';
        $secretKey = $config['jwt_secret'];
        $issuedAt = time();
        $expirationTime = $issuedAt + (3600 * 24 * 30); 
        
        $payload = [
            'iat' => $issuedAt,
            'exp' => $expirationTime,
            'iss' => 'bais-pariaman-apps',
            'data' => [
                'nip' => $pegawai['nip'],
                'nama' => $pegawai['nama_pegawai'],
                'opd' => $pegawai['perangkat_daerah'],
                'jabatan' => $pegawai['jabatan'],
                'role' => $roles,
                'jenis_asn' => $pegawai['jenis_asn']
            ]
        ];

        $jwtToken = JWT::encode($payload, $secretKey, 'HS256');

        $responseData = [
            'access_token' => $jwtToken
        ];

        Response::json(true, 200, "Profil berhasil disinkronkan.", $responseData);
    }

    public function refreshToken() {
        try {
            $pegawaiData = AuthHelper::validateToken();
            $nip = $pegawaiData['nip'];

            $db = Database::getConnection();
            $sql = "SELECT 
                        p.nama_pegawai, p.nip, p.perangkat_daerah, p.jabatan, p.jenis_asn, p.role
                    FROM 
                        app_absensi_data_pegawai p
                    WHERE p.nip = :nip LIMIT 1";
            $stmt = $db->prepare($sql);
            $stmt->bindParam(':nip', $nip);
            $stmt->execute();
            
            $pegawai = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$pegawai) {
                LogHelper::write('warning', "Refresh token gagal: Pegawai dengan NIP '{$nip}' tidak ditemukan di database.", ['nip' => $nip]);
                Response::json(false, 404, "Data pegawai tidak ditemukan di database.", null);
                return;
            }

            $rolesStr = isset($pegawai['role']) ? trim($pegawai['role']) : '';
            $roles = $rolesStr !== '' ? array_map('trim', explode(',', $rolesStr)) : ['asn'];

            $config = require APP_PATH . '/config/config.php';
            $secretKey = $config['jwt_secret'];
            $issuedAt = time();
            $expirationTime = $issuedAt + (3600 * 24 * 30); 

            $payload = [
                'iat' => $issuedAt,
                'exp' => $expirationTime,
                'iss' => 'bais-pariaman-apps',
                'data' => [
                    'nip' => $pegawai['nip'],
                    'nama' => $pegawai['nama_pegawai'],
                    'opd' => $pegawai['perangkat_daerah'],
                    'jabatan' => $pegawai['jabatan'],
                    'role' => $roles,
                    'jenis_asn' => $pegawai['jenis_asn'] ?? null
                ]
            ];

            $jwtToken = JWT::encode($payload, $secretKey, 'HS256');

            $responseData = [
                'access_token' => $jwtToken,
            ];

            Response::json(true, 200, "Token berhasil diperbarui.", $responseData);
        } catch (\Exception $e) {
            $nipForLog = isset($pegawaiData['nip']) ? $pegawaiData['nip'] : 'N/A';
            LogHelper::write('error', "Refresh token gagal karena exception: " . $e->getMessage(), [
                'nip' => $nipForLog,
                'exception_trace' => $e->getTraceAsString()
            ]);
            Response::json(false, 500, "Terjadi kesalahan internal saat mencoba memperbarui token.");
        }
    }

    public function updateProfil() {
        $pegawaiData = AuthHelper::validateToken();
        $nip = $pegawaiData['nip'];
        $db = Database::getConnection();

        // --- LOGIKA BARU: Batasi update profil sekali sebulan (kecuali role admin / super admin) ---
        $stmtCheck = $db->prepare("SELECT updated_at, nik, nama_pegawai, jenis_asn FROM app_absensi_data_pegawai WHERE nip = :nip");
        $stmtCheck->execute([':nip' => $nip]);
        $pegawaiDbData = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        $lastUpdateString = $pegawaiDbData['updated_at'] ?? null;

        $userRoles = isset($pegawaiData['role']) ? (array) $pegawaiData['role'] : ['asn'];
        $userRoles = array_map('strtolower', array_map('trim', $userRoles));
        $isAdminOrSuperAdmin = in_array('admin', $userRoles) || in_array('super admin', $userRoles);

        if (!$isAdminOrSuperAdmin && !empty($lastUpdateString) && $lastUpdateString !== '0000-00-00 00:00:00' && strtolower((string)$lastUpdateString) !== 'null') {
            try {
                $now = new DateTime('now', new DateTimeZone('Asia/Jakarta'));
                $lastUpdate = new DateTime($lastUpdateString, new DateTimeZone('Asia/Jakarta'));
                
                $nextAllowedUpdate = (clone $lastUpdate)->modify('+1 month');

                if ($now < $nextAllowedUpdate) {
                    Response::json(false, 429, "Anda hanya dapat mengubah profil sekali dalam sebulan. Perubahan berikutnya dapat dilakukan setelah " . $nextAllowedUpdate->format('d F Y') . ". Hubungi BKPSDM Kota Pariaman jika perlu perubahan mendesak.");
                    return;
                }
            } catch (\Exception $e) {
                // Abaikan jika ada error parsing tanggal, biarkan user melanjutkan.
            }
        }
        // --- AKHIR LOGIKA BARU ---

        $inputJSON = file_get_contents('php://input');
        $input = json_decode($inputJSON, true);

        // Menangkap field jabatan dan perangkat daerah dari payload PWA
        $jabatanBaru = isset($input['jabatan']) ? trim($input['jabatan']) : null;
        $opdBaru = isset($input['perangkat_daerah']) ? trim($input['perangkat_daerah']) : null;

        if (!$jabatanBaru && !$opdBaru) {
            Response::json(false, 400, "Tidak ada data yang dikirim untuk diubah.", null);
            return;
        }
        
        // --- BLOK VALIDASI MASTER OPD ---
        if ($opdBaru) {
            $stmtOpd = $db->prepare("SELECT nama_opd FROM app_absensi_list_opd WHERE nama_opd = :opd LIMIT 1");
            $stmtOpd->bindParam(':opd', $opdBaru);
            $stmtOpd->execute();
            
            if (!$stmtOpd->fetch()) {
                // Jika OPD yang dikirim tidak ada di tabel master, tolak request!
                Response::json(false, 400, "Perangkat Daerah tidak valid atau tidak terdaftar di sistem.", null);
                return;
            }
        }
        
        $updates = [];
        $params = [];
        if ($jabatanBaru) {
            $updates[] = "jabatan = :jabatan";
            $params[':jabatan'] = $jabatanBaru;
        }
        if ($opdBaru) {
            $updates[] = "perangkat_daerah = :opd";
            $params[':opd'] = $opdBaru;
        }
        
        // Tambahkan timestamp update profil ke dalam query
        $now = new DateTime('now', new DateTimeZone('Asia/Jakarta'));
        $updates[] = "updated_at = :updated_at";
        // Set awal sebagai belum sinkron
        $updates[] = "kv_sync_status = 0";
        $params[':updated_at'] = $now->format('Y-m-d H:i:s');

        $params[':nip'] = $nip;
        
        $sql = "UPDATE app_absensi_data_pegawai SET " . implode(', ', $updates) . " WHERE nip = :nip";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        // --- LOGIKA BARU: Lakukan sinkronisasi SETELAH menulis ke DB ---
        $payloadForKv = [
            'nip' => $nip,
            'nik' => $pegawaiDbData['nik'],
            'nama_pegawai' => $pegawaiDbData['nama_pegawai'],
            'perangkat_daerah' => $opdBaru ?: $pegawaiData['opd'],
            'jabatan' => $jabatanBaru ?: $pegawaiData['jabatan'],
            'jenis_asn' => $pegawaiDbData['jenis_asn'],
            'role' => $pegawaiData['role'] ?? ['asn']
        ];
        $syncSuccess = $this->syncPegawaiToKv('PUT', $nip, $payloadForKv, true);
        
        if ($syncSuccess) {
            $db->prepare("UPDATE app_absensi_data_pegawai SET kv_sync_status = 1 WHERE nip = :nip")->execute([':nip' => $nip]);
        }

        $config = require APP_PATH . '/config/config.php';
        $secretKey = $config['jwt_secret'];
        $issuedAt = time();
        $expirationTime = $issuedAt + (3600 * 24 * 30);

        $payloadForToken = [
            'iat' => $issuedAt,
            'exp' => $expirationTime,
            'iss' => 'bais-pariaman-apps',
            'data' => [
                'nip' => $payloadForKv['nip'],
                'nama' => $payloadForKv['nama_pegawai'],
                'opd' => $payloadForKv['perangkat_daerah'],
                'jabatan' => $payloadForKv['jabatan'],
                'role' => $payloadForKv['role'],
                'jenis_asn' => $payloadForKv['jenis_asn']
            ]
        ];

        $jwtToken = JWT::encode($payloadForToken, $secretKey, 'HS256');

        $responseData = [
            'access_token' => $jwtToken
        ];

        $message = "Profil berhasil diperbarui.";
        if (!$syncSuccess) { $message .= " Gagal sinkronisasi ke cache."; }

        Response::json(true, 200, $message, $responseData);
    }
}
