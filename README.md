# BAIS Pariaman (Aplikasi Absensi Kegiatan ASN)

**BAIS Pariaman** adalah aplikasi berbasis web (PWA) yang dirancang untuk mempermudah pencatatan kehadiran ASN (Aparatur Sipil Negara) pada berbagai kegiatan kedinasan, apel, upacara, rapat, maupun acara resmi di lingkungan Pemerintah Kota Pariaman secara cepat, tertib, dan akurat.

---

## 🌟 Apa Itu BAIS Pariaman?

Aplikasi ini menggantikan absensi manual berbasis kertas menjadi sistem digital terpadu. ASN cukup membuka aplikasi melalui browser HP atau komputer untuk melakukan absensi dengan verifikasi lokasi (GPS) dan swafoto/foto kegiatan. Data kehadiran langsung tersimpan secara *real-time* dan dapat dipantau langsung oleh Admin atau pimpinan.

---

## ✨ Fitur-Fitur Utama

1. **Absensi Mandiri Praktis (ASN)**
   - Masukkan Kode Akses Kegiatan.
   - Deteksi lokasi otomatis (memastikan kehadiran di lokasi kegiatan).
   - Ambil foto bukti kehadiran langsung dari kamera HP.

2. **Absensi Scan QR Code**
   - Panitia acara dapat menampilkan QR Code di layar proyektor atau papan pengumuman.
   - Pegawai cukup memindai (scan) QR Code untuk langsung tercatat hadir.

3. **Absensi Cadangan / Darurat**
   - Halaman khusus untuk keadaan darurat atau saat koneksi/perangkat pegawai mengalami kendala teknis di lapangan.

4. **Panel Admin & Rekapitulasi Lengkap**
   - Pembuatan jadwal dan pengelolaan kode akses kegiatan.
   - Rekap kehadiran per kegiatan maupun rekap menyeluruh (berdasarkan tanggal, OPD, status kehadiran).
   - Fitur pencarian cepat berdasarkan NIP, Nama, maupun Jabatan.
   - Aksi massal (verifikasi banyak data atau hapus data sekaligus).
   - Cetak laporan dan ekspor rekap ke format Excel / PDF.

5. **Pengelolaan Bukti Dukung Digital**
   - Unggah surat tugas, nota dinas, dokumentasi acara, hingga scan daftar hadir manual.

---

## 📱 Panduan Penggunaan Singkat

### Untuk ASN / Pegawai:
1. Buka tautan aplikasi BAIS di browser HP (contoh Chrome atau Safari) dan klik **BUKA APLIKASI**.
2. Di halaman utama (setelah login), tekan tombol **AMBIL ABSENSI KEGIATAN**.
3. Pilih metode absensi (**Input Kode Akses** atau **Scan QR Code**).
4. Izinkan akses lokasi dan kamera saat diminta browser.
5. Pada form konfirmasi, pilih status kehadiran (**✅ Hadir** atau **❌ Tidak Hadir (Dinas Luar, Kegiatan lain dengan SPT, Cuti atau alasan lainnya)**).
6. Ambil foto langsung melalui kamera dan klik untuk mengirim absensi.

### Untuk Admin / Panitia Kegiatan:
1. Masuk ke halaman **Admin** dengan akun resmi.
2. Buka menu **Data** -> **Kegiatan** lalu tekan tombol **Buat Jadwal Baru**. Tentukan tanggal, lokasi, radius, dan kode akses.
3. Bagikan kode akses atau tampilkan QR Code kepada peserta.
4. Pantau kehadiran peserta secara *live* dengan mengklik kegiatan tersebut, atau melalui menu **Rekap** -> **Kehadiran** untuk data menyeluruh.
5. Verifikasi data absensi pegawai dengan menekan tombol **Verifikasi Absen** bila diperlukan.

---

## 💡 Tips & Trik Memaksimalkan Aplikasi

### 1. Penanganan Absensi Manual (Jika Menggunakan Kertas Tanda Tangan)
Terkadang di lapangan terjadi kondisi khusus, misalnya jaringan internet mati total, kegiatan di pelosok, atau acara menggunakan daftar hadir kertas tanda tangan basah. Data tersebut tetap bisa diintegrasikan ke BAIS dengan langkah mudah:

1. **Buat Jadwal Kegiatan:** Masuk sebagai Admin, buka menu **Data** -> **Kegiatan** lalu tekan tombol **Buat Jadwal Baru** sesuai kegiatan yang telah berlangsung.
2. **Import Data Kehadiran:** Masuk ke detail rekap kegiatan tersebut, tekan tombol **Import Data Absen** untuk mengunggah file Excel berisi data rekap kehadiran.
> **Hasil:** Seluruh data pegawai masuk ke sistem digital secara otomatis dan dapat diverifikasi langsung.

### 2. Pasang Aplikasi di Layar Utama HP (PWA)
Tidak perlu mengunduh lewat Play Store atau App Store:
- **Di Google Chrome (Android):** Tekan titik tiga di kanan atas -> pilih **"Tambahkan ke Layar Utama"** / **"Install App"**.
- **Di Safari (iPhone/iOS):** Tekan tombol *Share* (ikon kotak panah ke atas) -> pilih **"Add to Home Screen"**.
- Aplikasi akan muncul seperti aplikasi biasa di HP dan lebih cepat dibuka.

### 3. Memastikan GPS Akurat
- Aktifkan fitur *High Accuracy / Lokasi Akurasi Tinggi* pada pengaturan GPS ponsel.
- Jika lokasi meleset di dalam ruangan, keluar sebentar ke area terbuka agar GPS cepat mengunci koordinat.

---

## ❓ Pertanyaan yang Sering Diajukan (FAQ)

**Q: Mengapa muncul pesan "Lokasi tidak terdeteksi" atau "Di luar radius"?**  
A: Pastikan izin lokasi (GPS) pada browser HP sudah diatur ke **"Izinkan / Allow"**. Pastikan juga Anda sudah berada di lokasi acara sesuai radius yang ditentukan panitia.

**Q: Mengapa kamera tidak bisa dibuka atau blank hitam saat mau ambil foto?**  
A: Periksa pengaturan browser Anda, pastikan izin kamera diaktifkan. Jangan membuka aplikasi lain yang sedang menggunakan kamera secara bersamaan.

**Q: Bagaimana jika saya lupa kode akses kegiatan?**  
A: Silakan tanyakan kepada panitia pelaksana kegiatan atau admin OPD terkait.

**Q: Apakah data absensi aman jika sinyal sempat terputus?**  
A: Sistem dirancang untuk memberikan notifikasi status pengiriman. Jika gagal terkirim, tombol *Coba Lagi* akan memproses ulang data tanpa perlu mengisi ulang formulir dari awal.

---

## 📞 Bantuan & Dukungan Teknis

Jika mengalami kendala operasional atau pertanyaan seputar penggunaan aplikasi, silakan hubungi tim pengelola teknis atau unit kepegawaian (BKPSDM) Pemerintah Kota Pariaman.
