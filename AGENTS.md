# AGENTS.md — BAIS Pariaman

> Aturan utama untuk AI coding agent di project BAIS Pariaman.
>
> File ini wajib dibaca sebelum membuat, mengubah, menghapus, atau mereview kode.

---

## 1. MANDATORY CONTEXT

**Jangan mengandalkan memory percakapan sebelumnya.**

Setiap sesi AI baru harus membaca file dokumentasi yang relevan dari project.

### Wajib untuk semua task

```text
AGENTS.md
.agents/api.md  # Dokumentasi seluruh API, WAJIB pahami endpoint dan behavior sebelum edit apapun terkait API!
TASK_INSTRUCTION.md
ARCHITECTURE.md
```

### Wajib untuk task fitur / behavior

```text
PRD.md
```

### Wajib untuk task UI / UX

```text
DESIGN.md
```

### Wajib untuk task security / authentication / authorization / API

```text
SECURITY.md
```

### Wajib untuk task testing / Playwright / Jest

```text
TESTING.md
```

### Wajib untuk task deployment / build / release

```text
DEPLOYMENT.md
```

### Aturan

- Baca dokumen sebelum coding.
- Jangan menebak isi dokumen.
- Jangan mengandalkan context dari model sebelumnya.
- Jangan menganggap file dokumentasi sudah dibaca hanya karena file tersedia.
- Periksa source code existing sebelum membuat kode baru.
- Jika dokumentasi dan source code berbeda, jangan otomatis mengubah source. Identifikasi konflik terlebih dahulu.

---

## 2. Project Overview

- **Name:** BAIS Pariaman — Aplikasi Absensi Kegiatan ASN
- **Purpose:** pencatatan kehadiran ASN dan pengelolaan/monitoring oleh Admin.
- **Target Users:** ASN dan Admin.
- **Architecture:** RESTful API Backend + Static PWA Frontend.
- **Status:** Active development.

---

## 3. Tech Stack

```text
Backend:
PHP Native >= 7.2
FastRoute
firebase/php-jwt
PDO
MySQL / MariaDB

Frontend:
HTML
CSS
Native JavaScript
ES6+
PWA

Build:
Node.js >= 22
NPM >= 10
ESBuild
Tailwind CSS tooling
html-minifier-terser

Testing:
Jest
Playwright

Background:
Node.js Worker
```

Jangan menambahkan framework frontend modern seperti React atau Vue tanpa instruksi eksplisit.

Jangan mengganti architecture hanya karena ada teknologi lain yang lebih populer.

---

## 4. Project Structure

```text
bais-pariaman/
    config/              # Konfigurasi sistem
    database/            # Struktur database
    docs/                # Generated build / static frontend
    public_html/         # Web root backend
        api/             # REST API entry point
    src/                 # Source utama
        Controllers/     # Controller PHP
        Helpers/         # Helper
        Views/           # Source HTML/CSS/JavaScript frontend
        routes.php       # FastRoute routes
    worker/              # Node.js worker
    tests/               # Automated tests
    composer.json        # PHP dependencies
    package.json         # Node/NPM dependencies dan build scripts
```

---

## 5. Source vs Generated Files

### Source of truth frontend

```text
src/Views/
```

### Generated frontend

```text
docs/
```

Aturan:

- Edit source frontend di `src/Views/`.
- Jangan edit file generated di `docs/` secara manual.
- Setelah perubahan source yang membutuhkan build, jalankan build bila diperlukan.
- Jangan mengubah generated file untuk menyembunyikan bug source.
- Jika E2E menggunakan `docs/`, `docs/` harus merupakan hasil build aplikasi BAIS sebenarnya.

Build utama:

```bash
npm run build
```

---

## 6. Development Rules

### General

- Periksa implementasi existing sebelum membuat kode.
- Reuse function/component/helper existing bila sesuai.
- Buat perubahan sekecil mungkin.
- Jangan melakukan refactor besar tanpa kebutuhan.
- Jangan menambah dependency tanpa alasan.
- Jangan mengubah behavior existing tanpa alasan jelas.
- Jangan membuat duplicate implementation bila solusi existing masih dapat digunakan.

### Backend

Routing:

```text
src/routes.php
```

Controller:

```text
src/Controllers/
```

Database:

```text
PDO + prepared statements
```

Authentication:

```text
JWT
```

### Frontend

Gunakan:

```text
Native JavaScript
HTML
CSS
```

Fetching API gunakan:

```javascript
fetch()
```

---

## 7. Security Rules

- Jangan bypass authentication.
- Jangan bypass authorization.
- Jangan menonaktifkan validation hanya untuk development/test.
- Jangan mengekspos secret ke frontend.
- Jangan memasukkan credential production ke source code.
- Dilarang menaruh URL asli, domain produksi/staging asli, atau data sensitif asli (seperti NIP/NIK asli) di dalam file `.agents/api.md`. Selalu gunakan contoh URL dummy (misal `https://worker-example.domain.dev` dan `https://api-origin.domain.go.id/api`) serta data dummy.
- Semua query SQL menggunakan prepared statements.
- Security check backend adalah security boundary.
- Jangan mengandalkan validasi frontend sebagai satu-satunya protection.

Untuk detail, baca `SECURITY.md`.

---

## 8. UI / UX Rules

- Mobile-first untuk PWA ASN.
- Pertahankan design existing.
- Jangan redesign besar tanpa kebutuhan.
- Reuse pattern UI existing.
- Hindari dependency berat.
- Pertahankan loading dan interaction yang cepat.
- Jangan mengubah flow user tanpa kebutuhan produk.

Untuk detail, baca `DESIGN.md`.

---

## 9. Testing Rules

Testing memiliki tiga level:

```text
Unit
Integration
E2E
```

### Unit

Gunakan Jest untuk logic kecil dan terisolasi.

### Integration

Gunakan test integration untuk komunikasi antar-komponen.

### E2E

Gunakan Playwright untuk mensimulasikan user melalui browser.

E2E harus menguji aplikasi BAIS sebenarnya.

---

## 10. E2E Environment BAIS

### Wajib

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
app.js / admin.js / frontend BAIS asli
    ↓
Remote Backend BAIS Testing asli
    ↓
Database / Service Testing
```

Frontend boleh disajikan melalui localhost.

Backend untuk E2E **WAJIB remote testing backend yang sebenarnya**.

Jangan menjalankan backend fake/local sebagai pengganti remote backend testing.

### Localhost

Localhost boleh digunakan hanya untuk menyajikan frontend BAIS asli.

Contoh:

```text
http://127.0.0.1:4173
```

Localhost bukan fake application.

### Dilarang

```text
fake frontend
fake HTML
fake backend
fake API
fake server
mock application
production backend untuk E2E testing
```

### API

Jangan mengganti URL API aplikasi menjadi localhost hanya untuk E2E jika aplikasi memang sudah dikonfigurasi memakai remote testing backend.

### Worker

Periksa `WORKER_URL` sebelum menguji flow yang menggunakan Worker.

---

## 11. Playwright User Interaction

E2E harus bertindak seperti user.

Gunakan:

```text
open page
click
fill via keyboard
select
check
upload file
wait
verify UI
```

Jangan mengganti user interaction dengan internal function call.

Jangan memanggil endpoint API secara langsung sebagai pengganti alur UI jika tujuan test adalah E2E.

---

## 12. Input Typing Rules

Untuk semua input text yang mewakili tindakan user:

```text
input
textarea
search box
username
password
kode akses
NIP
nama
jabatan
keterangan
filter pencarian
```

WAJIB gunakan pengetikan per karakter:

```javascript
await page.locator('#input').pressSequentially('contoh text', { delay: 100 });
```

Aturan:

```text
delay = 100ms per character
```

Jangan gunakan:

```javascript
page.fill()
locator.fill()
```

untuk mensimulasikan user mengetik.

Jangan menggunakan:

```javascript
element.value = '...'
```

atau DOM manipulation sebagai pengganti keyboard input.

`setInputFiles()` tetap diperbolehkan untuk test upload file.

---

## 13. Browser Console Error Rules

E2E harus memantau error browser.

Minimal:

```text
console.error
pageerror
uncaught JavaScript exception
unhandled rejection
```

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

Unexpected error harus membuat test FAIL.

Jika UI PASS tetapi browser menghasilkan unexpected JavaScript error:

```text
TEST FAIL
```

Jangan membuat filter umum untuk menyembunyikan error.

Exception hanya boleh dibuat untuk error yang memang diketahui dan memang diharapkan, dengan alasan yang jelas dan filter yang spesifik.

---

## 14. Production Code Protection During Testing

**Jangan mengubah production code hanya agar test PASS.**

Flow yang benar:

```text
Test gagal
↓
Analisis
↓
TEST BUG?
    ↓
    Perbaiki test

APPLICATION BUG?
    ↓
    Perbaiki aplikasi

ENVIRONMENT BUG?
    ↓
    Perbaiki environment / laporkan blocker

REQUIREMENT UNCLEAR?
    ↓
    Laporkan ambiguity
```

Bukan:

```text
Test gagal
↓
Ubah aplikasi
↓
Sembunyikan error
↓
PASS
```

---

## 15. Test Execution Policy

AI coding agent **TIDAK BOLEH menjalankan automated test secara otomatis** setelah membuat atau mengubah test.

Hanya user yang menjalankan test.

AI boleh:

- membuat test
- mengubah test
- menganalisis test
- membaca konfigurasi
- memberikan command

AI tidak boleh otomatis menjalankan:

```bash
npm run test
npm run test:unit
npm run test:e2e
npx jest
npx playwright test
```

Setelah perubahan test, AI harus memberikan command yang bisa dijalankan user.

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

AI tidak boleh menyatakan PASS/FAIL sebelum user menjalankan test dan memberikan hasilnya.

---

## 16. Test Data

Gunakan test data yang memang ditujukan untuk testing.

Contoh:

```text
Dedicated test account
Dedicated test database
Seed
Fixture
Testing API
```

Jangan menggunakan production data secara sembarangan.

Jangan membuat fake data flow yang mengubah behavior aplikasi hanya agar test PASS.

---

## 17. Existing Behavior First

Sebelum membuat test:

1. Baca source terkait.
2. Identifikasi alur sebenarnya.
3. Identifikasi API yang benar-benar dipanggil.
4. Identifikasi authentication.
5. Identifikasi Worker jika ada.
6. Identifikasi UI element.
7. Baru buat test.

Jangan menulis test berdasarkan asumsi.

---

## 18. Commands

Build:

```bash
npm run build
```

PWA:

```bash
npm run build:pwa
```

Admin:

```bash
npm run build:admin
```

Landing:

```bash
npm run build:landing
```

Unit test:

```bash
npm run test:unit
```

E2E:

```bash
npm run test:e2e
```

All tests:

```bash
npm run test
```

PHP dependencies:

```bash
composer install
```

---

## 19. Ambiguity Rule

Jika requirement user ambigu:

```text
STOP
↓
IDENTIFY ambiguity
↓
DO NOT guess critical behavior
```

Namun jangan menanyakan ulang sesuatu yang sudah jelas dari source code, dokumentasi, test existing, atau configuration existing.

---

## 20. Change Discipline

Setiap task harus fokus pada scope yang diminta.

Jangan sekaligus:

```text
fix feature
+
refactor unrelated code
+
redesign UI
+
replace dependency
```

kecuali memang diperlukan oleh task.

---

## 21. GitNexus

Project menggunakan GitNexus untuk code intelligence.

Gunakan GitNexus untuk:

- memahami execution flow
- mencari hubungan symbol
- impact analysis
- debugging
- refactoring

Ikuti instruksi GitNexus yang tersedia di blok GitNexus dalam file ini dan skill yang terkait.

---

## 22. Final Checklist Before Finishing a Task

Pastikan:

```text
[ ] Documentation relevant sudah dibaca
[ ] Source code existing sudah diperiksa
[ ] Scope task tidak melebar
[ ] Production behavior tidak diubah tanpa alasan
[ ] Security tidak dilemahkan
[ ] Generated files tidak diedit manual
[ ] Test relevan sudah dibuat/diperbaiki jika diperlukan
[ ] Test command diberikan kepada user
[ ] AI tidak mengklaim PASS sebelum user menjalankan test
```

---

## 23. Bug Tracking

Jika user melaporkan bug atau mengatakan ada bug:

1. Identifikasi bug dan analisis seperlunya.
2. JANGAN langsung menambahkan bug ke `BUGS.md`.
3. Tanyakan kepada user apakah bug tersebut ingin dicatat di `BUGS.md`.
4. Jika user menjawab YA:
   - cari apakah bug sudah tercatat
   - jika sudah ada, update entry existing
   - jika belum ada, buat entry baru menggunakan template `BUGS.md`
5. Jika user menjawab TIDAK:
   - jangan membuat entry di `BUGS.md`
6. Jika user sebelumnya sudah secara eksplisit meminta bug dicatat:
   - tidak perlu bertanya lagi
7. Jangan mengubah status menjadi `VERIFIED` sebelum user melakukan verifikasi.
8. Jangan mengarang root cause.
9. Simpan evidence asli jika bug dicatat.

`BUGS.md` adalah persistent bug memory, tetapi hanya berisi bug yang disetujui user untuk dicatat.

## 24. Core Rules

```text
READ FIRST.
UNDERSTAND EXISTING CODE.
FOLLOW PROJECT DOCUMENTATION.
READ & UNDERSTAND .agents/api.md BEFORE TOUCHING ANY API ENDPOINT OR BUSINESS LOGIC.
MAKE THE SMALLEST CORRECT CHANGE.
DO NOT GUESS.
DO NOT HIDE BUGS.
DO NOT CHANGE PRODUCTION CODE TO MAKE TESTS PASS.
E2E MUST TEST THE REAL BAIS FRONTEND.
E2E MUST USE THE REAL REMOTE TESTING BACKEND.
E2E MUST SIMULATE REAL USER INTERACTION.
TEXT INPUT MUST USE REAL KEYBOARD TYPING WITH 100MS DELAY PER CHARACTER.
BROWSER CONSOLE ERRORS MUST BE DETECTED.
AI MUST NOT AUTOMATICALLY RUN TESTS.
USER RUNS THE TESTS.
ALWAYS PROVIDE THE EXACT TEST COMMAND.
```

> [!IMPORTANT]
> `.agents/api.md` berisi dokumentasi **SELURUH ENDPOINT API (Worker & Controller)**. Sebelum membuat, mengubah, atau menghapus kode di area API, endpoint, handler, controller, middleware, atau worker: **WAJIB baca, pahami, dan verifikasi rute, behavior, serta kontrak endpoint yang terdokumentasi di `api.md`**. Dilarang mengubah atau meng-override behavior API yang tidak terdokumentasi tanpa konfirmasi product owner.


## Implementation Planning

Sebelum coding untuk task yang mengubah source code:

1. Analisis source code dan dokumentasi relevan.
2. Buat Implementation Plan singkat.
3. Jangan coding.
4. Tampilkan plan di chat.
5. Tunggu user meminta implementasi.
6. Plan harus bisa langsung diberikan ke model AI lain.

### Format Implementation Plan

Maksimal 10 baris.

```text
GOAL:
[tujuan]

FILES:
[file yang perlu diubah]

CHANGES:
[perubahan utama, maksimal 3 poin]

FLOW:
[flow singkat setelah perubahan]

TEST:
[test yang perlu dibuat/dijalankan]

DO NOT CHANGE:
[hal penting yang tidak boleh berubah]