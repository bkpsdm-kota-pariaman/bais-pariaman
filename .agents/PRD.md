# PRD — BAIS Pariaman

> Dokumen kebutuhan produk: apa yang dibuat dan untuk siapa.

> **Version:** v2.0.0

---

## 1. Executive Summary

**BAIS Pariaman** adalah aplikasi absensi modern untuk pencatatan kehadiran Aparatur Sipil Negara (ASN) di lingkungan Pemerintah Kota Pariaman.

Aplikasi mencakup:

- PWA untuk ASN
- Dashboard untuk Admin

---

## 2. Vision Statement

Menjadi aplikasi pencatatan kehadiran yang handal, cepat, dan memanfaatkan teknologi PWA untuk proses loading aplikasi yang lebih instan.

---

## 3. Target Users

### ASN

ASN menggunakan PWA melalui smartphone.

Kebutuhan utama:

- melakukan absensi
- scan QR kegiatan
- absensi jarak sesuai fitur aplikasi
- proses cepat
- UI responsif
- loading cepat

### Admin Instansi / BKPSDM

Admin menggunakan Admin Dashboard melalui web.

Kebutuhan utama:

- mengelola jadwal kegiatan
- memantau kehadiran
- melihat rekapitulasi
- melihat statistik
- mengekstrak laporan

---

## 4. Feature Specifications

### 4.1 PWA Absensi

Aplikasi ringan berbasis browser smartphone.

ASN dapat melakukan absensi melalui:

- scan QR kegiatan
- input kode akses kegiatan

Authentication menggunakan token JWT.

---

### 4.2 PWA Caching

PWA menggunakan caching untuk mempercepat loading aset aplikasi.

Tujuan:

- loading awal cepat
- pengalaman user lebih baik
- mendukung behavior offline sesuai implementasi aplikasi

---

### 4.3 Admin Dashboard

Admin Dashboard digunakan untuk:

- mengelola data jadwal kegiatan
- melihat rekap absensi berdasarkan rentang waktu
- melihat statistik kehadiran
- mengekstrak laporan rekapitulasi per kegiatan

---

### 4.4 Alur Proses Bisnis & Rules Absensi

#### 1. Mode Absen Cepat (`/api/absen-cepat/submit`)
- **Autentikasi & Otorisasi:** Cek token JWT, pastikan role `admin` atau `superadmin` (tolak HTTP 403 jika pengguna biasa).
- **Validasi & Pengisian Field Input:**
  - `nama_file_foto`: Opsional (default fallback: `NO_PHOTO_ADMIN_FAST_INPUT.jpg`).
  - `keterangan` (pegawai): Opsional.
  - `keterangan_verifikasi`: WAJIB diisi oleh admin.
  - `status_kehadiran`: Set langsung oleh admin (default: `Hadir`).
  - `status_verifikasi`: Set langsung oleh admin (default: `Terverifikasi Oleh Admin`).

#### 2. Mode Absen Mandiri (`/api/absen/submit`)
- **Autentikasi & Otorisasi:** Cek token JWT, pastikan token valid dan memiliki role ASN/pegawai.
- **Validasi Umum:**
  - `nama_file_foto`: WAJIB (foto selfie terkompres atau file dokumen bukti dukung PDF/Image).
  - `keterangan`: Tergantung opsi kehadiran dan kondisi lokasi/waktu.

##### 2.1 Opsi Kehadiran: "Hadir"
- **Pengecekan Strict Mode (`is_strict_time` & `is_strict_location`):**
  - Jika `is_strict_time == 1` dan waktu di luar jadwal (terlambat/belum mulai), ATAU `is_strict_location == 1` dan posisi di luar radius (atau GPS error/tidak melacak) -> **LANGSUNG TOLAK** (throw HTTP 422 error "Presensi ditolak..."), tanpa toleransi.
- **Pengecekan Toleransi (`is_strict_time == 0` dan `is_strict_location == 0`):**
  - **Kondisi Terlambat ATAU Di Luar Radius:**
    - `keterangan` (pegawai): WAJIB diisi manual oleh pegawai.
    - `status_verifikasi`: Automated set `"Menunggu Verifikasi Admin"`.
    - `status_kehadiran`: `"Hadir"`.
  - **Kondisi Tepat Waktu DAN Di Dalam Radius:**
    - `keterangan` (pegawai): Automated set `"-"`.
    - `status_verifikasi`: Automated set `"Terverifikasi Oleh Sistem"`.
    - `status_kehadiran`: `"Hadir"`.
    - `nama_file_foto`: Menggunakan nama file hasil kompresi foto selfie frontend.

##### 2.2 Opsi Kehadiran: Selain "Hadir" (Izin, Sakit, Cuti, Dinas Luar, dll)
- `nama_file_foto`: Dari file dokumen bukti dukung (Image/PDF) yang diupload manual.
- `keterangan`: WAJIB diketik manual oleh pegawai (alasan tidak hadir).
- `status_kehadiran`: Sesuai pilihan pegawai (Cuti, Sakit, Dinas Luar, dll).
- `status_verifikasi`: Automated set `"Menunggu Verifikasi Admin"`.

---

## 5. Non-Functional Requirements

### Performance

Frontend harus ringan dan dioptimalkan melalui build/minification.

Backend ditargetkan memiliki response cepat.

Target yang tercantum pada requirement awal:

```text
backend response < 200ms
```

Target ini adalah target performa, bukan jaminan setiap request selalu berada di bawah angka tersebut.

### Reliability

Aplikasi mendukung penyimpanan lokal sementara untuk behavior offline PWA sesuai implementasi.

Teknologi yang dapat digunakan sesuai implementation:

```text
IndexedDB
LocalStorage
```

---

## 6. Product Rules

- Jangan menambahkan fitur besar tanpa kebutuhan produk.
- Jangan mengubah flow utama user tanpa kebutuhan.
- Jangan menganggap detail implementation sebagai requirement jika belum ditentukan.
- Jika requirement baru muncul, evaluasi impact terhadap architecture, security, design, dan testing.

---

## 7. Standardisasi Pesan Respon User-Facing

Semua pesan (`message`) dalam respon JSON yang ditujukan kepada pengguna (ASN maupun Admin) wajib mematuhi panduan ramah pengguna:

1. **Dilarang Menggunakan Istilah Teknis Internal:**
   - Dilarang menyertakan istilah teknis seperti *"server utama"*, *"binding queue"*, *"KV miss"*, *"fallback"*, *"database query error"*, atau *"exception"*.
   - Gunakan kalimat manusiawi, lugas, dan mudah dipahami oleh ASN.
   - Contoh pesan penolakan umum: `"Data ditolak."`.

2. **Standardisasi Pesan Internal Server Error (HTTP 500):**
   - Respon HTTP 500 untuk pengguna wajib menggunakan pesan seragam:
     `"Server error. Silahkan hubungi BKPSDM Kota Pariaman."`
   - Detail error teknis sesungguhnya wajib dicatat di log server internal (`console.error` di Worker atau `error_log` di PHP), **tidak diekspos ke payload JSON client**.

3. **Standarisasi Status Code Response JSON:**
   - **200 (Sukses):** Semua response berhasil (termasuk create/update/delete/get) wajib menggunakan code `200` (`status: true`).
   - **401 (Unauthorized):** Error otentikasi, token tidak ada, kedaluwarsa, atau tidak valid.
   - **403 (Forbidden):** Error karena akses dilarang, jadwal belum dibuka, jadwal sudah berlalu, strict time berakhir, strict location di luar radius, atau penolakan pengiriman ASN ke Worker.
   - **404 (Not Found):** Data atau jadwal kegiatan tidak ditemukan.
   - **422 (Unprocessable Entity):** Error validasi input, data tidak lengkap, ukuran file melebihi batas, atau format tidak sesuai.
   - **500 (Internal Server Error):** Error internal server, kegagalan antrian/limit Cloudflare, kesalahan database, atau filesystem disk failure.
