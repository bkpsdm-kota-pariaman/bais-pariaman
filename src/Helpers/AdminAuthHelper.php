<?php
// src/Helpers/AdminAuthHelper.php
namespace App\Helpers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use App\Helpers\Response;

class AdminAuthHelper {
    public static function validate() {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
        if (!$authHeader) {
            Response::json(false, 401, "Waktu login Anda sudah habis. Silahkan login ulang.");
        }

        list($jwt) = sscanf($authHeader, 'Bearer %s');
        if (!$jwt) {
            Response::json(false, 401, "Waktu login Anda sudah habis. Silahkan login ulang.");
        }

        try {
            $config = require __DIR__ . '/../../config/config.php';
            $secretKey = $config['jwt_secret'];
            $decoded = JWT::decode($jwt, new Key($secretKey, 'HS256'));

            // Verifikasi role admin (role adalah array sekarang)
            $roles = isset($decoded->data->role) ? (array) $decoded->data->role : [];
            if (!in_array('admin', $roles) && !in_array('super admin', $roles)) {
                Response::json(false, 403, "Hak akses ditolak.");
            }

            return (array) $decoded->data;

        } catch (\Exception $e) {
            Response::json(false, 401, "Waktu login Anda sudah habis. Silahkan login ulang.");
        }
    }
}