<?php
namespace App\Helpers;

class Response {
    /**
     * Mencetak response JSON kaku dan menghentikan eksekusi script.
     * @param bool $status Status keberhasilan (true/false)
     * @param int $code Kode untuk payload JSON (200, 401, 404, 500, dll)
     * @param string $message Pesan respons
     * @param mixed $data Data payload (array/object), default: null
     * @param int $httpStatus HTTP Status Code asli (default: 200)
     */
    public static function json(bool $status, int $code, string $message, $data = null, int $httpStatus = 200) {
        // PENTING: Selalu mengembalikan HTTP Response Code 200 di tingkat protokol (kecuali server error >= 500)
        // Ini mencegah browser menampilkan log error merah di DevTools Console saat terjadi kesalahan validasi / 4xx.
        $actualHttpStatus = ($httpStatus >= 500 || $code >= 500) ? 500 : 200;
        http_response_code($actualHttpStatus);
        
        // Set Header
        header('Content-Type: application/json; charset=utf-8');
        header('Access-Control-Allow-Origin: *'); // Sesuaikan CORS jika perlu
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');

        // Bentuk Payload Kaku
        $payload = [
            'status'  => $status,
            'code'    => $code,
            'message' => $message,
            'data'    => $data
        ];

        // Cetak dan matikan proses (exit)
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}