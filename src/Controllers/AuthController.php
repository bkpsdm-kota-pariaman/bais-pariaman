<?php
// app_absensi/src/Controllers/AuthController.php

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\Database;
use App\Helpers\AuthHelper;
use Firebase\JWT\JWT;
use PDO;

class AuthController {
    
    public function loginAsn() {
        // 1. Tangkap Payload JSON dari PWA
        $inputJSON = file_get_contents('php://input');
        $input = json_decode($inputJSON, true);

        // Validasi input kosong
        if (!isset($input['nip']) || !isset($input['nik'])) {
            Response::json(false, 400, "NIP dan NIK salah", null);
        }

        $nip = trim($input['nip']);
        $nik = trim($input['nik']);

        // 2. Hubungkan ke Database dan Cari Pegawai
        $db = Database::getConnection();
        
        $sql = "SELECT 
                    p.nama_pegawai, p.nip, p.nik, p.perangkat_daerah, p.jabatan, p.jenis_asn, p.role
                FROM 
                    app_absensi_data_pegawai p
                WHERE p.nip = :nip LIMIT 1";
        $stmt = $db->prepare($sql);
        $stmt->bindParam(':nip', $nip);
        $stmt->execute();
        
        $pegawai = $stmt->fetch();

        // 3. Jika data tidak ditemukan atau password tidak cocok
        $isPasswordMatch = false;
        if ($pegawai) {
            if (password_verify($nik, $pegawai['nik']) || $pegawai['nik'] === $nik) {
                $isPasswordMatch = true;
            }
        }

        if (!$pegawai || !$isPasswordMatch) {
            Response::json(false, 401, "NIP tidak ditemukan atau Password salah", null);
        }

        // Jika login berhasil, perbarui waktu login terakhir
        try {
            $now = new \DateTime('now', new \DateTimeZone('Asia/Jakarta'));
            $waktuSekarang = $now->format('Y-m-d H:i:s');
            
            $updateStmt = $db->prepare("UPDATE app_absensi_data_pegawai SET last_login = :last_login WHERE nip = :nip");
            $updateStmt->execute([
                ':last_login' => $waktuSekarang,
                ':nip' => $pegawai['nip']
            ]);
        } catch (\Exception $e) {
            // Gagal update last_login, biarkan proses login tetap berjalan.
            // Catat error ke log server untuk debugging di kemudian hari.
            error_log("Gagal update last_login untuk NIP " . ($pegawai['nip'] ?? 'N/A') . ": " . $e->getMessage());
        }

        // 4. Jika Valid, Terbitkan Token JWT
        $config = require APP_PATH . '/config/config.php';
        $secretKey = $config['jwt_secret'];
        
        $issuedAt = time();
        // Token berlaku selama 1 bulan (3600 detik * 24 jam * 30 hari)
        $expirationTime = $issuedAt + (3600 * 24 * 30); 
        
        // Tentukan role berdasarkan kolom comma-separated
        $rolesStr = isset($pegawai['role']) ? trim($pegawai['role']) : '';
        $roles = $rolesStr !== '' ? array_map('trim', explode(',', $rolesStr)) : ['asn'];

        // Payload tanpa ID UUID, murni menggunakan data flat hasil import
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

        // Generate Token menggunakan Firebase JWT v5.5 (Kompatibel PHP 7.2)
        $jwtToken = JWT::encode($payload, $secretKey, 'HS256');

        // 5. Kembalikan Response Sukses ke PWA dengan format kaku
        $responseData = [
            'access_token' => $jwtToken
        ];

        Response::json(true, 200, "Login Berhasil", $responseData);
    }

    public function generateTemporaryToken() {
        // 1. Validasi token pengguna saat ini untuk mendapatkan datanya
        $pegawaiData = AuthHelper::validateToken();

        // 2. Buat Compact AES-256-GCM Token dengan prefix BP:
        $config = require APP_PATH . '/config/config.php';
        $secretKey = $config['jwt_secret'];
        $issuedAt = time();
        $expirationTime = $issuedAt + 1800; // Berlaku 30 menit (1800 detik)
        $nip = $pegawaiData['nip'] ?? '';

        if (empty($nip)) {
            Response::json(false, 401, "Waktu login Anda sudah habis. Silahkan login ulang.");
            return;
        }

        $plaintext = $nip . ':' . $expirationTime;
        $key = hash('sha256', $secretKey, true);
        $iv = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, '', 16);
        $combined = $iv . $ciphertext . $tag;
        $base64Url = rtrim(strtr(base64_encode($combined), '+/', '-_'), '=');
        $token = "BP:" . $base64Url;

        Response::json(true, 200, "Token sementara berhasil dibuat", ['access_token' => $token]);
    }

    /**
     * Endpoint internal yang dipanggil oleh Worker untuk mengupdate 'last_login'.
     * Endpoint ini harus dilindungi dengan secret.
     */
    public function updateLastLogin() {
        // 1. Validasi request dari Worker menggunakan shared secret
        $config = require APP_PATH . '/config/config.php';
        $workerSecret = $config['worker_secret'] ?? null;
        $requestSecret = $_SERVER['HTTP_X_WORKER_SECRET'] ?? null;

        if (!$workerSecret || !$requestSecret || $requestSecret !== $workerSecret) {
            Response::json(false, 403, "Akses ditolak. Invalid secret.");
            return;
        }

        // 2. Ambil NIP dari body request
        $inputJSON = file_get_contents('php://input');
        $input = json_decode($inputJSON, true);
        $nip = $input['nip'] ?? null;

        if (!$nip) {
            Response::json(false, 400, "NIP wajib diisi.");
            return;
        }

        // 3. Update 'last_login' di database
        try {
            $db = Database::getConnection();
            $now = new \DateTime('now', new \DateTimeZone('Asia/Jakarta'));
            $updateStmt = $db->prepare("UPDATE app_absensi_data_pegawai SET last_login = :last_login, kv_sync_status = 1 WHERE nip = :nip");
            $updateStmt->execute([':last_login' => $now->format('Y-m-d H:i:s'), ':nip' => $nip]);
            Response::json(true, 200, "Last login berhasil diperbarui.");
        } catch (\Exception $e) {
            Response::json(false, 500, "Gagal memperbarui last_login: " . $e->getMessage());
        }
    }

    /**
     * Otentikasi login Admin/Super Admin
     */
    public function loginAdmin() {
        // 1. Tangkap Payload JSON dari request
        $inputJSON = file_get_contents('php://input');
        $input = json_decode($inputJSON, true);

        // Validasi input kosong
        if (!isset($input['username']) || !isset($input['password'])) {
            Response::json(false, 401, "Username dan Password salah.", null);
        }

        $username = trim($input['username']);
        $password = trim($input['password']);

        // 2. Hubungkan ke Database dan Cari Pegawai
        $db = Database::getConnection();
        
        $stmt = $db->prepare("SELECT nip, nama_pegawai, nik, role FROM app_absensi_data_pegawai WHERE nip = :username LIMIT 1");
        $stmt->bindParam(':username', $username);
        $stmt->execute();
        
        $admin = $stmt->fetch();

        // 3. Jika data tidak ditemukan / tidak cocok
        $isPasswordMatch = false;
        if ($admin) {
            if (password_verify($password, $admin['nik']) || $admin['nik'] === $password) {
                $isPasswordMatch = true;
            }
        }

        if (!$admin || !$isPasswordMatch) {
            Response::json(false, 401, "Username atau Password salah.", null);
        }

        // Cek Role
        $rolesStr = isset($admin['role']) ? trim($admin['role']) : '';
        $roles = $rolesStr !== '' ? array_map('trim', explode(',', $rolesStr)) : ['asn'];

        if (!in_array('admin', $roles) && !in_array('super admin', $roles)) {
            Response::json(false, 403, "Hak akses ditolak.", null);
        }

        // 4. Jika Valid, Terbitkan Token JWT untuk Admin
        $config = require APP_PATH . '/config/config.php';
        $secretKey = $config['jwt_secret'];
        
        $issuedAt = time();
        $expirationTime = $issuedAt + (3600 * 8); // Token admin berlaku selama 8 jam
        
        $payload = [
            'iat' => $issuedAt,
            'exp' => $expirationTime,
            'iss' => 'bais-pariaman-apps-admin',
            'data' => [
                'username' => $admin['nip'], // di admin JS token decode mengharapkan 'username' (atau nip)
                'nama' => $admin['nama_pegawai'],
                'role' => $roles // Array role yang sudah diverifikasi
            ]
        ];

        $jwtToken = JWT::encode($payload, $secretKey, 'HS256');

        // 5. Kembalikan Response Sukses dengan access_token
        Response::json(true, 200, "Login Admin Berhasil", ['access_token' => $jwtToken]);
    }
}