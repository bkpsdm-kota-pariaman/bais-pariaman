# DEPLOYMENT — BAIS Pariaman

> Panduan infrastruktur dan rilis aplikasi ke Production.

> **Version:** v2.0.0

---

## 1. Deployment Architecture

### Frontend / Web PWA

Hosting statis menggunakan Nginx/Apache.

Web root:

```text
docs/
```

### Backend / API

PHP Server menggunakan Apache/Nginx + PHP-FPM.

Web root:

```text
public_html/api/
```

### Database

```text
MySQL / MariaDB
```

Database dapat berada pada server terpisah atau server yang sama sesuai deployment.

### Worker

Node.js worker dijalankan sebagai daemon menggunakan:

```text
PM2
Systemd
```

Entry point mengikuti implementation existing, misalnya:

```text
worker/index.js
```

---

## 2. Environment

Backend configuration berada pada:

```text
config/config.php
```

Contoh konfigurasi:

```text
DB User
DB Password
JWT Secret
```

Credential production tidak boleh diekspos melalui web root atau frontend.

Frontend configuration yang memang diperlukan dapat diproses melalui build Node.js.

Jangan memasukkan secret backend ke frontend.

---

## 3. Requirements

Production/deployment membutuhkan:

```text
PHP >= 7.2
Composer
Node.js >= 22
NPM >= 10
MySQL / MariaDB
```

---

## 4. Frontend Deployment

Install dependency:

```bash
npm install
```

Build:

```bash
npm run build
```

Hasil build berada pada:

```text
docs/
```

Arahkan VirtualHost/Server Block ke:

```text
docs/
```

---

## 5. Backend Deployment

Install production dependency:

```bash
composer install --no-dev --optimize-autoloader
```

Arahkan VirtualHost/Server Block API ke:

```text
public_html/api/
```

---

## 6. Worker Deployment

Worker berada pada:

```text
worker/
```

Gunakan process manager seperti:

```text
PM2
Systemd
```

Pastikan worker berjalan sesuai konfigurasi production.

---

## 7. Database

Project tidak menggunakan migration framework otomatis.

Schema utama berada pada:

```text
database/structure.sql
```

Perubahan database production dilakukan secara terkontrol melalui:

```text
SQL
phpMyAdmin
script khusus
```

Jangan menjalankan perubahan database production tanpa memastikan impact.

---

## 8. Release Rules

Sebelum release:

1. Pastikan source code benar.
2. Jalankan test relevan.
3. Jalankan build frontend.
4. Pastikan `docs/` sesuai hasil build.
5. Pastikan konfigurasi production benar.
6. Pastikan database schema sesuai.
7. Pastikan worker berjalan jika diperlukan.

Jangan mengubah production code hanya untuk membuat test PASS.

---

## 9. Generated Files

`docs/` adalah hasil build frontend.

Jangan melakukan perubahan manual pada generated files untuk memperbaiki behavior.

Jika terdapat masalah:

```text
Perbaiki source
↓
Build ulang
↓
Deploy hasil build
```
