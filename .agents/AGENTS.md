# AGENTS — BAIS Pariaman

## 1. Aturan Utama

Dokumen ini adalah aturan operasional untuk AI coding agent yang mengembangkan BAIS Pariaman.

Sebelum menulis atau mengubah kode:

1. Baca `AGENTS.md`.
2. Baca `TASK_INSTRUCTION.md`.
3. Baca `ARCHITECTURE.md`.
4. Baca `PRD.md` jika perubahan menyangkut fitur atau behavior.
5. Baca `DESIGN.md` jika perubahan menyangkut UI/UX.
6. Baca `SECURITY.md` jika perubahan menyangkut authentication, authorization, input, data, token, atau API.
7. Baca `TESTING.md` jika perubahan menyangkut testing.
8. Baca `DEPLOYMENT.md` jika perubahan menyangkut build, release, hosting, atau deployment.
9. Periksa source code existing sebelum membuat kode baru.

## 2. Source of Truth

Gunakan aturan berikut:

- Source code existing adalah sumber utama untuk mengetahui behavior yang sudah berjalan.
- `PRD.md` menjelaskan kebutuhan produk.
- `ARCHITECTURE.md` menjelaskan struktur dan arsitektur.
- `DESIGN.md` menjelaskan UI/UX.
- `SECURITY.md` menjelaskan aturan keamanan.
- `TESTING.md` menjelaskan aturan testing.
- `DEPLOYMENT.md` menjelaskan deployment.
- `TASK_INSTRUCTION.md` menjelaskan aturan implementasi.

Jika dokumen dan source code berbeda:

1. Jangan otomatis mengubah source code.
2. Identifikasi konflik.
3. Tentukan apakah perubahan memang diminta.
4. Jika belum jelas, jangan menebak behavior penting.

## 3. Prinsip Modifikasi

- Periksa implementasi existing sebelum membuat kode baru.
- Reuse function, component, helper, dan pola existing jika sesuai.
- Jangan melakukan refactor besar tanpa kebutuhan.
- Jangan mengubah behavior existing tanpa alasan yang jelas.
- Jangan menambah dependency tanpa alasan.
- Jangan mengganti library atau arsitektur tanpa instruksi.
- Jangan membuat solusi sementara yang menyimpang dari architecture.

## 4. Source dan Generated Output

Source frontend berada di:

```text
src/Views/
```

Generated frontend berada di:

```text
docs/
```

Aturan:

- Edit source di `src/Views/`.
- Jangan edit file generated di `docs/` secara manual.
- Jika hasil build diperlukan untuk verifikasi atau E2E, AI boleh menjalankan build.
- Jangan mengubah generated output untuk menyembunyikan bug source.

## 5. Testing

E2E harus menguji aplikasi BAIS sebenarnya melalui browser.

Dilarang:

- membuat fake application
- membuat fake HTML
- membuat fake server hanya untuk E2E
- mengganti aplikasi dengan mock
- memanggil internal function sebagai pengganti user interaction
- mengubah production code hanya agar test PASS
- melemahkan assertion hanya agar test PASS

Jika test gagal, tentukan apakah penyebabnya:

```text
TEST BUG
APPLICATION BUG
ENVIRONMENT BUG
REQUIREMENT UNCLEAR
```

## 6. Production Safety

Sebelum mengubah behavior production:

- pahami impact
- periksa dependency
- periksa API contract
- periksa authentication/authorization jika relevan
- jalankan test relevan

Jangan menghapus validasi, security check, atau error handling hanya untuk membuat alur lebih mudah.

## 7. Prinsip Coding Agent

```text
READ FIRST.
UNDERSTAND EXISTING CODE.
MAKE SMALLEST CORRECT CHANGE.
TEST.
CHECK RESULT.
DO NOT HIDE BUGS.
```
