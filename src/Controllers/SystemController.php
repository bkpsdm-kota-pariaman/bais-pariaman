<?php
// src/Controllers/SystemController.php

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\Database;
use App\Helpers\AdminAuthHelper;
use PDO;

class SystemController {

    /**
     * [Public API] Healthcheck / Ping test API.
     */
    public function ping() {
        Response::json(true, 200, "API Siap Digunakan", ['timestamp' => time()]);
    }

    // =========================================================================
    // PENGATURAN APLIKASI & WORKER KV CACHE
    // =========================================================================


    public function getLinkAbsensiCadangan() {
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT nilai_pengaturan FROM app_absensi_pengaturan_aplikasi WHERE kode_pengaturan = 'link_absensi_cadangan' LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        $link = (!empty($row) && isset($row['nilai_pengaturan']) && trim($row['nilai_pengaturan']) !== '') ? trim($row['nilai_pengaturan']) : null;

        if (!$link) {
            Response::json(false, 404, "Pengaturan link absensi cadangan tidak ditemukan di database.", null);
            return;
        }

        Response::json(true, 200, "Link absensi cadangan berhasil diambil.", [
            'link_absensi_cadangan' => $link
        ]);
    }

    /**
     * [Public Redirect] Melakukan HTTP 302 redirect langsung ke link absensi cadangan.
     */
    public function redirectAbsensiCadangan() {
        $db = Database::getConnection();
        try {
            $stmt = $db->prepare("SELECT nilai_pengaturan FROM app_absensi_pengaturan_aplikasi WHERE kode_pengaturan = 'link_absensi_cadangan' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $link = (!empty($row) && isset($row['nilai_pengaturan']) && trim($row['nilai_pengaturan']) !== '') ? trim($row['nilai_pengaturan']) : null;
        } catch (\Exception $e) {
            $link = null;
        }

        if (!$link) {
            Response::json(false, 404, "Pengaturan link absensi cadangan tidak ditemukan di database.", null);
            return;
        }

        header("Location: " . $link, true, 302);
        exit;
    }

    /**
     * [Admin API] Mengambil seluruh daftar pengaturan aplikasi (Super Admin Only).
     */
    public function getPengaturanList() {
        $adminData = AdminAuthHelper::validate();
        $roles = isset($adminData['role']) ? (array) $adminData['role'] : [];
        if (!in_array('super admin', $roles)) {
            Response::json(false, 403, "Hak akses ditolak.");
            return;
        }

        $db = Database::getConnection();

        $stmt = $db->query("SELECT id, kode_pengaturan, nama_pengaturan, nilai_pengaturan FROM app_absensi_pengaturan_aplikasi ORDER BY id ASC");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::json(true, 200, "Berhasil mengambil pengaturan aplikasi.", $rows);
    }

    /**
     * [Admin API] Memperbarui / Menambah pengaturan aplikasi & sinkronisasi ke Worker KV (Super Admin Only).
     * Tidak ada fitur hapus pengaturan.
     */
    public function updatePengaturan() {
        $adminData = AdminAuthHelper::validate();
        $roles = isset($adminData['role']) ? (array) $adminData['role'] : [];
        if (!in_array('super admin', $roles)) {
            Response::json(false, 403, "Hak akses ditolak.");
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !is_array($input)) {
            Response::json(false, 400, "Payload data pengaturan tidak valid.");
            return;
        }

        $db = Database::getConnection();

        $sanitizedMap = [];

        try {
            $db->beginTransaction();

            // Jika payload adalah single item pengaturan (Tambah / Edit 1 item)
            if (isset($input['kode_pengaturan']) || isset($input['nama_pengaturan'])) {
                $kode = trim($input['kode_pengaturan'] ?? '');
                $nama = trim($input['nama_pengaturan'] ?? '');
                $nilai = is_null($input['nilai_pengaturan'] ?? null) ? '' : trim((string)$input['nilai_pengaturan']);

                if (empty($kode)) {
                    $db->rollBack();
                    Response::json(false, 400, "Kode pengaturan wajib diisi.");
                    return;
                }
                if (empty($nama)) {
                    $db->rollBack();
                    Response::json(false, 400, "Nama pengaturan (caption) wajib diisi.");
                    return;
                }

                // Normalisasi format kode_pengaturan (lowercase, alphanumeric, underscore, hyphen)
                $kode = strtolower(preg_replace('/[^a-zA-Z0-9_-]/', '_', $kode));

                $stmt = $db->prepare("INSERT INTO app_absensi_pengaturan_aplikasi (kode_pengaturan, nama_pengaturan, nilai_pengaturan) 
                                      VALUES (:kode, :nama, :nilai) 
                                      ON DUPLICATE KEY UPDATE nama_pengaturan = :nama2, nilai_pengaturan = :nilai2");
                $stmt->execute([
                    ':kode' => $kode,
                    ':nama' => $nama,
                    ':nilai' => $nilai,
                    ':nama2' => $nama,
                    ':nilai2' => $nilai
                ]);

                $sanitizedMap[$kode] = $nilai;

            } else {
                // Jika payload berbentuk key-value map (misal batch update)
                $stmt = $db->prepare("INSERT INTO app_absensi_pengaturan_aplikasi (kode_pengaturan, nama_pengaturan, nilai_pengaturan) 
                                      VALUES (:kode, :nama, :nilai) 
                                      ON DUPLICATE KEY UPDATE nilai_pengaturan = :nilai2");

                foreach ($input as $key => $val) {
                    $kodeSanitized = strtolower(trim($key));
                    $valSanitized = is_null($val) ? '' : trim((string)$val);
                    // Nama caption default dari kode format ucwords
                    $namaCaption = ucwords(str_replace(['_', '-'], ' ', $kodeSanitized));

                    $stmt->execute([
                        ':kode' => $kodeSanitized,
                        ':nama' => $namaCaption,
                        ':nilai' => $valSanitized,
                        ':nilai2' => $valSanitized
                    ]);
                    $sanitizedMap[$kodeSanitized] = $valSanitized;
                }
            }

            $db->commit();
        } catch (\Exception $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            Response::json(false, 500, "Gagal menyimpan pengaturan aplikasi ke database.");
            return;
        }

        // Sinkronkan seluruh pengaturan ke Cloudflare Worker KV (seumur hidup tanpa batas waktu)
        $kvSynced = $this->syncPengaturanToKv($sanitizedMap);

        Response::json(true, 200, "Pengaturan aplikasi berhasil disimpan dan " . ($kvSynced ? "tersinkron ke Worker KV." : "disimpan di database."));
    }

    /**
     * [Admin API] Menghapus satu item pengaturan aplikasi dan sinkronisasi ke Worker KV (Super Admin Only).
     */
    public function deletePengaturan($vars) {
        $adminData = AdminAuthHelper::validate();
        $roles = isset($adminData['role']) ? (array) $adminData['role'] : [];
        if (!in_array('super admin', $roles)) {
            Response::json(false, 403, "Hak akses ditolak.");
            return;
        }

        $kode = strtolower(trim($vars['kode'] ?? ''));
        if (empty($kode)) {
            Response::json(false, 400, "Kode pengaturan tidak valid.");
            return;
        }

        $db = Database::getConnection();

        $stmt = $db->prepare("DELETE FROM app_absensi_pengaturan_aplikasi WHERE kode_pengaturan = :kode");
        $stmt->execute([':kode' => $kode]);

        if ($stmt->rowCount() > 0) {
            // Hapus juga kunci dari Cloudflare Worker KV
            $kvDeleted = $this->deletePengaturanFromKv($kode);
            Response::json(true, 200, "Pengaturan '{$kode}' berhasil dihapus " . ($kvDeleted ? "dan disinkronkan ke Worker KV." : "dari database."));
        } else {
            Response::json(false, 404, "Pengaturan '{$kode}' tidak ditemukan di database.");
        }
    }

    /**
     * [Admin API] Sinkronisasi manual seluruh tabel pengaturan ke Worker KV (Super Admin Only).
     */
    public function syncKvCache() {
        $adminData = AdminAuthHelper::validate();
        $roles = isset($adminData['role']) ? (array) $adminData['role'] : [];
        if (!in_array('super admin', $roles)) {
            Response::json(false, 403, "Hak akses ditolak.");
            return;
        }

        $db = Database::getConnection();

        $stmt = $db->query("SELECT kode_pengaturan, nilai_pengaturan FROM app_absensi_pengaturan_aplikasi");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $settings = [];
        foreach ($rows as $r) {
            $settings[$r['kode_pengaturan']] = $r['nilai_pengaturan'];
        }

        $syncSuccess = $this->syncPengaturanToKv($settings);
        if ($syncSuccess) {
            Response::json(true, 200, "Pengaturan aplikasi berhasil disinkronkan ke Worker KV seumur hidup.");
        } else {
            Response::json(false, 503, "Gagal menyinkronkan pengaturan ke Worker KV. Periksa koneksi worker.");
        }
    }

    /**
     * Helper cURL untuk mengirim payload pengaturan ke Cloudflare Worker KV.
     */
    private function syncPengaturanToKv(array $payload) {
        $config = require APP_PATH . '/config/config.php';
        $workerUrl = $config['worker_url'] ?? null;
        $workerSecret = $config['worker_secret'] ?? null;

        if (!$workerUrl || !$workerSecret) {
            error_log("[Pengaturan KV Sync] Gagal: Konfigurasi Worker URL/secret tidak ada.");
            return false;
        }

        $url = rtrim($workerUrl, '/') . '/api/pengaturan/sync';

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'X-Worker-Secret: ' . $workerSecret
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

        curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErrorNo = curl_errno($ch);
        curl_close($ch);

        return $curlErrorNo === 0 && $httpCode >= 200 && $httpCode < 300;
    }

    /**
     * Helper cURL untuk menghapus satu key pengaturan dari Cloudflare Worker KV.
     */
    private function deletePengaturanFromKv(string $kode) {
        $config = require APP_PATH . '/config/config.php';
        $workerUrl = $config['worker_url'] ?? null;
        $workerSecret = $config['worker_secret'] ?? null;

        if (!$workerUrl || !$workerSecret) {
            error_log("[Pengaturan KV Delete] Gagal: Konfigurasi Worker URL/secret tidak ada.");
            return false;
        }

        $url = rtrim($workerUrl, '/') . '/api/pengaturan/' . urlencode($kode);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'X-Worker-Secret: ' . $workerSecret
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);

        curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErrorNo = curl_errno($ch);
        curl_close($ch);

        return $curlErrorNo === 0 && $httpCode >= 200 && $httpCode < 300;
    }

}
