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
