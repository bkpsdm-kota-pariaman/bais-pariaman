<?php
// src/routes.php

use FastRoute\RouteCollector;

return function(RouteCollector $r) {
    
    // =========================================================================
    // 1. SYSTEM & HEALTH CHECK
    // =========================================================================
    $r->addRoute('GET', '/ping', ['App\Controllers\SystemController', 'ping']);
    $r->addRoute('GET', '/pengaturan/link-absensi-cadangan', ['App\Controllers\SystemController', 'getLinkAbsensiCadangan']);
    $r->addRoute('GET', '/absensi-cadangan-redirect', ['App\Controllers\SystemController', 'redirectAbsensiCadangan']);
    $r->addRoute('GET', '/admin/pengaturan', ['App\Controllers\SystemController', 'getPengaturanList']);
    $r->addRoute('PUT', '/admin/pengaturan', ['App\Controllers\SystemController', 'updatePengaturan']);
    $r->addRoute('DELETE', '/admin/pengaturan/{kode}', ['App\Controllers\SystemController', 'deletePengaturan']);
    $r->addRoute('POST', '/admin/pengaturan/sync-kv', ['App\Controllers\SystemController', 'syncKvCache']);

    // =========================================================================
    // 2. OTENTIKASI (ASN & ADMIN)
    // =========================================================================
    $r->addRoute('POST', '/login-asn', ['App\Controllers\AuthController', 'loginAsn']);
    $r->addRoute('POST', '/token/generate-temporary', ['App\Controllers\AuthController', 'generateTemporaryToken']);
    $r->addRoute('POST', '/auth/update-last-login', ['App\Controllers\AuthController', 'updateLastLogin']);
    $r->addRoute('POST', '/admin/login', ['App\Controllers\AuthController', 'loginAdmin']);

    // =========================================================================
    // 3. JADWAL KEGIATAN (PUBLIC PWA & ADMIN)
    // =========================================================================
    $r->addRoute('GET', '/jadwal/{kode_akses}', ['App\Controllers\JadwalController', 'getJadwal']);
    $r->addRoute('GET', '/admin/jadwal', ['App\Controllers\JadwalController', 'listJadwal']);
    $r->addRoute('POST', '/admin/jadwal', ['App\Controllers\JadwalController', 'createJadwal']);
    $r->addRoute('GET', '/admin/jadwal/{kode_akses}', ['App\Controllers\JadwalController', 'getJadwalAdmin']);
    $r->addRoute('PUT', '/admin/jadwal/{kode_akses}', ['App\Controllers\JadwalController', 'updateJadwal']);
    $r->addRoute('DELETE', '/admin/jadwal/{kode_akses}', ['App\Controllers\JadwalController', 'deleteJadwal']);
    $r->addRoute('GET', '/admin/jadwal/generate-token/{kode_akses}', ['App\Controllers\JadwalController', 'generateJadwalToken']);
    $r->addRoute('POST', '/admin/jadwal/sync-kv/{kode_akses}', ['App\Controllers\JadwalController', 'syncKvCache']);

    // =========================================================================
    // 4. PRESENSI, REKAPITULASI, & AUDIT LOG
    // =========================================================================
    $r->addRoute('POST', '/absen/submit', ['App\Controllers\AbsenController', 'submit']);
    $r->addRoute('POST', '/absen-cepat/submit', ['App\Controllers\AbsenController', 'submitCepat']);
    $r->addRoute('POST', '/absen/submit-bulk', ['App\Controllers\AbsenController', 'submitBulk']);
    
    // Rekap & Statistik Admin
    $r->addRoute('GET', '/admin/rekap/{kode_akses}', ['App\Controllers\AbsenController', 'getRekap']);
    $r->addRoute('GET', '/admin/rekap/summary/{kode_akses}', ['App\Controllers\AbsenController', 'getRekapSummary']);
    $r->addRoute('POST', '/admin/rekap/details/{kode_akses}', ['App\Controllers\AbsenController', 'getRekapDetails']);
    $r->addRoute('POST', '/admin/rekap/import-csv', ['App\Controllers\AbsenController', 'importCsv']);
    $r->addRoute('POST', '/admin/rekap/keseluruhan', ['App\Controllers\AbsenController', 'getRekapKeseluruhan']);
    $r->addRoute('POST', '/admin/statistik', ['App\Controllers\AbsenController', 'getStatistikKehadiran']);
    $r->addRoute('POST', '/admin/statistik/detail', ['App\Controllers\AbsenController', 'getStatistikDetail']);
    $r->addRoute('GET', '/admin/rekap/opd-list/{kode_akses}', ['App\Controllers\AbsenController', 'getRekapOpdList']);
    $r->addRoute('GET', '/admin/log-absensi', ['App\Controllers\AbsenController', 'listLog']);

    // Verifikasi Absensi
    $r->addRoute('POST', '/admin/verifikasi', ['App\Controllers\AbsenController', 'verifikasiAbsen']);
    $r->addRoute('POST', '/admin/verifikasi-masal', ['App\Controllers\AbsenController', 'verifikasiAbsenMasal']);

    // Entry Manual & Bulk
    $r->addRoute('POST', '/admin/rekap/entry/bulk-delete', ['App\Controllers\AbsenController', 'deleteAbsensiEntryBulk']);
    $r->addRoute('POST', '/admin/rekap/entry/{kode_akses}', ['App\Controllers\AbsenController', 'addAbsensiEntry']);
    $r->addRoute('POST', '/admin/rekap/entry/bulk/{kode_akses}', ['App\Controllers\AbsenController', 'addAbsensiEntryBulk']);
    $r->addRoute('POST', '/admin/rekap/eligible-pegawai/{kode_akses}', ['App\Controllers\AbsenController', 'getEligiblePegawai']);
    $r->addRoute('DELETE', '/admin/rekap/entry/{kode_akses}/{nip}', ['App\Controllers\AbsenController', 'deleteAbsensiEntry']);

    // =========================================================================
    // 5. MASTER DATA (PEGAWAI, OPD, & PROFIL)
    // =========================================================================
    // Profil ASN
    $r->addRoute('GET', '/profil/refresh', ['App\Controllers\MasterDataController', 'refreshProfil']);
    $r->addRoute('POST', '/profil/sync', ['App\Controllers\MasterDataController', 'refreshProfil']);
    $r->addRoute('GET', '/profil/sync', ['App\Controllers\MasterDataController', 'refreshProfil']);
    $r->addRoute('POST', '/profil/refresh-token', ['App\Controllers\MasterDataController', 'refreshToken']);
    $r->addRoute('PUT', '/profil/update', ['App\Controllers\MasterDataController', 'updateProfil']);

    // OPD (Public & Admin)
    $r->addRoute('GET', '/opd/list', ['App\Controllers\MasterDataController', 'getListOpdPublic']);
    $r->addRoute('GET', '/admin/opd', ['App\Controllers\MasterDataController', 'listOpd']);
    $r->addRoute('POST', '/admin/opd', ['App\Controllers\MasterDataController', 'createOpd']);
    $r->addRoute('PUT', '/admin/opd/{id}', ['App\Controllers\MasterDataController', 'updateOpd']);
    $r->addRoute('DELETE', '/admin/opd/{id}', ['App\Controllers\MasterDataController', 'deleteOpd']);
    $r->addRoute('POST', '/admin/opd/sync-kv', ['App\Controllers\MasterDataController', 'syncOpdToKv']);

    // Pegawai (Admin)
    $r->addRoute('GET', '/admin/pegawai', ['App\Controllers\MasterDataController', 'listPegawai']);
    $r->addRoute('GET', '/admin/pegawai/stats', ['App\Controllers\MasterDataController', 'getPegawaiStats']);
    $r->addRoute('POST', '/admin/pegawai', ['App\Controllers\MasterDataController', 'createPegawai']);
    $r->addRoute('PUT', '/admin/pegawai/{nip}', ['App\Controllers\MasterDataController', 'updatePegawai']);
    $r->addRoute('DELETE', '/admin/pegawai/{nip}', ['App\Controllers\MasterDataController', 'deletePegawai']);
    $r->addRoute('POST', '/admin/pegawai/sync-kv/{nip}', ['App\Controllers\MasterDataController', 'syncPegawaiKvCache']);
};