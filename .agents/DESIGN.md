# DESIGN — BAIS Pariaman

> Panduan UI/UX dan Design System BAIS Pariaman.

> **Version:** v2.0.0

---

## 1. Design Philosophy

### Mobile-first

Pengguna utama PWA adalah ASN yang menggunakan smartphone.

UI harus nyaman digunakan pada layar smartphone.

### Minimalist & Fast

Desain harus mendukung proses absensi yang cepat.

Hindari:

- animasi berlebihan
- elemen dekoratif yang tidak membantu
- payload frontend yang tidak perlu
- interaksi yang memperpanjang proses absensi

### Formal

BAIS digunakan dalam lingkungan instansi pemerintah.

UI harus terlihat:

- profesional
- jelas
- konsisten
- mudah dipahami

---

## 2. Existing Design First

Saat mengubah UI:

1. Periksa UI existing.
2. Pertahankan pola yang sudah digunakan.
3. Reuse component/class/pattern existing.
4. Jangan melakukan redesign besar hanya berdasarkan preferensi AI.
5. Jangan mengubah flow user tanpa kebutuhan produk.

Jika requirement hanya meminta perubahan kecil, lakukan perubahan sekecil mungkin.

---

## 3. Color System

Gunakan skema warna formal dan konsisten.

Warna utama ditetapkan melalui CSS sesuai implementasi existing.

Jika sudah tersedia CSS variable seperti:

```css
--primary-color
```

gunakan variable tersebut.

Jangan membuat skema warna baru tanpa kebutuhan.

---

## 4. Typography

Gunakan font sistem native jika sesuai:

```text
Segoe UI
Roboto
Helvetica Neue
system-ui
```

Tujuan:

- mengurangi dependency font eksternal
- mempercepat loading
- menjaga tampilan tetap ringan

---

## 5. Component Standards

Frontend menggunakan Native JS/HTML/CSS.

Gunakan:

- struktur HTML semantik
- class yang jelas
- pola component existing
- CSS yang dapat digunakan ulang

Hindari:

- inline style secara masif
- duplicate CSS
- duplicate JavaScript logic
- component baru jika component existing masih sesuai

---

## 6. UX Rules

Untuk flow absensi:

- status harus jelas
- tombol utama mudah ditemukan
- error harus mudah dipahami
- loading state harus terlihat
- success state harus terlihat
- user tidak boleh dipaksa memahami detail teknis aplikasi

Jika kamera, lokasi, network, atau permission gagal, UI harus memberikan instruksi yang sesuai behavior aplikasi.

---

## 7. Responsive Design

Prioritas:

```text
Smartphone
↓
Tablet
↓
Desktop
```

Admin Dashboard harus tetap nyaman digunakan pada desktop.

PWA ASN harus memprioritaskan smartphone.

---

## 8. Performance

Hindari perubahan UI yang menambah:

- dependency berat
- asset besar
- request tidak perlu
- animasi berat
- script tidak perlu

Pertahankan prinsip PWA ringan dan cepat.
