# SECURITY — BAIS Pariaman

> Protokol dan standar keamanan aplikasi.

> **Version:** v2.0.0

---

## 1. Security Architecture

BAIS Pariaman memisahkan:

```text
Frontend statis
        ↓
Backend API
```

Frontend tidak menyimpan rahasia server.

Backend API dilindungi menggunakan JWT.

---

## 2. Authentication

Authentication menggunakan:

```text
firebase/php-jwt
```

Strategi session:

```text
Stateless JWT
```

Token dikirim menggunakan:

```http
Authorization: Bearer <token>
```

Login ASN:

```http
POST /login-asn
```

Login Admin:

```http
POST /admin/login
```

### Token Storage

Gunakan mekanisme token storage yang sudah digunakan aplikasi.

Dokumentasi existing menyebut kemungkinan:

```text
localStorage
sessionStorage
HttpOnly cookies
```

Jangan mengganti mekanisme token storage hanya berdasarkan preferensi AI.

Jika ingin mengubah mekanisme, evaluasi security impact dan requirement terlebih dahulu.

---

## 3. Authorization / RBAC

Role utama:

```text
Admin
ASN
```

Authorization harus ditegakkan di backend.

Payload JWT menyimpan tipe user.

Rute khusus admin harus memvalidasi role sebelum memberikan response.

Jangan mengandalkan pengecekan role frontend sebagai security boundary.

---

## 4. Input Validation

### Client-side

Frontend melakukan validasi awal menggunakan Native JavaScript, misalnya:

```text
required
regex/pattern
```

### Server-side

Backend wajib melakukan validasi input.

Validasi server tidak boleh bergantung pada validasi frontend.

---

## 5. SQL Security

Semua query database wajib menggunakan prepared statements PDO.

Jangan membuat query SQL dengan concatenation input user secara langsung.

Contoh prinsip:

```php
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
```

---

## 6. Password

Password harus disimpan menggunakan hashing standar PHP, misalnya:

```php
password_hash()
```

Password tidak boleh disimpan sebagai plaintext.

### NIK

Dokumentasi existing menyebut NIK pada `data_pegawai` digunakan sebagai password.

Detail implementasi harus mengikuti source code dan database existing.

Jika NIK digunakan sebagai password awal:

- jangan menyimpan password plaintext jika password memang disimpan pada database
- gunakan hashing
- jangan menampilkan password kepada user
- jangan mencatat password pada log

---

## 7. Secrets

Credential database dan JWT secret harus berada di konfigurasi server yang tidak diekspos melalui web root.

Contoh:

```text
DB User
DB Password
JWT Secret
```

Jangan commit secret production ke repository.

---

## 8. API Security

Untuk endpoint yang membutuhkan authentication:

```text
Authorization: Bearer <token>
```

Validasi:

1. token tersedia
2. token valid
3. token belum expired jika expiration digunakan
4. role sesuai kebutuhan endpoint

---

## 9. Security Rules for AI Agent

AI coding agent dilarang:

- menghapus authentication untuk mempermudah development
- menghapus authorization untuk membuat test PASS
- menonaktifkan input validation
- mengganti prepared statements dengan query concatenation
- menaruh secret di frontend
- menaruh credential production dalam source code
- mengekspos JWT secret
- menonaktifkan security check hanya untuk E2E test

Jika testing membutuhkan credential atau test account, gunakan dedicated test data.
