# BUGS.md — Bug Memory & Tracking

Dokumen ini mencatat bug yang dilaporkan dan disetujui untuk disimpan dalam memori persistent project.

---

## BUG-001: Pengiriman Absensi Hadir Terlambat Melompati Worker Queue saat `aktifkan_antrian = 1`

- **Status:** IN_PROGRESS
- **Tanggal Dilaporkan:** 2026-08-31
- **Modul / Target File:** [src/Views/pwa/js/app.js](file:///d:/public_html/bais-pariaman/src/Views/pwa/js/app.js)
- **Reporter / Source:** User Report

### Deskripsi Masalah
Saat pegawai melakukan absensi bertipe Hadir dengan status waktu terlambat pada jadwal kegiatan yang memiliki `aktifkan_antrian = 1`, data absensi terkirim langsung (direct API) ke Server PHP, bukannya dialirkan melalui Cloudflare Worker Queue.

### Langkah Reproduksi
1. Login pegawai ke PWA Absensi.
2. Klik tombol ambil absensi kegiatan.
3. Masukkan kode akses jadwal (dengan `aktifkan_antrian = 1`).
4. Pilih status hadir.
5. Ambil foto selfie dan isi keterangan (waktu absensi berada setelah jam selesai, sehingga status menjadi terlambat).
6. Tekan tombol Kirim Absensi.
7. Data terkirim direct ke endpoint PHP (`/api/absen/submit`), melompati Worker (`/api/absen/submit`).

### Root Cause
Pada `src/Views/pwa/js/app.js` di dalam fungsi `kirimAbsensi()`, jalur Worker dibatasi oleh kondisi `!(isTerlambat || isLuarRadius || window._isTidakHadir || isGpsError || isKameraError)`. Ketika `isTerlambat = true`, ekspresi bernilai `false` sehingga PWA mengeksekusi cabang `else` (direct ke server PHP).

### Solusi
1. Untuk absensi bertipe Hadir (`!window._isTidakHadir`):
   - Jika `aktifkan_antrian == 1` (`useQueue = true`), data selalu dikirim ke Server Worker (`${WORKER_URL}/api/absen/submit`).
   - Jika `aktifkan_antrian == 0` (`useQueue = false`), kirim langsung (direct) ke Server Utama PHP (`${API_BASE_URL}/absen/submit`).
2. Jika pengiriman ke Worker menghasilkan error HTTP 5xx / limit exceeded / network error, lakukan fallback otomatis ke Server Utama PHP.
3. Untuk absensi bertipe Tidak Hadir / Izin (`window._isTidakHadir = true`):
   - Selalu dikirim langsung (direct) ke Server Utama PHP (`${API_BASE_URL}/absen/submit`) dalam bentuk `multipart/form-data` untuk upload berkas foto/dokumen PDF (maksimal 1MB).
