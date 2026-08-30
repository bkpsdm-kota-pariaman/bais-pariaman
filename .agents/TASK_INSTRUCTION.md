# TASK INSTRUCTION — BAIS Pariaman

> Panduan pengembangan spesifik untuk BAIS Pariaman.

---

## 0. Prerequisite Reading

WAJIB baca sebelum menulis atau mengubah kode:

1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `README.md` jika tersedia
4. `PRD.md` jika perubahan menyangkut fitur
5. `DESIGN.md` jika perubahan menyangkut UI/UX
6. `SECURITY.md` jika perubahan menyangkut security
7. `TESTING.md` jika perubahan menyangkut testing
8. `DEPLOYMENT.md` jika perubahan menyangkut deployment

Setelah membaca dokumen, periksa source code existing sebelum membuat kode baru.

---

## 1. General Development Rules

- Pahami implementation existing terlebih dahulu.
- Reuse code existing jika sesuai.
- Jangan membuat duplicate function/component tanpa alasan.
- Jangan melakukan refactor besar jika tidak diminta.
- Jangan mengubah architecture tanpa kebutuhan jelas.
- Jangan mengubah behavior existing hanya agar kode terlihat lebih rapi.

---

## 2. Backend PHP

### Routing

Jika menambah route, daftarkan di:

```text
src/routes.php
```

Routing menggunakan FastRoute.

### Controller

Controller berada di:

```text
src/Controllers/
```

Controller bertugas:

- menerima input
- melakukan validasi
- memanggil logic/database layer sesuai architecture
- mengembalikan response JSON

### Validation

Semua input dari client harus divalidasi di server.

### Authentication

Route yang membutuhkan authentication harus melakukan pengecekan JWT.

Route admin harus melakukan pengecekan role.

---

## 3. Frontend

Source frontend berada di:

```text
src/Views/
```

Jangan edit file generated secara manual di:

```text
docs/
```

Jika frontend berubah:

```text
Edit src/Views/
        ↓
Build
        ↓
docs/
```

Build utama:

```bash
npm run build
```

AI boleh menjalankan build jika diperlukan untuk verifikasi atau testing.

Generated `docs/` tidak boleh diedit manual untuk memperbaiki behavior.

---

## 4. Worker

Worker berada di:

```text
worker/
```

Worker berbasis Node.js.

Fungsi worker mencakup proses background seperti:

- cache
- queue
- input data ke server utama secara antrian

Jangan mengubah behavior worker tanpa memahami dependency dan queue flow existing.

---

## 5. Testing

Testing mengikuti `TESTING.md`.

Untuk E2E:

- gunakan Playwright
- gunakan browser
- gunakan aplikasi BAIS sebenarnya
- lakukan user-like interaction
- verifikasi hasil melalui UI

Jangan membuat fake application/server hanya untuk membuat test PASS.

---

## 6. Build dan Dependency

Requirement Node.js:

```text
Node >= 22
```

Requirement npm:

```text
npm >= 10
```

Sebelum menambah dependency:

1. periksa apakah dependency existing sudah dapat digunakan
2. pertimbangkan ukuran bundle
3. pertimbangkan compatibility
4. tambahkan hanya jika memang diperlukan

---

## 7. Change Discipline

Setiap perubahan harus seminimal mungkin tetapi lengkap.

Urutan:

```text
Understand
↓
Plan
↓
Change
↓
Test
↓
Verify
```

Jangan melakukan perubahan tidak terkait task.

---

## 8. Jika Menemukan Bug

Bedakan:

```text
APPLICATION BUG
TEST BUG
ENVIRONMENT BUG
DOCUMENTATION BUG
REQUIREMENT UNCLEAR
```

Jangan memperbaiki kategori lain secara diam-diam.

Jika dokumentasi tidak cocok dengan implementation, jangan otomatis mengubah application code.

---

## 9. Output Setelah Task

Setelah perubahan:

1. Jelaskan file yang berubah.
2. Jelaskan perubahan utama.
3. Jalankan test yang relevan.
4. Laporkan hasil test.
5. Jika test tidak dapat dijalankan, jelaskan blocker.
6. Jangan menyatakan PASS jika test sebenarnya belum dijalankan.
