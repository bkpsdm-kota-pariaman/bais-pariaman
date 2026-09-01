# BUGS.md — Bug Memory & Tracking

Dokumen ini mencatat bug yang dilaporkan dan disetujui untuk disimpan dalam memori persistent project.

---

## BUG-001: Pengiriman Absensi Hadir Terlambat Melompati Worker Queue saat `aktifkan_antrian = 1`

- **Status:** FIXED_PENDING_VERIFICATION
- **Tanggal Dilaporkan:** 2026-08-31
- **Tanggal Perbaikan:** 2026-08-31
- **Modul / Target File:** [src/Views/pwa/js/app.js](file:///d:/public_html/bais-pariaman/src/Views/pwa/js/app.js)
- **Reporter / Source:** User Report

### Deskripsi Masalah
Absensi Hadir terlambat dengan `aktifkan_antrian = 1` sudah masuk Worker, tetapi Worker mengembalikan payload `status: false, code: 401`. Frontend mengubah response 401 tersebut menjadi exception sehingga fallback ke PHP berjalan, padahal 401 adalah error 4xx.

### Root Cause
[fetchWithAuth()](file:///d:/public_html/bais-pariaman/src/Views/pwa/js/app.js#L1001-L1027) sebelumnya mengintersep `code: 401` dari body Worker lalu melempar `Worker sesi/token mismatch.`. Exception itu dianggap sebagai Worker error dan memicu fallback PHP. HTTP header Worker tetap 200 karena helper `jsonResponse()` memetakan code di bawah 500 ke HTTP 200.

Pesan Worker `401` menandakan token yang dikirim tidak diterima Worker, meski login baru dilakukan. Penyebab token mismatch di sisi deployment (JWT secret/issuer/token environment) perlu diverifikasi pada konfigurasi Worker dan backend; frontend tidak boleh menganggapnya sebagai server error 500.

### Solusi
1. [app.js](file:///d:/public_html/bais-pariaman/src/Views/pwa/js/app.js#L1001-L1021) tidak lagi melempar response 4xx Worker dari `fetchWithAuth()`.
2. [kirimAbsensi()](file:///d:/public_html/bais-pariaman/src/Views/pwa/js/app.js#L2265-L2314) menampilkan `res.message` untuk `status: false` tanpa fallback.
3. Fallback PHP hanya berlaku untuk Worker HTTP 5xx, payload `code >= 500`, atau network error.
4. Worker 4xx tetap menjadi response bisnis/data final.
5. Server 5xx dari PHP tetap masuk catch, mencetak error lengkap ke console, lalu menampilkan pesan gagal ke user.
