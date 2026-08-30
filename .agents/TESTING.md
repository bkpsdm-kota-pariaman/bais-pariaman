# TESTING — BAIS Pariaman

> Panduan QA dan Automated Testing untuk aplikasi BAIS BALAD.
>
> **Version:** v2.0.0

---

## 1. Tujuan Testing

Testing bertujuan memastikan aplikasi BAIS BALAD benar-benar bekerja sesuai perilaku user.

Prioritas:

1. Menguji perilaku aplikasi sebenarnya.
2. Menemukan bug nyata.
3. Memastikan alur user berjalan dari awal sampai akhir.
4. Memastikan perubahan kode tidak merusak fitur existing.
5. Memastikan E2E menggunakan browser dan aplikasi sebenarnya.

**E2E test bukan dibuat sekadar supaya status PASS.**

**E2E test dibuat untuk membuktikan aplikasi benar-benar bekerja.**

---

## 2. Testing Layers

### 2.1 Unit Test

Digunakan untuk menguji logic kecil secara terisolasi.

Contoh:

- utility
- helper
- validasi
- transformasi data
- worker logic

Mock/stub diperbolehkan jika memang diperlukan.

### 2.2 Integration Test

Digunakan untuk menguji komunikasi antar-komponen.

Contoh:

```text
Frontend → API
API → Database
Worker → API
Authentication → API
```

Mock diperbolehkan jika memang diperlukan.

### 2.3 End-to-End Test

E2E menggunakan aplikasi sebenarnya melalui browser.

Playwright harus bertindak seperti user.

```text
User
 ↓
Browser
 ↓
BAIS sebenarnya
 ↓
API sebenarnya
 ↓
Database / service
 ↓
Hasil sebenarnya
```

---

## 3. E2E Environment BAIS

### 3.1 Arsitektur E2E Wajib

E2E Playwright project ini menggunakan:

```text
Playwright
    ↓
Browser
    ↓
Frontend BAIS asli
    ↓
Local Web Server
    ↓
docs/
    ↓
app.js / admin.js asli
    ↓
Remote Backend BAIS Testing
    ↓
Database / Service Testing
```

Frontend dijalankan secara lokal hanya untuk menyajikan frontend BAIS asli hasil build.

Backend **TIDAK dijalankan secara lokal** untuk E2E.

Backend E2E **WAJIB menggunakan remote backend BAIS khusus environment testing** yang sudah dikonfigurasi pada JavaScript aplikasi.

---

### 3.2 Frontend

Folder:

```text
docs/
```

berisi hasil build frontend BAIS.

Playwright boleh menggunakan local web server untuk menyajikan folder tersebut.

Contoh:

```text
http://127.0.0.1:4173
```

Localhost di sini **BUKAN fake application**.

Localhost hanya web server untuk menyajikan frontend BAIS sebenarnya.

Jangan membuat:

- fake HTML
- fake frontend
- mock page
- test-only frontend
- aplikasi pengganti

---

### 3.3 Backend

Backend E2E harus menggunakan remote backend testing.

Frontend saat ini menentukan API melalui JavaScript aplikasi:

```javascript
const ORIGIN_SERVER_URL = "https://api-esdm.pariamankota.go.id/beta-bais-pariaman";
const API_BASE_URL = `${ORIGIN_SERVER_URL}/api`;
```

Untuk admin:

```javascript
const ORIGIN_SERVER_URL = 'https://api-esdm.pariamankota.go.id/beta-bais-pariaman';
const API_BASE_URL = `${ORIGIN_SERVER_URL}/api`;
```

URL tersebut adalah environment backend testing yang digunakan E2E.

**Jangan mengganti URL tersebut ke localhost.**

**Jangan membuat backend mock untuk menggantikannya.**

**Jangan mengarahkan E2E ke production backend.**

---

### 3.4 Worker

`app.js` juga menggunakan:

```javascript
const WORKER_URL = "...";
```

Sebelum membuat E2E yang melewati Worker, periksa apakah `WORKER_URL` menunjuk environment testing yang benar.

Jangan mengganti Worker production/testing secara sembarangan.

---

### 3.5 Aturan Mutlak Environment

```text
FRONTEND:
Localhost + docs/ + frontend BAIS asli.

BACKEND:
Remote + backend BAIS testing asli.

WORKER:
Environment yang sesuai dengan backend testing.

BROWSER:
Browser Playwright asli.

API:
API asli untuk E2E normal.

DATABASE:
Database yang digunakan remote testing backend.
```

Jangan menggunakan:

```text
fake frontend
fake HTML
fake backend
fake API
fake server
mock API
production backend
```

untuk menggantikan environment E2E normal.

---

### 3.6 Tidak Perlu Mengubah API URL untuk Playwright

Playwright `baseURL` hanya digunakan untuk membuka frontend:

```javascript
use: {
    baseURL: 'http://127.0.0.1:4173'
}
```

Contoh:

```javascript
await page.goto('/');
```

Browser kemudian menjalankan JavaScript frontend sebenarnya.

Request API akan mengikuti konfigurasi `API_BASE_URL` yang ada pada aplikasi.

Jangan membuat Playwright memanggil API secara langsung sebagai pengganti user interaction jika tujuan test adalah E2E.

---

### 3.7 Prinsip Utama

E2E harus merepresentasikan:

```text
User
 ↓
Browser
 ↓
BAIS frontend asli
 ↓
Internet
 ↓
BAIS backend testing asli
 ↓
Testing database/service
```

Perbedaan dari user nyata hanya:

```text
Frontend disajikan dari localhost
```

Tujuan E2E adalah menguji **behavior aplikasi sebenarnya**, bukan membuat test environment yang mudah menghasilkan PASS.

---

## 4. Build Application

Jika E2E membutuhkan hasil build, gunakan build aplikasi sebenarnya:

```bash
npm run build
```

Build menghasilkan output aplikasi pada:

```text
docs/
```

Jangan membuat build khusus yang mengubah behavior aplikasi hanya untuk testing.

---

## 5. User-Like Interaction

Gunakan Playwright untuk mensimulasikan tindakan user.

Utamakan:

```javascript
page.goto()
page.getByRole()
page.getByLabel()
page.getByText()
page.getByPlaceholder()
page.fill()
page.click()
page.selectOption()
page.check()
page.uncheck()
```

Contoh:

```javascript
await page.goto('/');

await page.getByLabel('Username').fill(USERNAME);
await page.getByLabel('Password').fill(PASSWORD);
await page.getByRole('button', { name: 'Login' }).click();

await expect(page.getByText('Berhasil login')).toBeVisible();
```

Jangan mengganti user interaction dengan pemanggilan internal function aplikasi.

---

## 6. Production Code Protection

Production code tidak boleh diubah hanya agar test lulus.

SALAH:

```text
Test gagal
↓
Ubah aplikasi
↓
Validasi dihapus
↓
Test PASS
```

BENAR:

```text
Test gagal
↓
Analisis
↓
Test bug? → Perbaiki test
Application bug? → Perbaiki aplikasi
Environment bug? → Perbaiki environment / laporkan blocker
Requirement unclear? → Laporkan
```

---

## 7. Mocking Policy

### Unit Test

Mock diperbolehkan.

### Integration Test

Mock diperbolehkan jika memang diperlukan.

### E2E Test

Default:

```text
JANGAN MOCK BACKEND/API.
```

E2E normal harus menggunakan backend sebenarnya.

Mock hanya untuk skenario khusus seperti:

```text
API timeout
API error
server unavailable
network failure
```

UI tetap harus menggunakan aplikasi BAIS sebenarnya.

---

## 8. Test Data

Gunakan:

```text
Database seed
Dedicated test account
Test fixture
Dedicated test database
API setup
```

Test data tidak boleh dibuat dengan mengubah behavior production.

Jangan membuat endpoint palsu hanya agar Playwright mendapatkan data tertentu.

---

## 9. Login ASN

Simulasikan user ASN:

```text
Buka aplikasi
↓
Halaman login tampil
↓
Isi username
↓
Isi password
↓
Klik Login
↓
Authentication berjalan
↓
Halaman ASN tampil
```

Verifikasi:

- halaman login
- input username
- input password
- validasi
- login berhasil
- session/authentication
- halaman tujuan

Jangan bypass login ketika tujuan test adalah menguji login.

---

## 10. Scan QR dan Absensi

Simulasikan proses absensi sebenarnya:

```text
Login ASN
↓
Buka halaman absensi
↓
Akses fitur scan
↓
Scan QR
↓
Data QR diterima
↓
Submit absensi
↓
Backend memproses
↓
Hasil absensi tampil
```

Gunakan capability Playwright untuk permission kamera jika diperlukan.

Jangan mengganti scan dengan internal function call.

Jangan mengubah production code hanya supaya kamera tidak diperlukan.

---

## 11. Offline dan Sync

Gunakan aplikasi sebenarnya.

```text
User login
↓
Buka halaman absensi
↓
Network offline
↓
User melakukan absensi
↓
Aplikasi menyimpan data offline
↓
Network kembali online
↓
Aplikasi melakukan sync
↓
Data terkirim
↓
UI menunjukkan hasil sync
```

Gunakan network control Playwright.

Jangan membuat fake server untuk mensimulasikan offline.

---

## 12. Login Admin

```text
Buka aplikasi admin
↓
Isi username
↓
Isi password
↓
Klik Login
↓
Dashboard admin tampil
```

Verifikasi authentication, role, dan dashboard.

---

## 13. Laporan Rekapitulasi

```text
Login admin
↓
Buka laporan
↓
Pilih filter
↓
Tampilkan data
↓
Verifikasi rekap
```

Jika ada export:

```text
Klik export
↓
Tunggu download
↓
Verifikasi file berhasil dibuat
```

Jangan menganggap laporan benar hanya karena API memberikan:

```text
HTTP 200
```

---

## 14. Assertion

Assertion harus memeriksa hasil bermakna bagi user.

Buruk:

```javascript
expect(response.status()).toBe(200);
```

Lebih baik:

```javascript
await expect(page.getByText('Absensi berhasil')).toBeVisible();
```

Jika memungkinkan:

```javascript
await expect(page.getByText('Absensi berhasil')).toBeVisible();
await expect(page.getByText('08:00')).toBeVisible();
```

Jangan melemahkan assertion hanya agar test PASS.

---

## 15. Test Failure Handling

### Application Bug

Aplikasi memang salah.

Perbaiki aplikasi jika memang bug.

### Test Bug

Test salah.

Perbaiki test.

### Environment Bug

Laporkan:

```text
E2E BLOCKED: application environment unavailable
```

Jangan membuat fake application/server.

### Requirement Tidak Jelas

Laporkan:

```text
TEST BLOCKED: requirement unclear
```

Jangan menebak behavior penting.

---

## 16. Playwright Structure

Struktur yang disarankan:

```text
tests/
├── e2e/
│   ├── login-asn.spec.js
│   ├── attendance.spec.js
│   ├── offline-sync.spec.js
│   ├── login-admin.spec.js
│   └── reports.spec.js
│
├── integration/
└── unit/
```

Sesuaikan dengan struktur existing jika sudah tersedia.

---

## 17. Test Commands

Unit:

```bash
npm run test:unit
```

E2E:

```bash
npm run test:e2e
```

Semua:

```bash
npm run test
```

Build:

```bash
npm run build
```

Jangan menyatakan test PASS jika test belum dijalankan.

---

## 18. E2E Development Workflow

```text
1. Baca AGENTS.md
        ↓
2. Baca TESTING.md
        ↓
3. Baca TASK_INSTRUCTION.md
        ↓
4. Baca ARCHITECTURE.md
        ↓
5. Baca source terkait
        ↓
6. Identifikasi URL frontend
        ↓
7. Identifikasi remote testing API
        ↓
8. Identifikasi Worker jika digunakan
        ↓
9. Identifikasi authentication
        ↓
10. Identifikasi test account
        ↓
11. Identifikasi alur UI sebenarnya
        ↓
12. Buat Playwright test
        ↓
13. Jalankan test
        ↓
14. Analisis failure
        ↓
15. Tentukan akar masalah
        ↓
16. Perbaiki akar masalah
        ↓
17. Jalankan ulang test
        ↓
18. Verifikasi hasil
```

---

## 19. Aturan Mutlak untuk AI Coding Agent

```text
NEVER modify application code solely to make a test pass.

NEVER create fake application/server to make E2E test pass.

NEVER create fake HTML to make E2E test pass.

NEVER replace real user interaction with internal function calls in E2E tests.

NEVER mock the real backend in normal E2E tests.

NEVER manipulate DOM solely to satisfy test assertions.

NEVER weaken assertions solely to make a test pass.

NEVER bypass authentication when testing authentication.

NEVER claim E2E success when testing a fake application.

NEVER treat HTTP 200 alone as proof that E2E behavior is correct.

NEVER redirect the E2E frontend to localhost API when remote testing API is configured.

NEVER redirect E2E to production backend.

ALWAYS serve the real BAIS frontend from `docs/` through a local web server.

ALWAYS use the real remote BAIS testing backend for normal E2E.

ALWAYS use the real BAIS frontend JavaScript.

ALWAYS use Playwright browser interaction as a real user would.

ALWAYS test user-visible behavior.

IF the real application cannot be started or accessed, report the environment blocker.

IF the application has a real bug, report and fix the real bug rather than hiding it.

IF the test is wrong, fix the test.

IF the environment is wrong, fix the environment or report the blocker.

IF the requirement is unclear, stop and report the ambiguity.

DO NOT invent missing architecture or behavior.

DO NOT change production behavior only for testing convenience.
```

---

## 20. Definition of Done

E2E test valid jika:

- menggunakan aplikasi BAIS sebenarnya
- menggunakan browser Playwright
- mengikuti alur user
- menggunakan UI sebenarnya
- menggunakan remote backend testing sebenarnya
- menggunakan Worker testing sebenarnya jika flow membutuhkannya
- tidak menggunakan fake application
- tidak menggunakan fake server
- tidak menggunakan fake HTML
- tidak memanipulasi DOM untuk membuat test PASS
- tidak bypass authentication
- tidak mengubah production code hanya agar test PASS
- memiliki assertion bermakna
- dapat gagal ketika aplikasi rusak
- dapat berhasil ketika aplikasi benar-benar bekerja
- dapat dijalankan ulang secara konsisten

---

## 21. Tujuan Akhir

Testing bukan perlombaan membuat:

```text
PASS
PASS
PASS
```

Testing bertujuan mengetahui kondisi sebenarnya:

```text
USER
 ↓
BROWSER
 ↓
BAIS BALAD FRONTEND ASLI
 ↓
REMOTE BAIS TESTING API
 ↓
DATABASE / SERVICE TESTING
 ↓
HASIL SEBENARNYA
```

Frontend localhost hanya media untuk menyajikan frontend asli.

**Jangan mengubah aplikasi agar test PASS.**

**Perbaiki akar masalah.**
