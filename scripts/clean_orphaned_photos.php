<?php
/**
 * scripts/clean_orphaned_photos.php
 *
 * Script CLI untuk membersihkan file foto absensi yatim (orphaned)
 * yang ada di folder uploads/foto_absensi/ tetapi record-nya sudah tidak ada
 * di tabel app_absensi_data_absensi (misal terhapus atau gagal submit).
 *
 * Cara eksekusi (manual / cronjob):
 * php scripts/clean_orphaned_photos.php
 */

define('APP_PATH', dirname(__DIR__));
require_once APP_PATH . '/vendor/autoload.php';
require_once APP_PATH . '/config/database.php';
require_once APP_PATH . '/src/Helpers/Database.php';

use App\Helpers\Database;

// Tentukan direktori uploads foto
$possibleDirs = [
    APP_PATH . '/uploads/foto_absensi/',
    APP_PATH . '/public_html/uploads/foto_absensi/'
];

$uploadDir = null;
foreach ($possibleDirs as $dir) {
    if (is_dir($dir)) {
        $uploadDir = $dir;
        break;
    }
}

if (!$uploadDir) {
    echo "[" . date('Y-m-d H:i:s') . "] Folder upload foto_absensi tidak ditemukan. Script selesai.\n";
    exit(0);
}

echo "[" . date('Y-m-d H:i:s') . "] Memulai pembersihan foto yatim di: $uploadDir\n";

try {
    $db = Database::getConnection();

    // 1. Ambil semua file fisik dari direktori
    $scannedFiles = scandir($uploadDir);
    $diskFiles = [];
    foreach ($scannedFiles as $file) {
        if ($file === '.' || $file === '..' || $file === '.htaccess' || $file === 'index.html' || $file === 'MANUAL_INPUT.jpg') {
            continue;
        }
        if (is_file($uploadDir . $file)) {
            $diskFiles[] = $file;
        }
    }

    $totalDiskFiles = count($diskFiles);
    echo "[" . date('Y-m-d H:i:s') . "] Total file fisik ditemukan: $totalDiskFiles\n";

    if ($totalDiskFiles === 0) {
        echo "[" . date('Y-m-d H:i:s') . "] Tidak ada file foto untuk diperiksa.\n";
        exit(0);
    }

    // 2. Ambil seluruh nama_file_foto dari database
    $stmt = $db->query("SELECT nama_file_foto FROM app_absensi_data_absensi WHERE nama_file_foto IS NOT NULL AND nama_file_foto != ''");
    $dbPhotos = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
    
    // Gunakan hash map (array_flip) untuk lookup O(1) yang sangat cepat
    $dbPhotoMap = array_flip($dbPhotos);

    // 3. Cari dan hapus file yang tidak ada di database
    $deletedCount = 0;
    $failedCount = 0;

    foreach ($diskFiles as $file) {
        if (!isset($dbPhotoMap[$file])) {
            $fullPath = $uploadDir . $file;
            if (@unlink($fullPath)) {
                $deletedCount++;
                echo "[-] Dihapus: $file\n";
            } else {
                $failedCount++;
                echo "[!] Gagal menghapus: $file\n";
            }
        }
    }

    echo "[" . date('Y-m-d H:i:s') . "] Pembersihan selesai.\n";
    echo "    - Total file diperiksa : $totalDiskFiles\n";
    echo "    - Total file dihapus   : $deletedCount\n";
    if ($failedCount > 0) {
        echo "    - Gagal dihapus        : $failedCount\n";
    }

} catch (\Exception $e) {
    echo "[ERROR] Terjadi kesalahan: " . $e->getMessage() . "\n";
    exit(1);
}
