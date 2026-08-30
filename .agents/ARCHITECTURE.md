# ARCHITECTURE — BAIS Pariaman

> Dokumen arsitektur dan topologi sistem BAIS Pariaman.

> **Version:** v2.0.0

---

## 1. System Overview

BAIS Pariaman menggunakan arsitektur Client-Server:

```text
Frontend Static PWA
        ↓
RESTful API
        ↓
MySQL / MariaDB
```

Komponen background menggunakan Node.js worker untuk proses asinkron.

Backend menggunakan PHP native tanpa heavy framework, dengan FastRoute sebagai routing.

Frontend menggunakan Native JS/HTML/CSS dan dibuild menjadi aset statis.

---

## 2. Architecture Layers

### Presentation Layer

Frontend PWA berbasis:

```text
Native JavaScript
HTML
CSS
```

Build menggunakan tooling Node.js seperti:

```text
ESBuild
Tailwind CSS
html-minifier-terser
```

### Application Layer

Backend menggunakan:

```text
PHP Native
FastRoute
firebase/php-jwt
```

Backend menyediakan RESTful API.

### Background Layer

Node.js worker berada di:

```text
worker/
```

Worker menangani proses background, cache, dan queue sesuai implementasi aplikasi.

### Data Access Layer

Backend menggunakan:

```text
PDO
MySQL / MariaDB
```

---

## 3. Directory Structure

```text
bais-pariaman/
  config/              # Konfigurasi sistem
  database/            # Struktur SQL
  docs/                # Generated static assets / Web Root Frontend
  public_html/api/     # Web Root Backend API
  src/                 # Source code utama
    Controllers/       # PHP Controllers
    Helpers/           # PHP utility classes/functions
    Views/             # Native JS, CSS, HTML sumber PWA/Admin
    routes.php         # FastRoute definitions
  worker/              # Node.js worker
```

---

## 4. Source vs Generated Files

Source frontend:

```text
src/Views/
```

Generated frontend:

```text
docs/
```

`src/Views/` adalah source of truth untuk frontend.

Jangan melakukan edit manual pada file generated di `docs/`.

Build digunakan untuk menghasilkan output terbaru.

---

## 5. Database

Database menggunakan:

```text
MySQL / MariaDB
```

Struktur tabel tersedia pada:

```text
database/structure.sql
```

Tabel utama mengatur data seperti:

```text
ASN
Jadwal
Absensi
Admin
```

Detail mengikuti schema actual pada database dan source code.

---

## 6. API Design

Method yang digunakan:

```text
GET
POST
PUT
DELETE
```

Authentication menggunakan JWT:

```text
Authorization: Bearer <token>
```

Format request/response utama:

```text
JSON
```

---

## 7. Key Design Decisions

### PHP Native + FastRoute

Digunakan untuk kebutuhan backend ringan dan penggunaan resource minimal.

### Native JS + Build Tools

Digunakan untuk menghasilkan PWA ringan tanpa framework frontend besar.

### Static Frontend

Frontend hasil build disajikan sebagai aset statis.

### Node.js Worker

Worker digunakan untuk proses background seperti cache dan queue sesuai implementasi aplikasi.

---

## 8. Architecture Rules

- Jangan mengganti arsitektur tanpa kebutuhan jelas.
- Jangan memperkenalkan framework besar hanya untuk fitur kecil.
- Jangan memindahkan source frontend ke `docs/`.
- Jangan menganggap `docs/` sebagai source code utama.
- Periksa implementasi existing sebelum menambah komponen baru.
