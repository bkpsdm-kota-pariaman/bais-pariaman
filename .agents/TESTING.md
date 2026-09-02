# TESTING — BAIS Pariaman

> Panduan QA dan Automated Testing untuk aplikasi BAIS PARIAMAN.
>
> **Version:** v2.1.0

---

## 1. Tujuan Testing

Testing bertujuan memastikan aplikasi BAIS PARIAMAN benar-benar bekerja sesuai perilaku user.

Prioritas:

1. Menguji perilaku aplikasi sebenarnya.
2. Menemukan bug nyata.
3. Memastikan alur user berjalan dari awal sampai akhir.
4. Memastikan perubahan kode tidak merusak fitur existing.
5. Memastikan E2E menggunakan browser dan aplikasi sebenarnya.
6. Memastikan tidak ada JavaScript error yang tidak diharapkan pada browser selama test.

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

Playwright `baseURL` hanya digunakan untuk membuka frontend.

Contoh:

```javascript
use: {
    baseURL: 'http://127.0.0.1:4173'
}
```

Browser kemudian menjalankan JavaScript frontend sebenarnya.

Request API akan mengikuti konfigurasi `API_BASE_URL` yang ada pada aplikasi.

Jangan membuat Playwright memanggil API secara langsung sebagai pengganti user interaction jika tujuan test adalah E2E.

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

## 6. Browser Console dan JavaScript Error

E2E test **WAJIB memeriksa browser console**.

Test tidak boleh dianggap PASS jika selama alur E2E terdapat JavaScript error yang tidak diharapkan.

### 6.1 Error yang Harus Dideteksi

Minimal tangkap:

```text
console.error
pageerror
unhandled exception
unhandled rejection
```

Gunakan Playwright untuk menangkap error.

Contoh:

```javascript
const consoleErrors = [];
const pageErrors = [];

page.on('console', msg => {
    if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
    }
});

page.on('pageerror', error => {
    pageErrors.push(error.message);
});
```

Setelah alur test selesai, periksa:

```javascript
expect(consoleErrors).toEqual([]);
expect(pageErrors).toEqual([]);
```

### 6.2 Error yang Tampil Merah di Browser Console

Tujuan utama adalah memastikan tidak ada error browser yang muncul sebagai:

```text
ERROR
```

atau pesan console berlevel:

```text
error
```

atau uncaught JavaScript error.

Jika browser DevTools akan menampilkan pesan tersebut sebagai error berwarna merah, E2E harus menganggapnya sebagai kegagalan kecuali sudah dinyatakan sebagai pengecualian yang valid.

### 6.3 Jangan Mengabaikan Semua Console Error

Dilarang membuat filter seperti:

```javascript
page.on('console', () => {});
```

hanya agar error tidak terlihat.

Dilarang membuang semua error:

```javascript
consoleErrors.length = 0;
```

Dilarang menonaktifkan listener agar test PASS.

Jika ada console error, cari akar masalahnya.

### 6.4 Error yang Memang Diharapkan

Tidak semua pesan console otomatis merupakan bug.

Jika suatu error memang disengaja dan valid untuk skenario tertentu, pengecualian harus ditulis eksplisit.

Contoh:

```javascript
const allowedConsoleErrors = [
    'contoh error yang memang diharapkan'
];
```

Pengecualian harus:

1. spesifik
2. memiliki alasan
3. terbatas pada pesan yang benar-benar diharapkan
4. tidak digunakan untuk menyembunyikan bug

Jangan menggunakan:

```javascript
return true;
```

atau filter terlalu umum yang mengabaikan semua error.

### 6.5 Definition of Done Console

E2E normal dianggap PASS jika:

```text
UI behavior benar
+
Assertion benar
+
Tidak ada unexpected console.error
+
Tidak ada pageerror
=
E2E PASS
```

Jika UI PASS tetapi browser menghasilkan unexpected JavaScript error:

```text
TEST FAIL
```

Jangan mengubah assertion menjadi lebih lemah.

Jangan mengubah production code hanya untuk menghilangkan error tanpa memahami akar masalah.

---

## 7. Production Code Protection

Production code tidak boleh diubah hanya agar test lulus.

SALAH:

```text
Test gagal
↓
Ubah aplikasi
↓
Error disembunyikan
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
Console error? → Cari akar masalah
Environment bug? → Perbaiki environment / laporkan blocker
Requirement unclear? → Laporkan
```

---

## 8. Mocking Policy

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

## 9. Test Data

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

## 10. Login ASN

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

## 11. Scan QR dan Absensi

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

## 12. Offline dan Sync

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

## 13. Login Admin

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

## 14. Laporan Rekapitulasi

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

## 15. Input Typing Policy

Semua input yang mewakili tindakan user harus menggunakan **pengetikan asli per karakter**.

Berlaku untuk:

- input text
- input number
- input search
- kotak pencarian
- textarea
- username
- password
- kode akses
- NIP
- nama
- jabatan
- keterangan
- filter pencarian
- field form lain yang diketik user

### Wajib

Gunakan Playwright `pressSequentially()` dengan delay:

```javascript
await page.locator('#inpKode').pressSequentially('1F0442', { delay: 100 });
```

Contoh:

```javascript
await page.getByLabel('Username').pressSequentially(USERNAME, { delay: 100 });
```

Textarea:

```javascript
await page.locator('#keterangan').pressSequentially('Keterangan test', { delay: 100 });
```

Kotak pencarian:

```javascript
await page.locator('#search').pressSequentially('pegawai', { delay: 100 });
```

Password:

```javascript
await page.getByLabel('Password').pressSequentially(PASSWORD, { delay: 100 });
```

### DILARANG

Jangan menggunakan:

```javascript
page.fill()
```

untuk input yang seharusnya merepresentasikan pengetikan user.

Jangan menggunakan:

```javascript
locator.fill()
```

untuk input user.

Jangan menggunakan:

```javascript
locator.evaluate(...)
```

untuk memasukkan text secara langsung.

Jangan menggunakan JavaScript DOM manipulation untuk mengisi nilai input:

```javascript
document.querySelector(...).value = ...
```

Jangan menggunakan:

```javascript
input.dispatchEvent(...)
```

sebagai pengganti pengetikan user.

Jangan menggunakan metode lain yang memasukkan seluruh text sekaligus.

### Aturan 100ms

Setiap karakter harus diketik dengan:

```javascript
{ delay: 100 }
```

Contoh:

```javascript
await page.locator('#inpNama').pressSequentially(
    'EGO DAFMA DASA',
    { delay: 100 }
);
```

Tujuan:

```text
User mengetik karakter
↓
Aplikasi menerima event keyboard/input
↓
Validasi frontend berjalan
↓
UI memperbarui state
↓
Karakter berikutnya diketik
```

Bukan:

```text
Set seluruh text sekaligus
↓
PASS
```

### Clear Existing Value

Jika field sudah memiliki nilai dan perlu dikosongkan sebelum mengetik, gunakan interaksi keyboard/browser yang merepresentasikan tindakan user.

Contoh:

```javascript
await page.locator('#search').click();
await page.locator('#search').press('Control+A');
await page.locator('#search').press('Backspace');
await page.locator('#search').pressSequentially('pegawai', { delay: 100 });
```

Jangan menggunakan `fill('')` untuk menggantikan tindakan user.

### Pengecualian

`setInputFiles()` boleh digunakan untuk test upload file karena user memilih file melalui file picker dan Playwright memang menyediakan API khusus untuk file input.

Contoh:

```javascript
await page.setInputFiles('#inpFotoFile', {
    name: 'foto-selfie-test.jpg',
    mimeType: 'image/jpeg',
    buffer: dummyJpegBuffer
});
```

Aturan pengetikan per karakter berlaku untuk **text input**, bukan file upload.

---

## 16. Assertion

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

## 17. Test Failure Handling

### Application Bug

Aplikasi memang salah.

Perbaiki aplikasi jika memang bug.

### Test Bug

Test salah.

Perbaiki test.

### Console Error

Jika ada unexpected browser console error atau `pageerror`, test harus dianggap gagal dan langsung stop proses test.

Jangan mengabaikan error hanya karena assertion UI PASS.

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

## 19. Playwright Structure

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

## 18. Test Execution Policy

Test **TIDAK BOLEH dijalankan otomatis oleh AI coding agent**.

AI boleh:

- membuat test
- memperbaiki test
- membaca konfigurasi testing
- menganalisis hasil test yang diberikan user
- menampilkan command untuk menjalankan test

AI **tidak boleh menjalankan**:

```text
npm run test
npm run test:unit
npm run test:e2e
npx jest
npx playwright test
```

atau command testing lain secara otomatis setelah membuat atau mengubah test.

### User Menjalankan Test

Hanya user yang menjalankan automated test.

Setelah selesai membuat atau mengubah test, AI harus menampilkan command yang dapat dijalankan user.

Contoh:

```bash
npm run test:e2e
```

Test tertentu:

```bash
npx playwright test tests/e2e/pwa-absensi-cadangan.spec.js
```

Mode headed:

```bash
npx playwright test tests/e2e/pwa-absensi-cadangan.spec.js --headed
```

AI tidak boleh mengklaim test PASS/FAIL sebelum user menjalankan test dan memberikan hasilnya.

Jika AI diminta menjalankan test, tetap jangan menjalankannya. Berikan command yang tepat kepada user.

---

## 20. Test Commands

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

## 21. E2E Development Workflow

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
12. Pasang monitoring console/page errors
        ↓
13. Buat Playwright test
        ↓
14. Jalankan test
        ↓
15. Analisis failure
        ↓
16. Periksa UI assertion + console error + pageerror
        ↓
17. Tentukan akar masalah
        ↓
18. Perbaiki akar masalah
        ↓
19. Jalankan ulang test
        ↓
20. Verifikasi hasil
```

---

## 22. Aturan Mutlak untuk AI Coding Agent

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

NEVER ignore unexpected browser console errors just because UI assertions pass.

NEVER disable console/page error monitoring just to make tests pass.

NEVER add broad console-error exclusions to hide failures.

ALWAYS serve the real BAIS frontend from `docs/` through a local web server.

ALWAYS use the real remote BAIS testing backend for normal E2E.

ALWAYS use the real BAIS frontend JavaScript.

ALWAYS use Playwright browser interaction as a real user would.

ALWAYS test user-visible behavior.

ALWAYS monitor `console.error` and `pageerror` during E2E.

NEVER automatically execute automated tests after creating or modifying tests.

NEVER run test commands unless the user explicitly runs them outside the AI agent workflow.

ALWAYS provide the exact test command for the user to run.

ALWAYS use real per-character typing for text input with `{ delay: 100 }`.

NEVER use `page.fill()` or `locator.fill()` for user text input.

NEVER set input values directly through DOM manipulation.


ALWAYS fail E2E when unexpected JavaScript errors occur.

IF an error is intentionally expected, document a narrow explicit exception.

IF the real application cannot be started or accessed, report the environment blocker.

IF the application has a real bug, report and fix the real bug rather than hiding it.

IF the test is wrong, fix the test.

IF the environment is wrong, fix the environment or report the blocker.

IF the requirement is unclear, stop and report the ambiguity.

DO NOT invent missing architecture or behavior.

DO NOT change production behavior only for testing convenience.
```

---

## 23. Definition of Done

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
- tidak memiliki unexpected `console.error`
- tidak memiliki unexpected `pageerror`
- dapat gagal ketika aplikasi rusak
- dapat berhasil ketika aplikasi benar-benar bekerja
- dapat dijalankan ulang secara konsisten

---

## 24. Tujuan Akhir

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
BAIS PARIAMAN FRONTEND ASLI
 ↓
REMOTE BAIS TESTING API
 ↓
DATABASE / SERVICE TESTING
 ↓
HASIL SEBENARNYA
```

Frontend localhost hanya media untuk menyajikan frontend asli.

Kondisi PASS yang valid:

```text
UI benar
+
Assertion benar
+
Console bersih dari unexpected error
+
Tidak ada pageerror
+
Backend testing benar-benar digunakan
=
E2E PASS
```

**Jangan mengubah aplikasi agar test PASS.**

**Perbaiki akar masalah.**

---

## 25. Standarisasi Logging pada Test Code

Dalam pembuatan atau pembaruan kode pengujian (Jest Unit/Integration maupun Playwright E2E), setiap skenario pengujian **WAJIB mencantumkan log terstruktur** yang informatif saat test dijalankan.

### Komponen Log Wajib:

1. **Log Langkah (`step_number` / `step_title`):** Nomor atau urutan langkah pengujian yang sedang dieksekusi.
2. **Nama Aksi (`action_name`):** Deskripsi aksi spesifik yang dilakukan (contoh: `"Submit Absensi Hadir Tanpa Foto"`, `"Login Admin via API"`).
3. **Data yang Dikirim ke Server (`request_payload` / `headers`):** Menampilkan payload JSON dan header HTTP yang dikirim (string Base64 gambar/berkas wajib dipangkas agar log tidak memenuhkan layar).
4. **Response Fetch Data dari Server (`response_status` & `response_body`):** HTTP status code riil dan payload JSON yang dikembalikan oleh server backend / Worker.
5. **Output Harapan (`expected_output`):** Ekspektasi status code, status boolean (`true`/`false`), dan pesan error/sukses yang diharapkan dari kontrak API.
6. **Output yang Muncul (`actual_output` / `match_status`):** Menampilkan hasil riil perbandingan antara ekspektasi dan respon aktual beserta indikator status (`✅ LULUS / PASS` atau `❌ GAGAL / FAIL`).

### Format Log Baku Contoh:

```text
=================================================================
LANGKAH TEST  : 1 / 10
NAMA AKSI     : Submit Absensi Hadir Tanpa Foto Selfie
SERVER TARGET : WORKER EDGE (https://worker.domain.dev/api/absen/submit)
HTTP METHOD   : POST
DATA DIKIRIM  : { "kode_akses": "KODETEST", "status_kehadiran": "Hadir" }
RESPON SERVER : HTTP 422 - { "status": false, "code": 422, "message": "Foto / bukti dukung wajib diisi." }
OUTPUT HARAPAN: { "status": false, "code": 422, "message": "Foto / bukti dukung wajib diisi." }
OUTPUT MUNCUL : { "status": false, "code": 422, "message": "Foto / bukti dukung wajib diisi." }
STATUS TEST   : ✅ LULUS (PASS)
=================================================================
```
