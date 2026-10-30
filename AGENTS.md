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
PHP Native >= 8.2
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

### Git Workflow — Branch, Pull Request, dan Merge

Setiap perubahan kode wajib mengikuti alur berikut:

1. **Cabang wajib dari `main`**: buat branch baru dari `main` sebelum menyentuh kode. Dilarang bekerja langsung di `main`.
   ```bash
   git checkout -b issue-<nomor>-<deskripsi-singkat> origin/main
   ```
2. **Nama branch wajib memuat nomor issue**: `issue-<nomor>-<deskripsi-singkat>`.
3. **Pekerjaan dilakukan di branch tersebut**, bukan di `main`.
4. **Push branch ke `origin`** setelah pekerjaan selesai dan verifikasi lolos:
   ```bash
   git push -u origin issue-<nomor>-<deskripsi-singkat>
   ```
5. **Pull Request wajib dibuat di GitHub** ke `main`, body memuat `Closes #<nomor>`:
   ```bash
   gh pr create --base main --head issue-<nomor>-<deskripsi-singkat> \
     --title "<judul ringkas>" --body "Closes #<nomor>"
   ```
6. **Merge dilakukan di GitHub** (web UI atau `gh pr merge`), bukan di mesin lokal.
7. **Setelah merge, sinkronkan `main` dari GitHub**:
   ```bash
   git checkout main
   git pull --ff-only origin main
   ```
8. **DILARANG KERAS merge di lokal**: `git merge` maupun `git rebase` ke `main` yang lalu di-push dari mesin lokal tidak diizinkan dalam kondisi apa pun. Satu-satunya jalur masuk ke `main` adalah Pull Request yang di-merge di GitHub.

### Rangkaian Otomatis & Hapus Branch Setelah Merge (MANDATORY)

Perintah atau permintaan user untuk mengubah kode/berkas sudah menjadi izin menjalankan seluruh langkah 1–11 sekaligus. Agen DILARANG menunggu perintah terpisah untuk tiap langkah ("perlu dibuatkan branch?", "lanjut merge?", "hapus branch-nya?") — pertanyaan seperti itu adalah pelanggaran, bukan kehati-hatian.

9. **Hapus branch lokal setelah merge** — wajib, bukan opsional:
   ```bash
   git branch -D issue-<nomor>-<deskripsi-singkat>   # -D, bukan -d: squash memutus garis keturunan
   ```
10. **Hapus branch remote setelah merge**:
    ```bash
    git push origin --delete issue-<nomor>-<deskripsi-singkat>
    git fetch --prune
    ```
    Bila `gh pr merge --delete-branch` gagal karena working tree kotor: merge dulu tanpa flag itu, lalu `git checkout main`, `git pull --ff-only origin main`, baru hapus branch lokal kemudian remote.
11. **Pengecualian tunggal**: user menyatakan secara eksplisit bahwa branch tidak perlu dibuat (mis. "langsung di `main` saja", "tidak perlu branch"). Tanpa pernyataan eksplisit itu, seluruh langkah 1–10 WAJIB dijalankan — termasuk tanpa diminta.

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

AI coding agent **boleh menjalankan automated test secara langsung**, atas izin user.

Alur:

```text
AI menulis/mengubah test
↓
AI menjalankan test
↓
AI melaporkan hasil sebenarnya (PASS/FAIL + output)
```

AI boleh:

- membuat test
- mengubah test
- menganalisis test
- membaca konfigurasi
- **menjalankan test langsung**
- melaporkan hasil test apa adanya

Command yang boleh dijalankan AI:

```bash
npm run test
npm run test:unit
npm run test:e2e
npx jest
npx playwright test
```

Aturan:

- Jalankan test pada environment testing, bukan production.
- Jangan mengubah production code, melemahkan assertion, atau menyembunyikan error hanya agar test PASS.
- Jika test tidak bisa dijalankan (environment/credential/network blocker), laporkan blocker-nya.
- Jangan mengarang hasil test. Laporkan output sebenarnya.
- Tetap sediakan command yang dapat dijalankan user sendiri bila diminta.

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
[ ] Test sudah dijalankan (oleh AI bila diizinkan) dan hasilnya dilaporkan
[ ] Test command diberikan kepada user
[ ] AI tidak mengklaim PASS tanpa benar-benar menjalankan test
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
AI MAY RUN TESTS DIRECTLY WHEN THE USER ALLOWS IT.
AI MUST REPORT THE REAL TEST OUTPUT.
AI MUST NEVER FABRICATE TEST RESULTS.
ALWAYS PROVIDE THE EXACT TEST COMMAND.
```

> [!IMPORTANT]
> `.agents/api.md` berisi dokumentasi **SELURUH ENDPOINT API (Worker & Controller)**. Sebelum membuat, mengubah, atau menghapus kode di area API, endpoint, handler, controller, middleware, atau worker: **WAJIB baca, pahami, dan verifikasi rute, behavior, serta kontrak endpoint yang terdokumentasi di `api.md`**. Dilarang mengubah atau meng-override behavior API yang tidak terdokumentasi tanpa konfirmasi product owner.


## Implementation Planning

Sebelum coding untuk task yang mengubah source code:

1. Analisis source code dan dokumentasi relevan.
2. Buat penjelasan ringkas mengenai perubahan yang akan dilakukan.
3. Buat Implementation Plan. Ringkas untuk perubahan kecil, boleh melebihi 30 baris jika perubahan memang kompleks.
4. **Dilarang keras langsung membuat atau mengedit kode sebelum user secara eksplisit meminta/menyetujui.**
5. Tampilkan penjelasan dan plan di chat, lalu minta persetujuan user.
6. Tunggu user menyetujui atau memerintahkan implementasi.
7. Plan harus bisa langsung diberikan ke model AI lain.
8. **Wajib menunggu ACC — berlaku juga untuk subagent.** Agen, termasuk subagent yang dipanggil lewat `delegate_task`, DILARANG mengerjakan apa pun sebelum user memberi ACC/persetujuan eksplisit. Yang dilarang sebelum ACC: mengedit/membuat/menghapus berkas, menjalankan perintah pengubah keadaan (migration, build, deploy, hapus berkas), membuat issue/branch/commit/push, dan menugaskan subagent untuk hal yang mengubah apa pun.
9. **Subagent mewarisi larangan ini.** Brief `delegate_task` wajib memuat larangan tersebut, larangan commit/push, larangan keluar dari lingkup, dan daftar berkas kotor lama yang tidak boleh disentuh. Laporan subagent adalah klaim, bukan bukti — sesi utama yang memverifikasi setelah ACC. **Subagent dilarang menerima atau memberi ACC.**
10. **Yang wajib dilakukan sebelum ACC**: sajikan rencana ringkas (berkas yang akan disentuh + alasan + kriteria selesai), lalu berhenti dan tunggu. Audit, review, analisa, pencarian bug, dan permintaan "buat rencana" BUKAN izin mengerjakan.
11. **ACC hanya sah dari user**, lewat kalimat tegas ("kerjakan", "eksekusi sekarang", "setuju, lanjut").

### Format Implementation Plan

Tidak ada batas 30 baris. Panjang plan mengikuti kompleksitas task: tetap singkat untuk perubahan kecil, tulis lebih detail bila perubahan menyentuh banyak file, flow, atau kontrak API.

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

<!-- gortex:communities:start -->
## Community Skills

| Area | Description | Explore |
|------|-------------|---------|
| Playwright Report | 438 symbols | `analyze(operation:"communities", id:"community-10")` |
| Admin Js 2 Dirs | 171 symbols | `analyze(operation:"communities", id:"community-15")` |
| Js 6 Dirs | 92 symbols | `analyze(operation:"communities", id:"community-19")` |
| Js 8 Dirs | 88 symbols | `analyze(operation:"communities", id:"community-25")` |
| Helpers 1 Dirs Json | 79 symbols | `analyze(operation:"communities", id:"community-11")` |
| 4 Dirs | 76 symbols | `analyze(operation:"communities", id:"community-17")` |
| Helpers 1 Dirs Assertcondition | 24 symbols | `analyze(operation:"communities", id:"community-24")` |
| Js 2 Dirs | 18 symbols | `analyze(operation:"communities", id:"community-22")` |
| Database App Absensi Data Absensi | 17 symbols | `analyze(operation:"communities", id:"community-0")` |
| E2e 4 Dirs | 16 symbols | `analyze(operation:"communities", id:"community-18")` |
| Js 1 Dirs | 15 symbols | `analyze(operation:"communities", id:"community-23")` |
| Admin Js | 12 symbols | `analyze(operation:"communities", id:"community-16")` |
| Database App Absensi Log Absensi | 12 symbols | `analyze(operation:"communities", id:"community-6")` |
| Database App Absensi Data Pegawai | 12 symbols | `analyze(operation:"communities", id:"community-2")` |
| Js 3 Dirs | 9 symbols | `analyze(operation:"communities", id:"community-21")` |
| Absensi Cadangan Callgasapi | 8 symbols | `analyze(operation:"communities", id:"community-8")` |
| Views Absensi Cadangan Showloading | 7 symbols | `analyze(operation:"communities", id:"community-13")` |
| Database App Absensi Pengaturan Aplikasi | 5 symbols | `analyze(operation:"communities", id:"community-7")` |
| Database App Absensi Data Admin | 3 symbols | `analyze(operation:"communities", id:"community-1")` |
| Database App Absensi Kegiatan Target Opd | 3 symbols | `analyze(operation:"communities", id:"community-4")` |

<!-- gortex:communities:end -->
