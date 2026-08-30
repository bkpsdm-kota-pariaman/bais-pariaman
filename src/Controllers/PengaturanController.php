<?php
// src/Controllers/PengaturanController.php

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\Database;
use App\Helpers\AdminAuthHelper;
use PDO;

class PengaturanController {

    /**
     * Memastikan tabel pengaturan aplikasi sudah ada di database.
     */
    private function ensureTableExists(PDO $db) {
        $db->exec("CREATE TABLE IF NOT EXISTS `app_absensi_pengaturan_aplikasi` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `nama_pengaturan` varchar(100) NOT NULL UNIQUE,
            `nilai_pengaturan` text DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_nama_pengaturan` (`nama_pengaturan`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
    }

    /**
     * [Public API] Mengambil URL link absensi cadangan yang aktif.
     */
    public function getLinkAbsensiCadangan() {
        $db = Database::getConnection();
        $this->ensureTableExists($db);

        $stmt = $db->prepare("SELECT nilai_pengaturan FROM app_absensi_pengaturan_aplikasi WHERE nama_pengaturan = 'link_absensi_cadangan' LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        $defaultLink = 'https://script.google.com/macros/s/AKfycbxGeScmNpeAOHnBd_s39KxtZPhgL5nwvoR6pO8-uXpXl8RSi0YgUTupTeDJR4AErx2Z/exec';
        $link = (!empty($row) && !empty($row['nilai_pengaturan'])) ? trim($row['nilai_pengaturan']) : $defaultLink;

        Response::json(true, 200, "OK", [
            'link_absensi_cadangan' => $link
        ]);
    }

    /**
     * [Public Redirect] Melakukan HTTP 302 redirect langsung ke link absensi cadangan.
     */
    public function redirectAbsensiCadangan() {
        $db = Database::getConnection();
        try {
            $this->ensureTableExists($db);
            $stmt = $db->prepare("SELECT nilai_pengaturan FROM app_absensi_pengaturan_aplikasi WHERE nama_pengaturan = 'link_absensi_cadangan' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $defaultLink = 'https://script.google.com/macros/s/AKfycbxGeScmNpeAOHnBd_s39KxtZPhgL5nwvoR6pO8-uXpXl8RSi0YgUTupTeDJR4AErx2Z/exec';
            $link = (!empty($row) && !empty($row['nilai_pengaturan'])) ? trim($row['nilai_pengaturan']) : $defaultLink;
        } catch (\Exception $e) {
            $link = 'https://script.google.com/macros/s/AKfycbxGeScmNpeAOHnBd_s39KxtZPhgL5nwvoR6pO8-uXpXl8RSi0YgUTupTeDJR4AErx2Z/exec';
        }

        header("Location: " . $link, true, 302);
        exit;
    }

    /**
     * [Admin API] Mengambil seluruh daftar pengaturan aplikasi.
     */
    public function getPengaturanList() {
        AdminAuthHelper::validate();

        $db = Database::getConnection();
        $this->ensureTableExists($db);

        $stmt = $db->query("SELECT nama_pengaturan, nilai_pengaturan FROM app_absensi_pengaturan_aplikasi");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $settings = [];
        foreach ($rows as $r) {
            $settings[$r['nama_pengaturan']] = $r['nilai_pengaturan'];
        }

        if (!isset($settings['link_absensi_cadangan'])) {
            $settings['link_absensi_cadangan'] = 'https://script.google.com/macros/s/AKfycbxGeScmNpeAOHnBd_s39KxtZPhgL5nwvoR6pO8-uXpXl8RSi0YgUTupTeDJR4AErx2Z/exec';
        }

        Response::json(true, 200, "Berhasil mengambil pengaturan aplikasi.", $settings);
    }

    /**
     * [Admin API] Memperbarui nilai pengaturan aplikasi (Super Admin Only).
     */
    public function updatePengaturan() {
        $adminData = AdminAuthHelper::validate();
        $roles = isset($adminData['role']) ? (array) $adminData['role'] : [];
        if (!in_array('super admin', $roles)) {
            Response::json(false, 403, "Hak akses ditolak. Hanya Super Admin yang dapat mengubah pengaturan.");
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !is_array($input)) {
            Response::json(false, 400, "Payload data pengaturan tidak valid.");
            return;
        }

        $db = Database::getConnection();
        $this->ensureTableExists($db);

        $stmt = $db->prepare("INSERT INTO app_absensi_pengaturan_aplikasi (nama_pengaturan, nilai_pengaturan) 
                              VALUES (:nama, :nilai) 
                              ON DUPLICATE KEY UPDATE nilai_pengaturan = :nilai2");

        foreach ($input as $key => $val) {
            $keySanitized = trim($key);
            $valSanitized = is_null($val) ? '' : trim((string)$val);
            $stmt->execute([
                ':nama' => $keySanitized,
                ':nilai' => $valSanitized,
                ':nilai2' => $valSanitized
            ]);
        }

        Response::json(true, 200, "Pengaturan aplikasi berhasil diperbarui.");
    }
}
