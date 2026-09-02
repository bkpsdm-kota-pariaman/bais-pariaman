# Dokumentasi API Endpoint BAIS Pariaman

Dokumen ini berisi daftar lengkap dan spesifikasi **seluruh endpoint API** pada sistem **BAIS Pariaman**.
Setiap endpoint dilengkapi dengan **Contoh Input Payload/Query**, **Contoh Output Berhasil (`status: true`)**, dan **Contoh Output Error (`status: false`)** dalam format JSON mentah.

---

## Ringkasan Arsitektur Endpoint & Pemetaan Fallback Client-Side

Sistem BAIS Pariaman menggunakan arsitektur **Hybrid Edge-Origin**:
- **Bagian 1 — Worker Endpoints (Cloudflare Worker / Node.js Edge):** Caching KV (login, profil, jadwal, OPD, pengaturan) dan penanganan antrian skala besar (*Producer Queue*).
- **Bagian 2 — Controller Endpoints (Backend PHP Native / FastRoute):** Server origin utama (database MySQL). Menangani logika bisnis, otentikasi fallback, pengelolaan data master, manipulasi jadwal, rekapitulasi absensi, dan penanganan batch antrian (*Queue Consumer Target*).

> **PENTING Mengenai Mekanisme Fallback:**
> Server Worker **TIDAK AKAN PERNAH melakukan fallback secara langsung di dalam server worker** ke server PHP origin. Mekanisme fallback diatur 100% di sisi **Frontend (PWA / Client)**. Jika Worker mengembalikan respon Error (misal 404 / 401 / 500 / Network Failure), Frontend PWA akan secara otomatis mencoba request ulang ke URL Fallback Server PHP Origin.

### Tabel Pemetaan Fallback Endpoint Worker ke Server PHP (Client-Side Fallback)

| Endpoint Worker (`[WORKER]`) | Method | Ada Fallback? | URL Path Fallback Server PHP Origin (`[CONTROLLER]`) | Keterangan Pemicu Fallback di Frontend |
|---|---|---|---|---|
| `/api/login-asn` | POST | YES | `/api/login` | Cache MISS di KV / Respon Worker 401/404/500 |
| `/api/jadwal/{kode_akses}` | GET | YES | `/api/jadwal/{kode_akses}` | Cache MISS di KV / Respon Worker 404/500 |
| `/api/absen/submit` | POST | YES | `/api/absen/submit` | Worker Error 500 / Network Error / Queue Limit Exceeded |
| `/api/absen-cepat/submit` | POST | YES | `/api/absen-cepat/submit` | Worker Error 500 / Network Error / Queue Limit Exceeded |
| `/api/opd/list` | GET | YES | `/api/opd/list` | Cache MISS di KV / Respon Worker 404/500 |
| `/api/pengaturan/link-absensi-cadangan` | GET | YES | `/api/pengaturan/link-absensi-cadangan` | Cache MISS di KV / Respon Worker 404/500 |
| `/api/admin/login` | POST | NO | *(Tidak Ada)* | Otorisasi login admin langsung via Edge KV |
| `/api/opd-list/sync` | PUT | NO | *(Tidak Ada)* | Internal sync khusus dari Admin Panel ke Worker KV |
| `/api/pengaturan/sync` | POST/PUT | NO | *(Tidak Ada)* | Internal sync khusus dari Admin Panel ke Worker KV |
| `/api/jadwal/sync` | POST/PUT | NO | *(Tidak Ada)* | Internal sync khusus dari Admin Panel ke Worker KV |

---

## Format Standar JSON Response

Seluruh response API mengembalikan JSON terstruktur dengan bentuk dasar:

### Status Berhasil (`status: true`)
```json
{
  "status": true,
  "code": 200,
  "message": "Pesan sukses eksekusi",
  "data": {
    "key": "value"
  }
}
```

### Status Error (`status: false`)
```json
{
  "status": false,
  "code": 400,
  "message": "Pesan deskripsi kesalahan",
  "data": null
}
```

---

# BAGIAN 1: ENDPOINT WORKER (Cloudflare Worker / Node.js Edge)

Semua endpoint di Bagian 1 diproses oleh Cloudflare Worker (`worker/src/index.js`).

---

## 1. Otentikasi & Token (Worker)

### 1.1 Login ASN Cache
- **Tipe:** `[WORKER]`
- **Method:** `POST`
- **Path:** `/api/login-asn`
- **Akses:** Publik (ASN)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-01 11:34:42 WIB)
- **File Test:** `ROOT_PROJECT/tests/js/api-login.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" TEST_NIP="123456789012345678" TEST_NIK="1234567890123456" jest tests/js/api-login.test.js`
- **Deskripsi:** Mencegat request login ASN. Memeriksa NIP dan verifikasi NIK (bcrypt) di KV cache (`PEGAWAI_KV`).

**Input Payload (JSON):**
```json
{
  "nip": "123456789012345678",
  "nik": "1234567890123456"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Login Berhasil (dari Cache)",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Data login tidak ditemukan di cache. Mencoba ke server utama.",
  "data": null
}
```

---

### 1.4 Login Admin Cache (Worker Cache)
- **Tipe:** `[WORKER]`
- **Method:** `POST`
- **Path:** `/api/admin/login`
- **Akses:** Publik (Admin/Super Admin)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-01 13:30:46 WIB)
- **File Test:** `ROOT_PROJECT/tests/js/api-admin-login.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" TEST_ADMIN_USERNAME="123456789012345678" TEST_ADMIN_PASSWORD="1234567890123456" jest tests/js/api-admin-login.test.js`
- **Deskripsi:** Mencegat request login admin. Memeriksa NIP dan verifikasi NIK (bcrypt) di KV cache (`PEGAWAI_KV`) serta memverifikasi role admin.

**Input Payload (JSON):**
```json
{
  "username": "123456789012345678",
  "password": "1234567890123456"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Login Admin Berhasil",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "Username atau Password salah.",
  "data": null
}
```

---

### 1.5 Generate Temporary Token (Worker Cache)
- **Tipe:** `[WORKER]`
- **Method:** `POST`
- **Path:** `/api/token/generate-temporary`
- **Akses:** Bearer Token (ASN)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-01 14:06:28 WIB)
- **File Test:** `ROOT_PROJECT/tests/js/api-temporary-token.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" TEST_NIP="123456789012345678" TEST_NIK="1234567890123456" jest tests/js/api-temporary-token.test.js`
- **Deskripsi:** Membuat token JWT sementara (berlaku 30 menit) dengan prefix `BB:` dari klaim token PWA aktif.

**Input Payload:**
- Header: `Authorization: Bearer <jwt_token>`
- Body: *Kosong*

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Token sementara berhasil dibuat",
  "data": {
    "access_token": "BB:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "Waktu login Anda sudah habis. Silahkan login ulang.",
  "data": null
}
```

---

### 1.2 Refresh Token ASN (Worker Cache)
- **Tipe:** `[WORKER]`
- **Method:** `POST`
- **Path:** `/api/profil/refresh-token`
- **Akses:** Bearer Token (ASN)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-01 14:02:51 WIB)
- **File Test:** `ROOT_PROJECT/tests/js/api-profil-token.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" TEST_NIP="123456789012345678" TEST_NIK="1234567890123456" jest tests/js/api-profil-token.test.js`
- **Deskripsi:** Memperbarui token JWT dari data `PEGAWAI_KV` jika ada.

**Input Payload:**
- Header: `Authorization: Bearer <jwt_token>`
- Body: *Kosong*

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Token berhasil diperbarui.",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "Waktu login Anda sudah habis. Silahkan login ulang.",
  "data": null
}
```

---

### 1.3 Sinkronisasi Profil & Token ASN (Worker Cache)
- **Tipe:** `[WORKER]`
- **Method:** `POST`
- **Path:** `/api/profil/sync`
- **Akses:** Bearer Token (ASN)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-01 15:09:36 WIB)
- **File Test:** `ROOT_PROJECT/tests/js/api-profil-sync.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" TEST_NIP="123456789012345678" TEST_NIK="1234567890123456" jest tests/js/api-profil-sync.test.js`
- **Deskripsi:** Mengambil data profil terbaru dari KV cache dan membuat token JWT baru.

**Input Payload:**
- Header: `Authorization: Bearer <jwt_token>`
- Body: *Kosong*

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Profil berhasil disinkronkan.",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "Waktu login Anda sudah habis. Silahkan login ulang.",
  "data": null
}
```

---

### 1.4 Generate Temporary Token (Worker)
- **Tipe:** `[WORKER]`
- **Method:** `POST`
- **Path:** `/api/token/generate-temporary`
- **Akses:** Bearer Token (ASN)
- **Deskripsi:** Membuat token JWT temporer berdurasi 30 menit ber-prefix `BB:`.

**Input Payload:**
- Header: `Authorization: Bearer <jwt_token>`
- Body: *Kosong*

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Token sementara berhasil dibuat via worker",
  "data": {
    "token": "BB:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "Waktu login Anda sudah habis. Silahkan login ulang.",
  "data": null
}
```

---

## 2. Jadwal Kegiatan (Worker)

### 2.1 Get Jadwal by Kode Akses (Worker Cache)
- **Tipe:** `[WORKER]`
- **Method:** `GET`
- **Path:** `/api/jadwal/:kode_akses`
- **Akses:** Publik (PWA)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-01 10:40:22 WIB)
- **File Test:** `ROOT_PROJECT/tests/js/api-jadwal.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" TEST_NIP="123456789012345678" TEST_NIK="1234567890123456" TEST_KODE_JADWAL="KODE12" jest tests/js/api-jadwal.test.js`
- **Deskripsi:** Mengambil data jadwal kegiatan dari `JADWAL_KV`.

**Input Query / Param:**
- Path Param: `:kode_akses` = `KODE12`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Jadwal kegiatan berhasil ditemukan",
  "data": {
    "kode_akses": "KODE12",
    "judul": "Kegiatan Apel Pagi",
    "kategori": "Apel",
    "tanggal": "2026-09-01",
    "jam_mulai": "07:30:00",
    "jam_selesai": "08:30:00",
    "koordinat": "-0.6264,100.1187",
    "radius_meter": 100,
    "is_strict_time": 1,
    "is_strict_location": 1,
    "is_terlambat": false,
    "server_time": "2026-09-01T07:30:00.000Z"
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Jadwal kegiatan tidak ditemukan atau sudah tidak berlaku untuk hari ini.",
  "data": null
}
```

---

### 2.2 Upsert Cache Jadwal (Worker Internal)
- **Tipe:** `[WORKER]`
- **Method:** `POST` / `PUT`
- **Path:** `/api/jadwal` atau `/api/jadwal/:kode_akses`
- **Akses:** Internal Server (`X-Worker-Secret`)
- **Deskripsi:** Menyimpan atau memperbarui data jadwal ke `JADWAL_KV`.

**Input Payload (JSON):**
```json
{
  "kode_akses": "KODE12",
  "judul": "Kegiatan Apel Pagi",
  "kategori": "Apel",
  "tanggal": "2026-09-01",
  "jam_mulai": "07:30:00",
  "jam_selesai": "08:30:00",
  "koordinat": "-0.6264,100.1187",
  "radius_meter": 100,
  "aktifkan_antrian": 1,
  "is_strict_time": 1,
  "is_strict_location": 1,
  "target_opd": ["Dinas Contoh"]
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Jadwal KODE12 berhasil disimpan/diperbarui di cache.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 403,
  "message": "Akses ditolak. Invalid secret.",
  "data": null
}
```

---

### 2.3 Delete Cache Jadwal (Worker Internal)
- **Tipe:** `[WORKER]`
- **Method:** `DELETE`
- **Path:** `/api/jadwal/:kode_akses`
- **Akses:** Internal Server (`X-Worker-Secret`)
- **Deskripsi:** Menghapus data jadwal dari `JADWAL_KV`.

**Input Query / Param:**
- Header: `X-Worker-Secret: <secret_key>`
- Path Param: `:kode_akses` = `KODE12`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Jadwal KODE12 berhasil dihapus dari cache.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 403,
  "message": "Akses ditolak. Invalid secret.",
  "data": null
}
```

---

## 3. Absensi & Queue Producer (Worker)

### 3.1 Submit Absensi ASN (Worker Producer)
- **Tipe:** `[WORKER]`
- **Method:** `POST`
- **Path:** `/api/absen/submit`
- **Akses:** Bearer Token (ASN)
- **File Test Hadir:** `ROOT_PROJECT/tests/js/api-absen-submit-hadir.test.js`
- **File Test Tidak Hadir:** `ROOT_PROJECT/tests/js/api-absen-submit-tidakhadir.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" TEST_NIP="123456789012345678" TEST_NIK="1234567890123456" TEST_KODE_AKSES="KODE12" jest tests/js/api-absen-submit-hadir.test.js tests/js/api-absen-submit-tidakhadir.test.js`
- **Deskripsi:** Menerima absensi ASN, memvalidasi aturan ketat (waktu, radius, batasan foto Base64 < 100 KB), lalu memasukkan pesan ke Cloudflare Queue (`MY_QUEUE`).

**Input Payload (JSON):**
```json
{
  "kode_akses": "KODE12",
  "lat": "-0.6264",
  "lng": "100.1187",
  "lokasi": "Kantor Walikota",
  "status_kehadiran": "Hadir",
  "foto_absensi": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "keterangan": "Hadir tepat waktu"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 202,
  "message": "Absen sudah terkirim.",
  "data": null
}
```

**Output Berhasil Menunggu Verifikasi Admin (Terlambat / Luar Radius / Izin):**
```json
{
  "status": true,
  "code": 202,
  "message": "Absen sudah terkirim. BKPSDM Kota Pariaman akan melakukan verifikasi absen Anda.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 422,
  "message": "Ukuran foto terlalu besar. Maksimal 100 KB.",
  "data": null
}
```

---

### 3.2 Submit Absensi Cepat Admin (Worker Producer)
- **Tipe:** `[WORKER]`
- **Method:** `POST`
- **Path:** `/api/absen-cepat/submit`
- **Akses:** Bearer Token (Admin/Super Admin)
- **Deskripsi:** Menerima pengiriman absensi cepat hasil scan QR oleh Admin ke Cloudflare Queue (`MY_QUEUE`).

**Input Payload (JSON):**
```json
{
  "user_token": "BB:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "kode_akses": "KODE12",
  "lat": "-0.6264",
  "lng": "100.1187",
  "lokasi": "Kantor Walikota",
  "status_kehadiran": "Hadir",
  "status_verifikasi": "Terverifikasi Oleh Admin",
  "keterangan_verifikasi": "Absensi Cepat oleh Admin"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 202,
  "message": "Absensi Cepat telah diterima dan akan segera diproses.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 403,
  "message": "Hak akses ditolak.",
  "data": null
}
```

---

## 4. Master Data Pegawai & OPD Cache (Worker Internal)

### 4.1 Upsert Pegawai Cache (Worker Internal)
- **Tipe:** `[WORKER]`
- **Method:** `PUT`
- **Path:** `/api/pegawai/:nip`
- **Akses:** Internal Server (`X-Worker-Secret`)
- **Deskripsi:** Memperbarui/menyimpan data pegawai di `PEGAWAI_KV`.

**Input Payload (JSON):**
```json
{
  "nip": "123456789012345678",
  "nik": "$2a$10$hashedpassword...",
  "nama_pegawai": "Nama Pegawai Contoh",
  "perangkat_daerah": "Dinas Contoh",
  "jabatan": "Staf",
  "jenis_asn": "PNS",
  "role": ["asn"]
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Cache untuk NIP 123456789012345678 berhasil disimpan/diperbarui.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 403,
  "message": "Akses ditolak. Invalid secret.",
  "data": null
}
```

---

### 4.2 Delete Pegawai Cache (Worker Internal)
- **Tipe:** `[WORKER]`
- **Method:** `DELETE`
- **Path:** `/api/pegawai/:nip`
- **Akses:** Internal Server (`X-Worker-Secret`)

**Input Query / Param:**
- Header: `X-Worker-Secret: <secret>`
- Path Param: `:nip` = `123456789012345678`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Cache untuk NIP 123456789012345678 berhasil dihapus.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 403,
  "message": "Akses ditolak. Invalid secret.",
  "data": null
}
```

---

### 4.3 Bulk Sync Pegawai Cache (Worker Internal)
- **Tipe:** `[WORKER]`
- **Method:** `POST`
- **Path:** `/api/pegawai/bulk`
- **Akses:** Internal Server (`X-Worker-Secret`)

**Input Payload (JSON Array):**
```json
[
  {
    "nip": "123456789012345678",
    "nik": "$2a$10$hashedpassword...",
    "nama_pegawai": "Nama Pegawai Contoh",
    "perangkat_daerah": "Dinas Contoh",
    "jabatan": "Staf",
    "jenis_asn": "PNS",
    "role": ["asn"]
  }
]
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "1 data pegawai berhasil disinkronkan.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 400,
  "message": "Payload harus berupa array data pegawai.",
  "data": null
}
```

---

### 4.4 OPD List (Worker Cache)
- **Tipe:** `[WORKER]`
- **Method:** `GET`
- **Path:** `/api/opd/list`
- **Akses:** Publik (PWA)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-01 11:10:46 WIB)
- **File Test:** `ROOT_PROJECT/tests/js/api-opd.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" TEST_NIP="123456789012345678" TEST_NIK="1234567890123456" jest tests/js/api-opd.test.js`
- **Deskripsi:** Mengambil daftar OPD dari `OPD_KV`.

**Input:** Body Kosong / Query Kosong

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "List OPD berhasil diambil",
  "data": [
    "BKPSDM",
    "Dinas Pendidikan",
    "Diskominfo"
  ]
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Daftar OPD tidak ditemukan.",
  "data": null
}
```

---

### 4.5 Sync OPD List Cache (Worker Internal)
- **Tipe:** `[WORKER]`
- **Method:** `PUT`
- **Path:** `/api/opd-list/sync`
- **Akses:** Internal Server (`X-Worker-Secret`)

**Input Payload (JSON Array):**
```json
[
  "BKPSDM",
  "Dinas Pendidikan",
  "Diskominfo"
]
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Daftar OPD berhasil disinkronkan ke KV.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 403,
  "message": "Akses ditolak.",
  "data": null
}
```

---

## 5. Pengaturan Sistem & Testing (Worker)

### 5.1 Get Link Absensi Cadangan (Worker Cache)
- **Tipe:** `[WORKER]`
- **Method:** `GET`
- **Path:** `/api/pengaturan/link-absensi-cadangan`
- **Akses:** Publik
- **Status Test:** ✅ SUKSES TERUJI (2026-09-01 12:31:37 WIB)
- **File Test:** `ROOT_PROJECT/tests/js/api-pengaturan-link.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" jest tests/js/api-pengaturan-link.test.js`

**Input:** Body Kosong / Query Kosong

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Link absensi cadangan berhasil diambil.",
  "data": {
    "link_absensi_cadangan": "https://script.google.com/macros/s/example/exec"
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Pengaturan link absensi cadangan tidak ditemukan di database.",
  "data": null
}
```

---

### 5.2 Sync Pengaturan Cache (Worker Internal)
- **Tipe:** `[WORKER]`
- **Method:** `POST` / `PUT`
- **Path:** `/api/pengaturan/sync`
- **Akses:** Internal (`X-Worker-Secret` atau Super Admin Token)

**Input Payload (JSON):**
```json
{
  "link_absensi_cadangan": "https://script.google.com/macros/s/example/exec"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Pengaturan aplikasi berhasil disinkronkan ke Worker KV seumur hidup.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 403,
  "message": "Akses ditolak. Hanya Super Admin atau server internal yang diizinkan.",
  "data": null
}
```

---

### 5.3 Delete Pengaturan Cache (Worker Internal)
- **Tipe:** `[WORKER]`
- **Method:** `DELETE`
- **Path:** `/api/pengaturan/:key`
- **Akses:** Internal (`X-Worker-Secret` atau Super Admin Token)

**Input Param:** `:key` = `link_absensi_cadangan`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Pengaturan 'link_absensi_cadangan' berhasil dihapus dari Worker KV.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 403,
  "message": "Akses ditolak. Hanya Super Admin atau server internal yang diizinkan.",
  "data": null
}
```

---

### 5.4 Connection Test KV
- **Tipe:** `[WORKER]`
- **Method:** `GET` / `POST`
- **Path:** `/api/test-kv`

**Input Payload (POST JSON):**
```json
{
  "key": "test_key",
  "value": "test_value"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Data ditemukan.",
  "data": "test_value"
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Data untuk kunci 'test_key' tidak ditemukan.",
  "data": null
}
```

---

### 5.5 Queue Consumer Batch Handler (Worker Background)
- **Tipe:** `[WORKER]` (Background Queue Process)
- **Trigger:** Cloudflare Queue Event (`MY_QUEUE`)

**Input Batch Payload (ke PHP Origin `/absen/submit-bulk`):**
```json
[
  {
    "id": "msg_01",
    "body": {
      "kode_akses": "KODE12",
      "nip": "123456789012345678",
      "nama_pegawai": "Nama Pegawai Contoh",
      "status_kehadiran": "Hadir"
    }
  }
]
```

**Output Berhasil (`status: true`):**
- Server PHP merespon HTTP 200 -> Pesan di-ACK dan dihapus dari antrian.

**Output Error (`status: false`):**
- Server PHP merespon HTTP 5xx -> Pesan di-retry 60 detik kemudian (hingga 5x).
- Server PHP merespon HTTP 4xx -> Pesan ditolak (ACK) tanpa retry.

---

# BAGIAN 2: ENDPOINT CONTROLLER (Backend PHP Native / FastRoute)

Semua endpoint di Bagian 2 diproses oleh Backend PHP Native (`src/Controllers/*`).

---

## 6. System & Health Check (Controller)

### 6.1 Ping Test / Healthcheck
- **Tipe:** `[CONTROLLER]` (`SystemController::ping`)
- **Method:** `GET`
- **Path:** `/api/ping`
- **Akses:** Publik

**Input:** Body Kosong / Query Kosong

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "API Siap Digunakan",
  "data": {
    "timestamp": 1725148800
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 500,
  "message": "Server Error: Database tidak terhubung.",
  "data": null
}
```

---

### 6.2 Get Link Absensi Cadangan (Server Origin)
- **Tipe:** `[CONTROLLER]` (`SystemController::getLinkAbsensiCadangan`)
- **Method:** `GET`
- **Path:** `/api/pengaturan/link-absensi-cadangan`
- **Akses:** Publik
- **Status Test:** ✅ SUKSES TERUJI (2026-09-01 12:31:37 WIB)
- **File Test:** `ROOT_PROJECT/tests/js/api-pengaturan-link.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" jest tests/js/api-pengaturan-link.test.js`

**Input:** Body Kosong / Query Kosong

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Link absensi cadangan berhasil diambil.",
  "data": {
    "link_absensi_cadangan": "https://script.google.com/macros/s/example/exec"
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Pengaturan link absensi cadangan tidak ditemukan di database.",
  "data": null
}
```

---

### 6.3 Redirect Absensi Cadangan
- **Tipe:** `[CONTROLLER]` (`SystemController::redirectAbsensiCadangan`)
- **Method:** `GET`
- **Path:** `/api/absensi-cadangan-redirect`
- **Akses:** Publik

**Input:** Body Kosong / Query Kosong

**Output Berhasil (`status: true`):**
- HTTP Status `302 Found` (Redirect Header `Location: https://script.google.com/...`)

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Pengaturan link absensi cadangan tidak ditemukan di database.",
  "data": null
}
```

---

### 6.4 List Pengaturan Aplikasi (Admin)
- **Tipe:** `[CONTROLLER]` (`SystemController::getPengaturanList`)
- **Method:** `GET`
- **Path:** `/api/admin/pengaturan`
- **Akses:** Bearer Token (Super Admin Only)

**Input:** Header `Authorization: Bearer <super_admin_jwt>`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Berhasil mengambil pengaturan aplikasi.",
  "data": {
    "list": [
      {
        "id": 1,
        "kode_pengaturan": "link_absensi_cadangan",
        "nama_pengaturan": "Link Absensi Cadangan",
        "nilai_pengaturan": "https://script.google.com/macros/s/example/exec"
      }
    ],
    "map": {
      "link_absensi_cadangan": "https://script.google.com/macros/s/example/exec"
    },
    "link_absensi_cadangan": "https://script.google.com/macros/s/example/exec"
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 403,
  "message": "Hak akses ditolak. Hanya Super Admin yang dapat mengakses pengaturan aplikasi.",
  "data": null
}
```

---

### 6.5 Update / Create Pengaturan (Admin)
- **Tipe:** `[CONTROLLER]` (`SystemController::updatePengaturan`)
- **Method:** `PUT`
- **Path:** `/api/admin/pengaturan`
- **Akses:** Bearer Token (Super Admin Only)

**Input Payload (JSON):**
```json
{
  "kode_pengaturan": "link_absensi_cadangan",
  "nama_pengaturan": "Link Absensi Cadangan",
  "nilai_pengaturan": "https://script.google.com/macros/s/example/exec"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Pengaturan aplikasi berhasil disimpan dan tersinkron ke Worker KV.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 400,
  "message": "Kode pengaturan wajib diisi.",
  "data": null
}
```

---

### 6.6 Delete Pengaturan (Admin)
- **Tipe:** `[CONTROLLER]` (`SystemController::deletePengaturan`)
- **Method:** `DELETE`
- **Path:** `/api/admin/pengaturan/{kode}`
- **Akses:** Bearer Token (Super Admin Only)

**Input Param:** `{kode}` = `link_absensi_cadangan`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Pengaturan 'link_absensi_cadangan' berhasil dihapus dan disinkronkan ke Worker KV.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 403,
  "message": "Hak akses ditolak. Hanya Super Admin yang dapat menghapus pengaturan.",
  "data": null
}
```

---

### 6.7 Manual Sync Pengaturan to KV Cache
- **Tipe:** `[CONTROLLER]` (`SystemController::syncKvCache`)
- **Method:** `POST`
- **Path:** `/api/admin/pengaturan/sync-kv`
- **Akses:** Bearer Token (Super Admin Only)

**Input:** Header `Authorization: Bearer <super_admin_jwt>`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Pengaturan aplikasi berhasil disinkronkan ke Worker KV seumur hidup.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 503,
  "message": "Gagal menyinkronkan pengaturan ke Worker KV. Periksa koneksi worker.",
  "data": null
}
```

---

## 7. Otentikasi & Token (Controller)

### 7.1 Login ASN Server Origin (Fallback)
- **Tipe:** `[CONTROLLER]` (`AuthController::loginAsn`)
- **Method:** `POST`
- **Path:** `/api/login-asn`
- **Akses:** Publik (ASN)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-01 11:34:42 WIB)
- **File Test:** `ROOT_PROJECT/tests/js/api-login.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" TEST_NIP="123456789012345678" TEST_NIK="1234567890123456" jest tests/js/api-login.test.js`

**Input Payload (JSON):**
```json
{
  "nip": "123456789012345678",
  "nik": "1234567890123456"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Login Berhasil",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "NIP tidak ditemukan atau Password salah",
  "data": null
}
```

---

### 7.2 Login Admin / Super Admin (Server Origin)
- **Tipe:** `[CONTROLLER]` (`AuthController::loginAdmin`)
- **Method:** `POST`
- **Path:** `/api/admin/login`
- **Akses:** Publik (Admin/Super Admin)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-01 13:30:46 WIB)
- **File Test:** `ROOT_PROJECT/tests/js/api-admin-login.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" TEST_ADMIN_USERNAME="123456789012345678" TEST_ADMIN_PASSWORD="1234567890123456" jest tests/js/api-admin-login.test.js`

**Input Payload (JSON):**
```json
{
  "username": "123456789012345678",
  "password": "1234567890123456"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Login Admin Berhasil",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "Username atau Password salah.",
  "data": null
}
```

---

### 7.3 Generate Temporary Token (Server Origin)
- **Tipe:** `[CONTROLLER]` (`AuthController::generateTemporaryToken`)
- **Method:** `POST`
- **Path:** `/api/token/generate-temporary`
- **Akses:** Bearer Token (ASN)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-01 14:06:28 WIB)
- **File Test:** `ROOT_PROJECT/tests/js/api-temporary-token.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" TEST_NIP="123456789012345678" TEST_NIK="1234567890123456" jest tests/js/api-temporary-token.test.js`

**Input:** Header `Authorization: Bearer <jwt_token>`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Token sementara berhasil dibuat",
  "data": {
    "access_token": "BB:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "Waktu login Anda sudah habis. Silahkan login ulang.",
  "data": null
}
```

---

### 7.4 Internal Update Last Login
- **Tipe:** `[CONTROLLER]` (`AuthController::updateLastLogin`)
- **Method:** `POST`
- **Path:** `/api/auth/update-last-login`
- **Akses:** Internal Server (`X-Worker-Secret`)

**Input Payload (JSON):**
```json
{
  "nip": "123456789012345678"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Last login berhasil diperbarui.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 403,
  "message": "Akses ditolak. Invalid secret.",
  "data": null
}
```

---

## 8. Jadwal Kegiatan (Controller)

### 8.1 Get Jadwal by Kode Akses (Server Origin)
- **Tipe:** `[CONTROLLER]` (`JadwalController::getJadwal`)
- **Method:** `GET`
- **Path:** `/api/jadwal/{kode_akses}`
- **Akses:** Bearer Token (ASN)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-01 10:40:22 WIB)
- **File Test:** `ROOT_PROJECT/tests/js/api-jadwal.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" TEST_NIP="123456789012345678" TEST_NIK="1234567890123456" TEST_KODE_JADWAL="KODE12" jest tests/js/api-jadwal.test.js`

**Input Param:** `{kode_akses}` = `KODE12`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Jadwal kegiatan berhasil ditemukan",
  "data": {
    "kode_akses": "KODE12",
    "judul": "Apel Pagi",
    "kategori": "Apel",
    "tanggal": "2026-09-01",
    "jam_mulai": "07:30:00",
    "jam_selesai": "08:30:00",
    "target_opd": ["Dinas Contoh"],
    "is_terlambat": false,
    "server_time": "2026-09-01 07:30:00"
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Jadwal kegiatan tidak ditemukan atau sudah tidak berlaku untuk hari ini.",
  "data": null
}
```

---

### 8.2 List Jadwal Kegiatan (Admin)
- **Tipe:** `[CONTROLLER]` (`JadwalController::listJadwal`)
- **Method:** `GET`
- **Path:** `/api/admin/jadwal`
- **Akses:** Bearer Token (Admin)
- **Query Params:** `page=1&limit=10&search=Apel&kategori=Apel`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OK",
  "data": {
    "data": [
      {
        "kode_akses": "KODE12",
        "judul": "Apel Pagi",
        "kategori": "Apel",
        "tanggal": "2026-09-01",
        "kv_sync_status": 1
      }
    ],
    "pagination": {
      "total_rows": 1,
      "total_pages": 1,
      "current_page": 1,
      "limit": 10
    }
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "Waktu session login admin telah habis. Silahkan login kembali.",
  "data": null
}
```

---

### 8.3 Create Jadwal Kegiatan (Admin)
- **Tipe:** `[CONTROLLER]` (`JadwalController::createJadwal`)
- **Method:** `POST`
- **Path:** `/api/admin/jadwal`
- **Akses:** Bearer Token (Admin)

**Input Payload (JSON):**
```json
{
  "judul": "Apel Pagi",
  "kategori": "Apel",
  "tanggal": "2026-09-01",
  "jam_mulai": "07:30:00",
  "jam_selesai": "08:30:00",
  "koordinat": "-0.6264,100.1187",
  "radius_meter": 100,
  "aktifkan_antrian": 1,
  "is_strict_time": 1,
  "is_strict_location": 1,
  "target_opd": ["Dinas Contoh"]
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Jadwal berhasil dibuat.",
  "data": {
    "kode_akses": "KODE12"
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 500,
  "message": "Gagal membuat jadwal: Database connection timeout.",
  "data": null
}
```

---

### 8.4 Detail Jadwal Admin
- **Tipe:** `[CONTROLLER]` (`JadwalController::getJadwalAdmin`)
- **Method:** `GET`
- **Path:** `/api/admin/jadwal/{kode_akses}`
- **Akses:** Bearer Token (Admin)

**Input Param:** `{kode_akses}` = `KODE12`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OK",
  "data": {
    "kode_akses": "KODE12",
    "judul": "Apel Pagi",
    "kategori": "Apel",
    "tanggal": "2026-09-01",
    "target_opd": ["Dinas Contoh"]
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Jadwal tidak ditemukan.",
  "data": null
}
```

---

### 8.5 Update Jadwal Kegiatan (Admin)
- **Tipe:** `[CONTROLLER]` (`JadwalController::updateJadwal`)
- **Method:** `PUT`
- **Path:** `/api/admin/jadwal/{kode_akses}`
- **Akses:** Bearer Token (Admin)

**Input Payload (JSON):**
```json
{
  "judul": "Apel Pagi Terbuka",
  "kategori": "Apel",
  "tanggal": "2026-09-01",
  "jam_mulai": "07:30:00",
  "jam_selesai": "08:30:00",
  "koordinat": "-0.6264,100.1187",
  "radius_meter": 150,
  "aktifkan_antrian": 1,
  "is_strict_time": 1,
  "is_strict_location": 1,
  "target_opd": ["Dinas Contoh"]
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Jadwal berhasil diperbarui.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 500,
  "message": "Gagal memperbarui jadwal: Database error.",
  "data": null
}
```

---

### 8.6 Delete Jadwal Kegiatan (Admin)
- **Tipe:** `[CONTROLLER]` (`JadwalController::deleteJadwal`)
- **Method:** `DELETE`
- **Path:** `/api/admin/jadwal/{kode_akses}`
- **Akses:** Bearer Token (Admin)

**Input Param:** `{kode_akses}` = `KODE12`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Jadwal berhasil dihapus dari database.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 500,
  "message": "Gagal menghapus jadwal: Constraint foreign key violation.",
  "data": null
}
```

---

### 8.7 Generate Token Jadwal
- **Tipe:** `[CONTROLLER]` (`JadwalController::generateJadwalToken`)
- **Method:** `GET`
- **Path:** `/api/admin/jadwal/generate-token/{kode_akses}`
- **Akses:** Bearer Token (Admin)

**Input Param:** `{kode_akses}` = `KODE12`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Token jadwal berhasil dibuat",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Jadwal tidak ditemukan.",
  "data": null
}
```

---

### 8.8 Sync Single Jadwal to KV Cache
- **Tipe:** `[CONTROLLER]` (`JadwalController::syncKvCache`)
- **Method:** `POST`
- **Path:** `/api/admin/jadwal/sync-kv/{kode_akses}`
- **Akses:** Bearer Token (Admin)

**Input Param:** `{kode_akses}` = `KODE12`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Cache berhasil disinkronkan dengan Cloudflare KV.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 503,
  "message": "Gagal menyinkronkan cache. Cloudflare KV mungkin sedang sibuk atau tidak dapat dijangkau. Coba lagi nanti.",
  "data": null
}
```

---

## 9. Absensi, Rekap, Verifikasi & Audit Log (Controller)

### 9.1 Submit Absensi ASN Direct (Server Origin Fallback)
- **Tipe:** `[CONTROLLER]` (`AbsenController::submit`)
- **Method:** `POST`
- **Path:** `/api/absen/submit`
- **Content-Type:** `multipart/form-data`

**Input Form Data:**
- `kode_akses`: `KODE12`
- `lat`: `-0.6264`
- `lng`: `100.1187`
- `lokasi`: `Kantor Walikota`
- `status_kehadiran`: `Hadir`
- `foto`: `[Binary Image File]`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Absen sudah terkirim.",
  "data": {
    "waktu": "2026-09-01 07:35:00"
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 400,
  "message": "Data tidak lengkap. Kode, lokasi, dan foto/bukti dukung wajib diisi.",
  "data": null
}
```

---

### 9.2 Submit Absensi Cepat Direct (Server Origin Fallback)
- **Tipe:** `[CONTROLLER]` (`AbsenController::submitCepat`)
- **Method:** `POST`
- **Path:** `/api/absen-cepat/submit`
- **Akses:** Bearer Token (Admin)

**Input Form Data / Payload:**
- `user_token`: `BB:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- `kode_akses`: `KODE12`
- `lat`: `-0.6264`
- `lng`: `100.1187`
- `lokasi`: `Kantor Walikota`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Absensi Cepat berhasil direkam.",
  "data": {
    "waktu": "2026-09-01 07:35:00"
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 403,
  "message": "Hak akses ditolak.",
  "data": null
}
```

---

### 9.3 Submit Bulk Batch Absensi (Worker Consumer Target)
- **Tipe:** `[CONTROLLER]` (`AbsenController::submitBulk`)
- **Method:** `POST`
- **Path:** `/api/absen/submit-bulk`
- **Akses:** Internal Server (`X-Worker-Secret`)

**Input Payload (JSON Array):**
```json
[
  {
    "id": "msg_01",
    "body": {
      "kode_akses": "KODE12",
      "nip": "123456789012345678",
      "nama_pegawai": "Nama Pegawai Contoh",
      "opd": "Dinas Contoh",
      "status_kehadiran": "Hadir",
      "status_verifikasi": "Terverifikasi Sistem"
    }
  }
]
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Batch absensi berhasil diproses.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 403,
  "message": "Akses ditolak. Invalid secret.",
  "data": null
}
```

---

### 9.4 Rekap Absensi Kegiatan
- **Tipe:** `[CONTROLLER]` (`AbsenController::getRekap`)
- **Method:** `GET`
- **Path:** `/api/admin/rekap/{kode_akses}`
- **Akses:** Bearer Token (Admin)

**Input Param:** `{kode_akses}` = `KODE12`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OK",
  "data": [
    {
      "nip": "123456789012345678",
      "nama_pegawai": "Nama Pegawai Contoh",
      "opd": "Dinas Contoh",
      "waktu": "2026-09-01 07:35:00",
      "status_kehadiran": "Hadir",
      "status_verifikasi": "Terverifikasi Sistem"
    }
  ]
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "Waktu session login admin telah habis. Silahkan login kembali.",
  "data": null
}
```

---

### 9.5 Rekap Summary Statistics
- **Tipe:** `[CONTROLLER]` (`AbsenController::getRekapSummary`)
- **Method:** `GET`
- **Path:** `/api/admin/rekap/summary/{kode_akses}`
- **Akses:** Bearer Token (Admin)

**Input Param:** `{kode_akses}` = `KODE12`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OK",
  "data": {
    "total": 100,
    "hadir": 85,
    "alpa": 10,
    "izin": 3,
    "sakit": 2
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Data kegiatan tidak ditemukan.",
  "data": null
}
```

---

### 9.6 Rekap Details (Filtered)
- **Tipe:** `[CONTROLLER]` (`AbsenController::getRekapDetails`)
- **Method:** `POST`
- **Path:** `/api/admin/rekap/details/{kode_akses}`
- **Akses:** Bearer Token (Admin)

**Input Payload (JSON):**
```json
{
  "opd": "Dinas Contoh",
  "status": "Hadir",
  "search": "Pegawai"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OK",
  "data": [
    {
      "nip": "123456789012345678",
      "nama_pegawai": "Nama Pegawai Contoh",
      "opd": "Dinas Contoh",
      "status_kehadiran": "Hadir"
    }
  ]
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 400,
  "message": "Payload filter tidak valid.",
  "data": null
}
```

---

### 9.7 Import Rekap CSV
- **Tipe:** `[CONTROLLER]` (`AbsenController::importCsv`)
- **Method:** `POST`
- **Path:** `/api/admin/rekap/import-csv`
- **Akses:** Bearer Token (Admin)

**Input Form Data:**
- `csv_file`: `[File CSV]`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Import CSV berhasil. 50 data diunggah.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 400,
  "message": "File CSV tidak valid atau format kolom salah.",
  "data": null
}
```

---

### 9.8 Rekap Keseluruhan
- **Tipe:** `[CONTROLLER]` (`AbsenController::getRekapKeseluruhan`)
- **Method:** `POST`
- **Path:** `/api/admin/rekap/keseluruhan`
- **Akses:** Bearer Token (Admin)

**Input Payload (JSON):**
```json
{
  "tgl_mulai": "2026-09-01",
  "tgl_selesai": "2026-09-30"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OK",
  "data": [
    {
      "nip": "123456789012345678",
      "nama_pegawai": "Nama Pegawai Contoh",
      "total_hadir": 20,
      "total_alpa": 1
    }
  ]
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 400,
  "message": "Tanggal mulai dan selesai wajib diisi.",
  "data": null
}
```

---

### 9.9 Statistik Kehadiran
- **Tipe:** `[CONTROLLER]` (`AbsenController::getStatistikKehadiran`)
- **Method:** `POST`
- **Path:** `/api/admin/statistik`
- **Akses:** Bearer Token (Admin)

**Input Payload (JSON):**
```json
{
  "bulan": "09",
  "tahun": "2026"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OK",
  "data": {
    "persentase_kehadiran": 95.5,
    "per_opd": [
      {
        "opd": "Dinas Contoh",
        "persentase": 98.0
      }
    ]
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 400,
  "message": "Parameter bulan dan tahun wajib diisi.",
  "data": null
}
```

---

### 9.10 Detail Statistik Kehadiran
- **Tipe:** `[CONTROLLER]` (`AbsenController::getStatistikDetail`)
- **Method:** `POST`
- **Path:** `/api/admin/statistik/detail`
- **Akses:** Bearer Token (Admin)

**Input Payload (JSON):**
```json
{
  "opd": "Dinas Contoh"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OK",
  "data": [
    {
      "nip": "123456789012345678",
      "nama_pegawai": "Nama Pegawai Contoh",
      "persentase": 100.0
    }
  ]
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "OPD tidak ditemukan.",
  "data": null
}
```

---

### 9.11 Rekap OPD List
- **Tipe:** `[CONTROLLER]` (`AbsenController::getRekapOpdList`)
- **Method:** `GET`
- **Path:** `/api/admin/rekap/opd-list/{kode_akses}`
- **Akses:** Bearer Token (Admin)

**Input Param:** `{kode_akses}` = `KODE12`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OK",
  "data": [
    "BKPSDM",
    "Dinas Contoh"
  ]
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Data kegiatan tidak ditemukan.",
  "data": null
}
```

---

### 9.12 Audit Log Absensi
- **Tipe:** `[CONTROLLER]` (`AbsenController::listLog`)
- **Method:** `GET`
- **Path:** `/api/admin/log-absensi`
- **Akses:** Bearer Token (Admin)

**Input Query:** `?page=1&limit=10`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OK",
  "data": [
    {
      "id": 1,
      "kode_akses": "KODE12",
      "nip": "123456789012345678",
      "aksi": "tambah",
      "created_at": "2026-09-01 07:35:00"
    }
  ]
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "Waktu session login admin telah habis. Silahkan login kembali.",
  "data": null
}
```

---

### 9.13 Verifikasi Absen Single
- **Tipe:** `[CONTROLLER]` (`AbsenController::verifikasiAbsen`)
- **Method:** `POST`
- **Path:** `/api/admin/verifikasi`
- **Akses:** Bearer Token (Admin)

**Input Payload (JSON):**
```json
{
  "kode_akses": "KODE12",
  "nip": "123456789012345678",
  "status_verifikasi": "Terverifikasi Oleh Admin",
  "keterangan_verifikasi": "Disetujui Admin"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Status verifikasi berhasil diperbarui.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 400,
  "message": "Kode akses dan NIP wajib diisi.",
  "data": null
}
```

---

### 9.14 Verifikasi Absen Masal
- **Tipe:** `[CONTROLLER]` (`AbsenController::verifikasiAbsenMasal`)
- **Method:** `POST`
- **Path:** `/api/admin/verifikasi-masal`
- **Akses:** Bearer Token (Admin)

**Input Payload (JSON):**
```json
{
  "kode_akses": "KODE12",
  "nip_list": ["123456789012345678"],
  "status_verifikasi": "Terverifikasi Oleh Admin"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "1 data absensi berhasil diverifikasi.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 400,
  "message": "NIP list tidak boleh kosong.",
  "data": null
}
```

---

### 9.15 Entry Absensi Manual (Single)
- **Tipe:** `[CONTROLLER]` (`AbsenController::addAbsensiEntry`)
- **Method:** `POST`
- **Path:** `/api/admin/rekap/entry/{kode_akses}`
- **Akses:** Bearer Token (Admin)

**Input Payload (JSON):**
```json
{
  "nip": "123456789012345678",
  "status_kehadiran": "Hadir",
  "status_verifikasi": "Terverifikasi Oleh Admin",
  "keterangan": "Entry manual admin"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Entry absensi manual berhasil ditambahkan.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Pegawai dengan NIP tersebut tidak ditemukan.",
  "data": null
}
```

---

### 9.16 Entry Absensi Manual (Bulk)
- **Tipe:** `[CONTROLLER]` (`AbsenController::addAbsensiEntryBulk`)
- **Method:** `POST`
- **Path:** `/api/admin/rekap/entry/bulk/{kode_akses}`
- **Akses:** Bearer Token (Admin)

**Input Payload (JSON):**
```json
{
  "nip_list": ["123456789012345678"],
  "status_kehadiran": "Hadir",
  "status_verifikasi": "Terverifikasi Oleh Admin"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "1 entry absensi masal berhasil ditambahkan.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 400,
  "message": "Daftar NIP tidak boleh kosong.",
  "data": null
}
```

---

### 9.17 Eligible Pegawai untuk Entry Manual
- **Tipe:** `[CONTROLLER]` (`AbsenController::getEligiblePegawai`)
- **Method:** `POST`
- **Path:** `/api/admin/rekap/eligible-pegawai/{kode_akses}`
- **Akses:** Bearer Token (Admin)

**Input Payload (JSON):**
```json
{
  "opd": "Dinas Contoh"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OK",
  "data": [
    {
      "nip": "123456789012345678",
      "nama_pegawai": "Nama Pegawai Contoh"
    }
  ]
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Jadwal kegiatan tidak ditemukan.",
  "data": null
}
```

---

### 9.18 Hapus Entry Absensi (Single)
- **Tipe:** `[CONTROLLER]` (`AbsenController::deleteAbsensiEntry`)
- **Method:** `DELETE`
- **Path:** `/api/admin/rekap/entry/{kode_akses}/{nip}`
- **Akses:** Bearer Token (Admin)

**Input Params:** `{kode_akses}` = `KODE12`, `{nip}` = `123456789012345678`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Data absensi berhasil dihapus.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Data absensi tidak ditemukan.",
  "data": null
}
```

---

### 9.19 Hapus Entry Absensi (Bulk)
- **Tipe:** `[CONTROLLER]` (`AbsenController::deleteAbsensiEntryBulk`)
- **Method:** `POST`
- **Path:** `/api/admin/rekap/entry/bulk-delete`
- **Akses:** Bearer Token (Admin)

**Input Payload (JSON):**
```json
{
  "kode_akses": "KODE12",
  "nip_list": ["123456789012345678"]
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "1 data absensi berhasil dihapus.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 400,
  "message": "Daftar NIP dan kode akses wajib diisi.",
  "data": null
}
```

---

## 10. Master Data: Pegawai & OPD (Controller)

### 10.1 Refresh Profil Origin PHP
- **Tipe:** `[CONTROLLER]` (`MasterDataController::refreshProfil`)
- **Method:** `GET` / `POST`
- **Path:** `/api/profil/refresh` atau `/api/profil/sync`
- **Akses:** Bearer Token (ASN)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-01 15:09:36 WIB)
- **File Test:** `ROOT_PROJECT/tests/js/api-profil-sync.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" TEST_NIP="123456789012345678" TEST_NIK="1234567890123456" jest tests/js/api-profil-sync.test.js`

**Input:** Header `Authorization: Bearer <jwt_token>`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Profil berhasil disinkronkan.",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "pegawai_to_cache": {
      "nip": "123456789012345678",
      "nik": "$2a$10$hashedpassword...",
      "nama_pegawai": "Nama Pegawai Contoh",
      "perangkat_daerah": "Dinas Contoh",
      "jabatan": "Staf Contoh",
      "role": ["asn"],
      "jenis_asn": "PNS"
    }
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Data pegawai tidak ditemukan di database.",
  "data": null
}
```

---

### 10.2 Refresh Token Server Origin
- **Tipe:** `[CONTROLLER]` (`MasterDataController::refreshToken`)
- **Method:** `POST`
- **Path:** `/api/profil/refresh-token`
- **Akses:** Bearer Token (ASN)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-01 14:02:51 WIB)
- **File Test:** `ROOT_PROJECT/tests/js/api-profil-token.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" TEST_NIP="123456789012345678" TEST_NIK="1234567890123456" jest tests/js/api-profil-token.test.js`

**Input:** Header `Authorization: Bearer <jwt_token>`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Token berhasil diperbarui.",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "Waktu login Anda sudah habis. Silahkan login ulang.",
  "data": null
}
```

---

### 10.3 Update Profil Self Service
- **Tipe:** `[CONTROLLER]` (`MasterDataController::updateProfil`)
- **Method:** `PUT`
- **Path:** `/api/profil/update`
- **Akses:** Bearer Token (ASN)

**Input Payload (JSON):**
```json
{
  "jabatan": "Staf Kebijakan",
  "perangkat_daerah": "Dinas Contoh"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Profil berhasil diperbarui.",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "nama": "Nama Pegawai Contoh",
      "jabatan": "Staf Kebijakan",
      "opd": "Dinas Contoh"
    }
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 429,
  "message": "Anda hanya dapat mengubah profil sekali dalam sebulan. Perubahan berikutnya dapat dilakukan setelah 01 October 2026. Hubungi BKPSDM Kota Pariaman jika perlu perubahan mendesak.",
  "data": null
}
```

---

### 10.4 List Pegawai (Admin)
- **Tipe:** `[CONTROLLER]` (`MasterDataController::listPegawai`)
- **Method:** `GET`
- **Path:** `/api/admin/pegawai`
- **Akses:** Bearer Token (Admin)
- **Query Params:** `page=1&limit=10&search=Nama&opd=Dinas+Contoh`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Data pegawai berhasil diambil",
  "data": {
    "data": [
      {
        "nama_pegawai": "Nama Pegawai Contoh",
        "nip": "123456789012345678",
        "perangkat_daerah": "Dinas Contoh",
        "jabatan": "Staf Contoh",
        "jenis_asn": "PNS",
        "last_login": "2026-09-01 07:00:00",
        "kv_sync_status": 1,
        "role": "asn"
      }
    ],
    "pagination": {
      "total_rows": 1,
      "total_pages": 1,
      "current_page": 1,
      "limit": 10
    }
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "Waktu session login admin telah habis. Silahkan login kembali.",
  "data": null
}
```

---

### 10.5 Statistik Instalasi Pegawai
- **Tipe:** `[CONTROLLER]` (`MasterDataController::getPegawaiStats`)
- **Method:** `GET`
- **Path:** `/api/admin/pegawai/stats`
- **Akses:** Bearer Token (Admin)

**Input:** Header `Authorization: Bearer <admin_jwt>`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Statistik pegawai berhasil diambil",
  "data": {
    "total": 100,
    "installed": 80,
    "not_installed": 20
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "Waktu session login admin telah habis. Silahkan login kembali.",
  "data": null
}
```

---

### 10.6 Create Pegawai (Admin)
- **Tipe:** `[CONTROLLER]` (`MasterDataController::createPegawai`)
- **Method:** `POST`
- **Path:** `/api/admin/pegawai`
- **Akses:** Bearer Token (Admin/Super Admin)

**Input Payload (JSON):**
```json
{
  "nip": "123456789012345678",
  "nik": "1234567890123456",
  "nama_pegawai": "Nama Pegawai Baru",
  "perangkat_daerah": "Dinas Contoh",
  "jabatan": "Staf Contoh",
  "jenis_asn": "PNS",
  "role": ["asn"]
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Pegawai berhasil ditambahkan.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 409,
  "message": "NIP sudah terdaftar.",
  "data": null
}
```

---

### 10.7 Update Pegawai (Admin)
- **Tipe:** `[CONTROLLER]` (`MasterDataController::updatePegawai`)
- **Method:** `PUT`
- **Path:** `/api/admin/pegawai/{nip}`
- **Akses:** Bearer Token (Admin/Super Admin)

**Input Payload (JSON):**
```json
{
  "nama_pegawai": "Nama Pegawai Terupdate",
  "perangkat_daerah": "Dinas Contoh",
  "jabatan": "Analis",
  "jenis_asn": "PNS",
  "role": ["asn"]
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Data pegawai berhasil diperbarui.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 400,
  "message": "Semua field selain NIK wajib diisi.",
  "data": null
}
```

---

### 10.8 Delete Pegawai (Admin)
- **Tipe:** `[CONTROLLER]` (`MasterDataController::deletePegawai`)
- **Method:** `DELETE`
- **Path:** `/api/admin/pegawai/{nip}`
- **Akses:** Bearer Token (Admin)

**Input Param:** `{nip}` = `123456789012345678`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Pegawai berhasil dihapus.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Pegawai tidak ditemukan atau gagal dihapus.",
  "data": null
}
```

---

### 10.9 Sync Single Pegawai to KV Cache
- **Tipe:** `[CONTROLLER]` (`MasterDataController::syncPegawaiKvCache`)
- **Method:** `POST`
- **Path:** `/api/admin/pegawai/sync-kv/{nip}`
- **Akses:** Bearer Token (Admin)

**Input Param:** `{nip}` = `123456789012345678`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Cache berhasil disinkronkan dengan Cloudflare KV.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 503,
  "message": "Gagal menyinkronkan cache. Cloudflare KV mungkin sedang sibuk atau tidak dapat dijangkau. Coba lagi nanti.",
  "data": null
}
```

---

### 10.10 OPD List Public (Server Origin)
- **Tipe:** `[CONTROLLER]` (`MasterDataController::getListOpdPublic`)
- **Method:** `GET`
- **Path:** `/api/opd/list`
- **Akses:** Bearer Token (ASN)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-01 11:10:46 WIB)
- **File Test:** `ROOT_PROJECT/tests/js/api-opd.test.js`
- **Perintah Test:** `npx cross-env WORKER_URL="https://worker-example.domain.dev" ORIGIN_URL="https://api-origin.domain.go.id/api" TEST_NIP="123456789012345678" TEST_NIK="1234567890123456" jest tests/js/api-opd.test.js`

**Input:** Header `Authorization: Bearer <jwt_token>`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "List OPD berhasil diambil",
  "data": [
    "BKPSDM",
    "Dinas Pendidikan",
    "Diskominfo"
  ]
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "Waktu login Anda sudah habis. Silahkan login ulang.",
  "data": null
}
```

---

### 10.11 OPD List Admin
- **Tipe:** `[CONTROLLER]` (`MasterDataController::listOpd`)
- **Method:** `GET`
- **Path:** `/api/admin/opd`
- **Akses:** Bearer Token (Admin)

**Input:** Header `Authorization: Bearer <admin_jwt>`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OK",
  "data": [
    {
      "nama_opd": "BKPSDM",
      "id": "BKPSDM"
    }
  ]
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "Waktu session login admin telah habis. Silahkan login kembali.",
  "data": null
}
```

---

### 10.12 Create OPD
- **Tipe:** `[CONTROLLER]` (`MasterDataController::createOpd`)
- **Method:** `POST`
- **Path:** `/api/admin/opd`
- **Akses:** Bearer Token (Admin)

**Input Payload (JSON):**
```json
{
  "nama_opd": "Dinas Baru"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OPD berhasil ditambahkan.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 409,
  "message": "Nama OPD sudah ada.",
  "data": null
}
```

---

### 10.13 Update OPD
- **Tipe:** `[CONTROLLER]` (`MasterDataController::updateOpd`)
- **Method:** `PUT`
- **Path:** `/api/admin/opd/{id}`
- **Akses:** Bearer Token (Admin)

**Input Payload (JSON):**
```json
{
  "nama_opd": "Dinas Baru Terupdate"
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OPD berhasil diperbarui.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 400,
  "message": "Nama OPD lama dan baru wajib diisi.",
  "data": null
}
```

---

### 10.14 Delete OPD
- **Tipe:** `[CONTROLLER]` (`MasterDataController::deleteOpd`)
- **Method:** `DELETE`
- **Path:** `/api/admin/opd/{id}`
- **Akses:** Bearer Token (Admin)

**Input Param:** `{id}` = `Dinas Baru`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OPD berhasil dihapus.",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 500,
  "message": "Gagal menghapus OPD.",
  "data": null
}
```

---

### 10.15 Sync OPD List to KV Cache (Controller)
- **Tipe:** `[CONTROLLER]` (`MasterDataController::syncOpdToKv`)
- **Method:** `POST`
- **Path:** `/api/admin/opd/sync-kv`
- **Akses:** Bearer Token (Admin)

**Input:** Header `Authorization: Bearer <admin_jwt>`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Daftar OPD berhasil disinkronkan ke cache (KV).",
  "data": null
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 503,
  "message": "Gagal menyinkronkan cache. Worker mungkin sibuk atau tidak dapat dijangkau.",
  "data": null
}
```

---

## 11. Manajemen Jadwal Kegiatan (Admin)

### 11.1 List & Search Data Jadwal Kegiatan
- **Tipe:** `[CONTROLLER]` (`JadwalController::listJadwal`)
- **Method:** `GET`
- **Path:** `/api/admin/jadwal`
- **Query Params:** `page` (default 1), `limit` (default 10), `search` (opsional), `kategori` (opsional)
- **Akses:** Bearer Token (Admin / Super Admin)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-02)
- **File Test:** `ROOT_PROJECT/tests/js/api-admin-jadwal-crud.test.js`
- **Perintah Test:** `npx cross-env ORIGIN_URL="https://api-origin.domain.dev" TEST_ADMIN_USERNAME="admin" TEST_ADMIN_PASSWORD="password" npx jest tests/js/api-admin-jadwal-crud.test.js`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OK",
  "data": {
    "data": [
      {
        "id": 1,
        "kode_akses": "TEST12",
        "judul": "Apel Pagi",
        "kategori": "Apel Pagi",
        "tanggal": "2026-09-02",
        "jam_mulai": "07:30:00",
        "jam_selesai": "09:00:00",
        "koordinat": "-0.626411,100.124588",
        "radius_meter": 100,
        "is_strict_time": 1,
        "is_strict_location": 1
      }
    ],
    "pagination": {
      "total_rows": 1,
      "total_pages": 1,
      "current_page": 1,
      "limit": 10
    }
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 401,
  "message": "Waktu login Anda sudah habis. Silahkan login ulang.",
  "data": null
}
```

---

### 11.2 Create Jadwal Kegiatan Baru
- **Tipe:** `[CONTROLLER]` (`JadwalController::createJadwal`)
- **Method:** `POST`
- **Path:** `/api/admin/jadwal`
- **Akses:** Bearer Token (Admin / Super Admin)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-02)
- **File Test:** `ROOT_PROJECT/tests/js/api-admin-jadwal-crud.test.js`

**Input Payload (JSON):**
```json
{
  "judul": "Uji Coba Presensi Pagi",
  "kategori": "Apel Pagi",
  "tanggal": "2026-09-02",
  "jam_mulai": "07:30:00",
  "jam_selesai": "10:00:00",
  "koordinat": "-0.626411,100.124588",
  "radius_meter": 100,
  "aktifkan_antrian": 1,
  "is_strict_time": 1,
  "is_strict_location": 1,
  "target_opd": ["BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA"]
}
```

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Jadwal berhasil dibuat.",
  "data": {
    "kode_akses": "6A1362"
  }
}
```

---

### 11.3 Get Detail Jadwal Kegiatan
- **Tipe:** `[CONTROLLER]` (`JadwalController::getJadwalAdmin`)
- **Method:** `GET`
- **Path:** `/api/admin/jadwal/{kode_akses}`
- **Akses:** Bearer Token (Admin / Super Admin)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-02)
- **File Test:** `ROOT_PROJECT/tests/js/api-admin-jadwal-crud.test.js`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "OK",
  "data": {
    "kode_akses": "6A1362",
    "judul": "Uji Coba Presensi Pagi",
    "kategori": "Apel Pagi",
    "tanggal": "2026-09-02",
    "jam_mulai": "07:30:00",
    "jam_selesai": "10:00:00",
    "target_opd": ["BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA"]
  }
}
```

**Output Error (`status: false`):**
```json
{
  "status": false,
  "code": 404,
  "message": "Jadwal tidak ditemukan.",
  "data": null
}
```

---

### 11.4 Update Jadwal Kegiatan
- **Tipe:** `[CONTROLLER]` (`JadwalController::updateJadwal`)
- **Method:** `PUT`
- **Path:** `/api/admin/jadwal/{kode_akses}`
- **Akses:** Bearer Token (Admin / Super Admin)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-02)
- **File Test:** `ROOT_PROJECT/tests/js/api-admin-jadwal-crud.test.js`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Jadwal berhasil diperbarui.",
  "data": null
}
```

---

### 11.5 Generate Token QR Code Jadwal
- **Tipe:** `[CONTROLLER]` (`JadwalController::generateJadwalToken`)
- **Method:** `GET`
- **Path:** `/api/admin/jadwal/generate-token/{kode_akses}`
- **Akses:** Bearer Token (Admin / Super Admin)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-02)
- **File Test:** `ROOT_PROJECT/tests/js/api-admin-jadwal-crud.test.js`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Token jadwal berhasil dibuat",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 11.6 Sync KV Cache Jadwal Manual
- **Tipe:** `[CONTROLLER]` (`JadwalController::syncKvCache`)
- **Method:** `POST`
- **Path:** `/api/admin/jadwal/sync-kv/{kode_akses}`
- **Akses:** Bearer Token (Admin / Super Admin)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-02)
- **File Test:** `ROOT_PROJECT/tests/js/api-admin-jadwal-crud.test.js`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Cache berhasil disinkronkan dengan Cloudflare KV.",
  "data": null
}
```

---

### 11.7 Delete Jadwal Kegiatan
- **Tipe:** `[CONTROLLER]` (`JadwalController::deleteJadwal`)
- **Method:** `DELETE`
- **Path:** `/api/admin/jadwal/{kode_akses}`
- **Akses:** Bearer Token (Admin / Super Admin)
- **Status Test:** ✅ SUKSES TERUJI (2026-09-02)
- **File Test:** `ROOT_PROJECT/tests/js/api-admin-jadwal-crud.test.js`

**Output Berhasil (`status: true`):**
```json
{
  "status": true,
  "code": 200,
  "message": "Jadwal berhasil dihapus dari database.",
  "data": null
}
```
