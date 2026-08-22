# AGENTS.md — BAIS Pariaman

> Catatan penting: File ini merupakan panduan utama agen AI dalam pengembangan aplikasi BAIS Pariaman.

---

## 1. Project Overview

- **Name** : BAIS Pariaman - Aplikasi Absensi Kegiatan ASN
- **Description** : Aplikasi absensi modern yang dikembangkan untuk memfasilitasi pencatatan kehadiran Aparatur Sipil Negara (ASN) di lingkungan Pemerintah Kota Pariaman.
- **Goal** : Menyediakan pencatatan kehadiran ASN berbasis PWA yang cepat dan pemantauan realtime oleh Admin.
- **Target Users**: ASN (Aparatur Sipil Negara) Kota Pariaman dan Admin.
- **Version** : v1.0.0
- **Status** : Active development

---

## 2. Tech Stack

- **Backend Language** : PHP (>= 7.2)
- **Frontend Language** : HTML, CSS, JavaScript (Native ES6+)
- **Backend Routing** : FastRoute
- **Authentication** : Firebase PHP-JWT
- **Database** : MySQL / MariaDB
- **Build System / Bundler** : Node.js, NPM, ESBuild, HTML Minifier Terser
- **Architecture** : RESTful API Backend + PWA Frontend
- **Background Worker** : Node.js

---

## 3. Commands

```bash
# Development Frontend
npm run build        # Build frontend ke folder docs/
npm run build:pwa    # Build spesifik PWA
npm run build:admin  # Build spesifik Admin
npm run build:landing# Build spesifik Landing Page

# Backend Setup
composer install     # Install dependencies PHP
```

> Jangan gunakan framework frontend modern seperti React/Next.js/Tailwind. Gunakan native web technologies sesuai struktur saat ini.

---

## 4. Project Structure

Architecture: REST API + Static PWA

```
bais-balad/
    config/              # Konfigurasi utama sistem dan database
    database/            # File struktur database (structure.sql)
    docs/                # Hasil build / output statis untuk Frontend (Siap deploy)
    public_html/         # Entry point (index.php) untuk REST API backend
        api/             # Folder web root
    src/                 # Source code utama (Backend & Frontend)
        Controllers/     # Logic API & Controller PHP
        Helpers/         # Fungsi-fungsi bantuan (Helper)
        Views/           # Source code mentah Frontend (Admin, PWA, Landing Page)
        routes.php       # Definisi rute/endpoint API
    worker/              # Script background worker/sinkronisasi
    composer.json        # Dependensi library PHP backend
    package.json         # Konfigurasi build script frontend dan dependensi NPM
```

Aturan penempatan file:
- File PHP routing dan controller harus berada di `src/Controllers` atau root `src/`.
- File Javascript/HTML mentah sebelum di build harus diletakkan di `src/Views/`.
- File worker diletakkan di folder `worker/`.

---

## 5. Naming Conventions

```
# File & Folder
- File PHP Kelas  : PascalCase (contoh: AuthController.php)
- File Helper     : camelCase atau snake_case
- File Frontend   : kebab-case atau camelCase (contoh: app.js, style.css)

# Di Dalam Kode
- Variabel PHP  : $camelCase
- Fungsi PHP    : camelCase()
- Kelas PHP     : PascalCase
- Variabel JS   : camelCase
```

---

## 6. Code Conventions

```
# Pendekatan Umum
- Terapkan prinsip Clean Code.
- Pastikan kode Javascript native kompatibel dengan bundler ESBuild.
- Pastikan endpoint PHP membalas dengan JSON yang terstruktur.

# Urutan Import PHP
- Gunakan `use` statement di bagian atas file setelah namespace.
- Pastikan composer autoload dijalankan di entry point.

# Error Handling
- PHP: Tangkap error menggunakan try-catch, return JSON HTTP error (misal 400, 500).
- JS: Gunakan try-catch untuk fetch requests, tampilkan pesan error yang jelas di UI.
```

---

## 7. API & Data Fetching Rules

```
# Pendekatan Fetching
- Gunakan native `fetch` API di sisi Frontend.

# Format Response API
- Semua endpoint backend sebaiknya mengembalikan format JSON yang konsisten, contoh:
  `{ "status": "success", "data": {...}, "message": "Berhasil" }`
  atau
  `{ "status": "error", "message": "Deskripsi error" }`
```

---

## 8. Styling Rules

```
# Aturan Styling
- Gunakan Vanilla CSS / Native CSS.
- Organisasikan CSS per komponen atau modul dalam `src/Views/`.
- Pastikan responsivitas (Mobile-first).
```

---

## 9. Git Rules

```
# Format Pesan Commit
feat     : [deskripsi fitur baru]
fix      : [deskripsi perbaikan bug]
refactor : [deskripsi perombakan kode]
style    : [perubahan tampilan/format]
docs     : [update dokumentasi]
```

---

## 10. Do Not

> JIKA INSTRUKSI USER AMBIGU, BERHENTI DAN TANYAKAN DULU. JANGAN BERASUMSI.

```
# Struktur File
- DILARANG menambahkan framework Javascript modern (React, Vue, dll).
- DILARANG menghapus proses build ESBuild.

# Kode
- DILARANG mengekspos API Secret Key ke frontend.
- DILARANG melakukan *bypass* autentikasi JWT di API.
```

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **bais-pariaman** (2880 symbols, 8508 relationships, 219 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/bais-pariaman/context` | Codebase overview, check index freshness |
| `gitnexus://repo/bais-pariaman/clusters` | All functional areas |
| `gitnexus://repo/bais-pariaman/processes` | All execution flows |
| `gitnexus://repo/bais-pariaman/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
