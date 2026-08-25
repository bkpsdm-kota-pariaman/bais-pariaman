# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-rekap-verifikasi.spec.js >> Admin Rekap Kehadiran - Fitur Verifikasi Manual & Hapus Data (5 Data Teratas) >> Uji coba Verifikasi Manual & Hapus Data pada 5 Data Teratas (Rentang Juli 2026)
- Location: tests\e2e\admin-rekap-verifikasi.spec.js:47:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeHidden() failed

Locator:  locator('#modalVerifikasi')
Expected: hidden
Received: visible

Call log:
  - Expect "toBeHidden" with timeout 15000ms
  - waiting for locator('#modalVerifikasi')
    5 × locator resolved to <div tabindex="-1" role="dialog" aria-modal="true" id="modalVerifikasi" class="modal fade show" data-bs-backdrop="static">…</div>
      - unexpected value "visible"
    17 × locator resolved to <div tabindex="-1" role="dialog" aria-modal="true" aria-hidden="true" id="modalVerifikasi" class="modal fade show" data-bs-backdrop="static">…</div>
       - unexpected value "visible"
  - Test timeout of 30000ms exceeded.

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - text: 
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link [ref=e4] [cursor=pointer]:
        - /url: "#"
        - generic [ref=e5]: PEMERINTAH KOTA PARIAMAN
        - generic [ref=e6]:
          - generic [ref=e7]: 
          - text: BAIS Pariaman
      - list [ref=e9]:
        - listitem [ref=e10]:
          - button [ref=e11] [cursor=pointer]:
            - generic [ref=e12]: 
            - text: Data
          - text:   
        - listitem [ref=e13]:
          - button [ref=e14] [cursor=pointer]:
            - generic [ref=e15]: 
            - text: Rekap
          - text:   
        - listitem [ref=e16]:
          - button [ref=e17] [cursor=pointer]: Keluar
  - generic [ref=e18]:
    - text:                                                                            
    - generic [ref=e19]:
      - button [ref=e20] [cursor=pointer]:
        - generic [ref=e21]: 
        - text: Kembali ke Daftar Jadwal
      - generic [ref=e22]:
        - heading [level=4] [ref=e23]:
          - generic [ref=e24]: 
          - text: Rekap Kehadiran
        - paragraph [ref=e25]: Menampilkan rekapitulasi data absensi dari berbagai kegiatan berdasarkan rentang tanggal.
      - generic [ref=e26]:
        - generic [ref=e27]:
          - heading [level=5] [ref=e28]: Filter Data
          - text: 
        - generic [ref=e29]:
          - generic [ref=e30]:
            - generic [ref=e31]: Tanggal Mulai
            - textbox [ref=e32] [cursor=pointer]:
              - /placeholder: Pilih Tanggal Mulai...
              - text: 2026-07-01
          - generic [ref=e33]:
            - generic [ref=e34]: Tanggal Selesai
            - textbox [ref=e35] [cursor=pointer]:
              - /placeholder: Pilih Tanggal Selesai...
              - text: 2026-07-31
          - generic [ref=e36]:
            - generic [ref=e37]: Filter OPD
            - combobox [ref=e38]
            - generic [ref=e40] [cursor=pointer]:
              - generic [ref=e41]: "-- Semua OPD --"
              - combobox [ref=e42]
          - generic [ref=e43]:
            - generic [ref=e44]: Cari (NIP/Nama)
            - textbox [ref=e45]:
              - /placeholder: Ketik NIP atau Nama...
          - generic [ref=e46]:
            - generic [ref=e47]: Status Kehadiran
            - combobox [ref=e48]
          - generic [ref=e49]:
            - generic [ref=e50]: Status Verifikasi
            - combobox [ref=e51]
          - generic [ref=e52]:
            - button [ref=e53] [cursor=pointer]:
              - generic [ref=e54]: 
              - text: Reset Filter
            - button [ref=e55] [cursor=pointer]:
              - generic [ref=e56]: 
              - text: Tampilkan Data
        - generic [ref=e58]:
          - generic [ref=e59]:
            - generic [ref=e60]: "Total Data: 11404"
            - button [ref=e61] [cursor=pointer]:
              - generic [ref=e62]: 
              - text: Download Excel
          - generic [ref=e63]:
            - generic [ref=e64]: Tampilkan
            - combobox [ref=e65]
            - generic [ref=e66]: baris
        - table [ref=e68]:
          - rowgroup [ref=e69]:
            - row [ref=e70]:
              - columnheader [ref=e71]: "No"
              - columnheader [ref=e72]: Kegiatan & Tanggal
              - columnheader [ref=e73]: Pegawai & OPD
              - columnheader [ref=e74]: Detail Absensi
              - columnheader [ref=e75]: Status Verifikasi
              - columnheader [ref=e76]: Aksi
          - rowgroup [ref=e77]:
            - row [ref=e78]:
              - cell [ref=e79]: "1"
              - cell [ref=e80]:
                - strong [ref=e81]: Gotong Royong Lomba Desa dan Kelurahan Bersih MINTA BERLIAN
                - generic [ref=e82]:
                  - generic [ref=e83]: 
                  - text: D29335
                - generic [ref=e84]:
                  - generic [ref=e85]: 
                  - text: 26 Juli 2026 (07:00:00 - 09:00:00)
              - cell [ref=e86]:
                - strong [ref=e87]: ALVIA AYUDA
                - text: "NIP: 199107102025062004"
                - generic [ref=e88]: "OPD: BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA"
              - cell [ref=e89]:
                - strong [ref=e90]: 07.32.19 WIB
                - generic [ref=e91]: Hadir
                - generic [ref=e93]: Jalan Syekh Burhanuddin, Karan Aur, Pariaman, Sumatera Barat, Sumatra, 25539, Indonesia
              - cell [ref=e94]:
                - generic [ref=e95]: Terverifikasi Sistem
                - link [ref=e96] [cursor=pointer]:
                  - /url: https://api-esdm.pariamankota.go.id/beta-bais-pariaman/uploads/foto_absensi/199107102025062004_D29335_1785025939_359.jpg
                  - generic [ref=e97]: 
                  - text: Lihat Foto
              - cell [ref=e98]:
                - button [ref=e99] [cursor=pointer]:
                  - generic [ref=e100]: 
                - button [ref=e101] [cursor=pointer]:
                  - generic [ref=e102]: 
            - row [ref=e103]:
              - cell [ref=e104]: "2"
              - cell [ref=e105]:
                - strong [ref=e106]: Senam Mingguan Balaikota
                - generic [ref=e107]:
                  - generic [ref=e108]: 
                  - text: 20EF37
                - generic [ref=e109]:
                  - generic [ref=e110]: 
                  - text: 24 Juli 2026 (08:20:00 - 09:00:00)
              - cell [ref=e111]:
                - strong [ref=e112]: ALVIA AYUDA
                - text: "NIP: 199107102025062004"
                - generic [ref=e113]: "OPD: BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA"
              - cell [ref=e114]:
                - strong [ref=e115]: 08.24.14 WIB
                - generic [ref=e116]: Hadir
                - generic [ref=e118]: Jalan Imam Bonjol, Alai Gelombang, Pariaman, Sumatera Barat, Sumatra, 25519, Indonesia
              - cell [ref=e119]:
                - generic [ref=e120]: Terverifikasi Sistem
                - link [ref=e121] [cursor=pointer]:
                  - /url: https://api-esdm.pariamankota.go.id/beta-bais-pariaman/uploads/foto_absensi/199107102025062004_20EF37_1784856254_748.jpg
                  - generic [ref=e122]: 
                  - text: Lihat Foto
              - cell [ref=e123]:
                - button [ref=e124] [cursor=pointer]:
                  - generic [ref=e125]: 
                - button [ref=e126] [cursor=pointer]:
                  - generic [ref=e127]: 
            - row [ref=e128]:
              - cell [ref=e129]: "3"
              - cell [ref=e130]:
                - strong [ref=e131]: Pesantren ASN Masjid Istiqamah Adam Sorin
                - generic [ref=e132]:
                  - generic [ref=e133]: 
                  - text: C089D7
                - generic [ref=e134]:
                  - generic [ref=e135]: 
                  - text: 17 Juli 2026 (09:00:00 - 11:30:00)
              - cell [ref=e136]:
                - strong [ref=e137]: ALVIA AYUDA
                - text: "NIP: 199107102025062004"
                - generic [ref=e138]: "OPD: BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA"
              - cell [ref=e139]:
                - strong [ref=e140]: 09.00.00 WIB
                - generic [ref=e141]: Hadir Terlambat
                - generic [ref=e143]: Df, Karan Aur, Pariaman, Sumatera Barat, Sumatra, 25514, Indonesia
              - cell [ref=e144]:
                - generic [ref=e145]: Disahkan Admin
                - link [ref=e146] [cursor=pointer]:
                  - /url: https://api-esdm.pariamankota.go.id/beta-bais-pariaman/uploads/foto_absensi/199107102025062004_C089D7_1784254004_830.jpg
                  - generic [ref=e147]: 
                  - text: Lihat Foto
                - generic [ref=e148]:
                  - generic [ref=e149]: "Pegawai:"
                  - text: "\"Absen cadangan\""
              - cell [ref=e150]:
                - button [ref=e151] [cursor=pointer]:
                  - generic [ref=e152]: 
                - button [ref=e153] [cursor=pointer]:
                  - generic [ref=e154]: 
            - row [ref=e155]:
              - cell [ref=e156]: "4"
              - cell [ref=e157]:
                - strong [ref=e158]: Pesantren ASN Masjid Raya Badano Sungai Rotan
                - generic [ref=e159]:
                  - generic [ref=e160]: 
                  - text: "470922"
                - generic [ref=e161]:
                  - generic [ref=e162]: 
                  - text: 17 Juli 2026 (08:45:00 - 09:30:00)
              - cell [ref=e163]:
                - strong [ref=e164]: ALVIA AYUDA
                - text: "NIP: 199107102025062004"
                - generic [ref=e165]: "OPD: BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA"
              - cell [ref=e166]:
                - strong [ref=e167]: 09.00.00 WIB
                - generic [ref=e168]: Hadir Terlambat
                - generic [ref=e170]: Lokasi tidak tercatat
              - cell [ref=e171]:
                - generic [ref=e172]: Disahkan Admin
                - generic [ref=e173]:
                  - generic [ref=e174]: "Pegawai:"
                  - text: "\"Absen cadangan\""
              - cell [ref=e175]:
                - button [ref=e176] [cursor=pointer]:
                  - generic [ref=e177]: 
                - button [ref=e178] [cursor=pointer]:
                  - generic [ref=e179]: 
            - row [ref=e180]:
              - cell [ref=e181]: "5"
              - cell [ref=e182]:
                - strong [ref=e183]: Senam Mingguan Balaikota
                - generic [ref=e184]:
                  - generic [ref=e185]: 
                  - text: 65E47E
                - generic [ref=e186]:
                  - generic [ref=e187]: 
                  - text: 10 Juli 2026 (07:15:00 - 07:50:00)
              - cell [ref=e188]:
                - strong [ref=e189]: ALVIA AYUDA
                - text: "NIP: 199107102025062004"
                - generic [ref=e190]: "OPD: BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA"
              - cell [ref=e191]:
                - strong [ref=e192]: 07.31.58 WIB
                - generic [ref=e193]: Hadir
                - generic [ref=e195]: Jalan Jawi-Jawi 1, Cimparuh, Pariaman, Sumatera Barat, Sumatra, 25519, Indonesia
              - cell [ref=e196]:
                - generic [ref=e197]: Terverifikasi Sistem
                - link [ref=e198] [cursor=pointer]:
                  - /url: https://api-esdm.pariamankota.go.id/beta-bais-pariaman/uploads/foto_absensi/199107102025062004_65E47E_1783643518_405.jpg
                  - generic [ref=e199]: 
                  - text: Lihat Foto
              - cell [ref=e200]:
                - button [ref=e201] [cursor=pointer]:
                  - generic [ref=e202]: 
                - button [ref=e203] [cursor=pointer]:
                  - generic [ref=e204]: 
            - row [ref=e205]:
              - cell [ref=e206]: "6"
              - cell [ref=e207]:
                - strong [ref=e208]: Gotong Royong Lomba Desa dan Kelurahan Bersih MINTA BERLIAN
                - generic [ref=e209]:
                  - generic [ref=e210]: 
                  - text: D29335
                - generic [ref=e211]:
                  - generic [ref=e212]: 
                  - text: 26 Juli 2026 (07:00:00 - 09:00:00)
              - cell [ref=e213]:
                - strong [ref=e214]: ASLI RIDWAN
                - text: "NIP: 198610102025211001"
                - generic [ref=e215]: "OPD: BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA"
              - cell [ref=e216]:
                - strong [ref=e217]: 09.18.49 WIB
                - generic [ref=e218]: Hadir Terlambat
                - generic [ref=e220]: Jalan Syekh Burhanuddin, Karan Aur, Pariaman, Sumatera Barat, Sumatra, 25539, Indonesia
              - cell [ref=e221]:
                - generic [ref=e222]: Terverifikasi Sistem
                - link [ref=e223] [cursor=pointer]:
                  - /url: https://api-esdm.pariamankota.go.id/beta-bais-pariaman/uploads/foto_absensi/198610102025211001_D29335_1785032329_707.jpg
                  - generic [ref=e224]: 
                  - text: Lihat Foto
                - generic [ref=e225]:
                  - generic [ref=e226]: "Pegawai:"
                  - text: "\"Telat ambil absen karena asik goro di kantor lurah karang Aur.\""
              - cell [ref=e227]:
                - button [ref=e228] [cursor=pointer]:
                  - generic [ref=e229]: 
                - button [ref=e230] [cursor=pointer]:
                  - generic [ref=e231]: 
            - row [ref=e232]:
              - cell [ref=e233]: "7"
              - cell [ref=e234]:
                - strong [ref=e235]: Senam Mingguan Balaikota
                - generic [ref=e236]:
                  - generic [ref=e237]: 
                  - text: 20EF37
                - generic [ref=e238]:
                  - generic [ref=e239]: 
                  - text: 24 Juli 2026 (08:20:00 - 09:00:00)
              - cell [ref=e240]:
                - strong [ref=e241]: ASLI RIDWAN
                - text: "NIP: 198610102025211001"
                - generic [ref=e242]: "OPD: BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA"
              - cell [ref=e243]:
                - strong [ref=e244]: 08.27.06 WIB
                - generic [ref=e245]: Hadir Diluar Lokasi
                - generic [ref=e247]: Lokasi GPS tidak terdeteksi
              - cell [ref=e248]:
                - generic [ref=e249]: Terverifikasi Sistem
                - link [ref=e250] [cursor=pointer]:
                  - /url: https://api-esdm.pariamankota.go.id/beta-bais-pariaman/uploads/foto_absensi/198610102025211001_20EF37_1784856426_535.jpg
                  - generic [ref=e251]: 
                  - text: Lihat Foto
                - generic [ref=e252]:
                  - generic [ref=e253]: "Pegawai:"
                  - text: "\"Ikuti senam\""
              - cell [ref=e254]:
                - button [ref=e255] [cursor=pointer]:
                  - generic [ref=e256]: 
                - button [ref=e257] [cursor=pointer]:
                  - generic [ref=e258]: 
            - row [ref=e259]:
              - cell [ref=e260]: "8"
              - cell [ref=e261]:
                - strong [ref=e262]: Pesantren ASN Masjid Istiqamah Adam Sorin
                - generic [ref=e263]:
                  - generic [ref=e264]: 
                  - text: C089D7
                - generic [ref=e265]:
                  - generic [ref=e266]: 
                  - text: 17 Juli 2026 (09:00:00 - 11:30:00)
              - cell [ref=e267]:
                - strong [ref=e268]: ASLI RIDWAN
                - text: "NIP: 198610102025211001"
                - generic [ref=e269]: "OPD: BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA"
              - cell [ref=e270]:
                - strong [ref=e271]: 09.00.00 WIB
                - generic [ref=e272]: Hadir Terlambat
                - generic [ref=e274]: Lokasi GPS tidak terdeteksi
              - cell [ref=e275]:
                - generic [ref=e276]: Disahkan Admin
                - link [ref=e277] [cursor=pointer]:
                  - /url: https://api-esdm.pariamankota.go.id/beta-bais-pariaman/uploads/foto_absensi/198610102025211001_C089D7_1784254841_118.jpg
                  - generic [ref=e278]: 
                  - text: Lihat Foto
                - generic [ref=e279]:
                  - generic [ref=e280]: "Pegawai:"
                  - text: "\"Absen cadangan\""
              - cell [ref=e281]:
                - button [ref=e282] [cursor=pointer]:
                  - generic [ref=e283]: 
                - button [ref=e284] [cursor=pointer]:
                  - generic [ref=e285]: 
            - row [ref=e286]:
              - cell [ref=e287]: "9"
              - cell [ref=e288]:
                - strong [ref=e289]: Pesantren ASN Masjid Raya Badano Sungai Rotan
                - generic [ref=e290]:
                  - generic [ref=e291]: 
                  - text: "470922"
                - generic [ref=e292]:
                  - generic [ref=e293]: 
                  - text: 17 Juli 2026 (08:45:00 - 09:30:00)
              - cell [ref=e294]:
                - strong [ref=e295]: ASLI RIDWAN
                - text: "NIP: 198610102025211001"
                - generic [ref=e296]: "OPD: BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA"
              - cell [ref=e297]:
                - strong [ref=e298]: 09.00.00 WIB
                - generic [ref=e299]: Hadir Terlambat
                - generic [ref=e301]: badano
              - cell [ref=e302]:
                - generic [ref=e303]: Disahkan Admin
                - link [ref=e304] [cursor=pointer]:
                  - /url: https://api-esdm.pariamankota.go.id/beta-bais-pariaman/uploads/foto_absensi/470922_198610102025211001.jpg
                  - generic [ref=e305]: 
                  - text: Lihat Foto
                - generic [ref=e306]:
                  - generic [ref=e307]: "Pegawai:"
                  - text: "\"Absen cadangan\""
              - cell [ref=e308]:
                - button [ref=e309] [cursor=pointer]:
                  - generic [ref=e310]: 
                - button [ref=e311] [cursor=pointer]:
                  - generic [ref=e312]: 
            - row [ref=e313]:
              - cell [ref=e314]: "10"
              - cell [ref=e315]:
                - strong [ref=e316]: Senam Mingguan Balaikota
                - generic [ref=e317]:
                  - generic [ref=e318]: 
                  - text: 65E47E
                - generic [ref=e319]:
                  - generic [ref=e320]: 
                  - text: 10 Juli 2026 (07:15:00 - 07:50:00)
              - cell [ref=e321]:
                - strong [ref=e322]: ASLI RIDWAN
                - text: "NIP: 198610102025211001"
                - generic [ref=e323]: "OPD: BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA"
              - cell [ref=e324]:
                - strong [ref=e325]: 08.09.25 WIB
                - generic [ref=e326]: Hadir Terlambat
                - generic [ref=e328]: Balaikota Pariaman, Jalan Imam Bonjol, Alai Gelombang, Pariaman, Sumatera Barat, Sumatra, 25519, Indonesia
              - cell [ref=e329]:
                - generic [ref=e330]: Terverifikasi Sistem
                - link [ref=e331] [cursor=pointer]:
                  - /url: https://api-esdm.pariamankota.go.id/beta-bais-pariaman/uploads/foto_absensi/198610102025211001_65E47E_1783645765_547.jpg
                  - generic [ref=e332]: 
                  - text: Lihat Foto
                - generic [ref=e333]:
                  - generic [ref=e334]: "Pegawai:"
                  - text: "\"Gagal terhubung ke server\""
              - cell [ref=e335]:
                - button [ref=e336] [cursor=pointer]:
                  - generic [ref=e337]: 
                - button [ref=e338] [cursor=pointer]:
                  - generic [ref=e339]: 
        - navigation [ref=e341]:
          - list [ref=e342]:
            - listitem [ref=e343]:
              - button: « Prev
            - listitem [ref=e344]:
              - button [ref=e345] [cursor=pointer]: "1"
            - listitem [ref=e346]:
              - button [ref=e347] [cursor=pointer]: "2"
            - listitem [ref=e348]:
              - button [ref=e349] [cursor=pointer]: "3"
            - listitem [ref=e350]:
              - generic: ...
            - listitem [ref=e351]:
              - button [ref=e352] [cursor=pointer]: "1141"
            - listitem [ref=e353]:
              - button [ref=e354] [cursor=pointer]: Next »
    - text:                      
  - dialog [ref=e355]:
    - generic [ref=e356]:
      - generic [ref=e357]:
        - heading [level=5] [ref=e358]:
          - generic [ref=e359]: 
          - text: Verifikasi Manual Admin
        - button [active] [ref=e360] [cursor=pointer]
      - generic [ref=e362]:
        - generic [ref=e363]:
          - generic [ref=e364]: Nama Pegawai
          - textbox [ref=e365]: ALVIA AYUDA
        - generic [ref=e366]:
          - generic [ref=e367]: Perangkat Daerah (OPD)
          - combobox [ref=e368]
        - generic [ref=e369]:
          - generic [ref=e370]: Jabatan
          - textbox [ref=e371]: PENATA KELOLA SISTEM DAN TEKNOLOGI INFORMASI
        - generic [ref=e372]:
          - generic [ref=e373]: Bukti Foto
          - link [ref=e374] [cursor=pointer]:
            - /url: https://api-esdm.pariamankota.go.id/beta-bais-pariaman/uploads/foto_absensi/199107102025062004_D29335_1785025939_359.jpg
            - generic [ref=e375]: 
            - text: Buka di Tab Baru
        - generic [ref=e376]:
          - generic [ref=e377]: Status Kehadiran
          - combobox [ref=e378]
        - generic [ref=e379]:
          - generic [ref=e380]: Tindakan Verifikasi
          - combobox [ref=e381]
          - generic [ref=e382]: "Status saat ini: Terverifikasi Sistem"
        - generic [ref=e383]:
          - generic [ref=e384]: Keterangan Pegawai (Read-only)
          - textbox [disabled] [ref=e385]: "-"
        - generic [ref=e386]:
          - generic [ref=e387]: Keterangan / Catatan Admin
          - textbox [ref=e388]:
            - /placeholder: "Contoh: Hadir atas izin pimpinan..."
            - text: Verifikasi Test E2E Iterasi 3 - 1787664535022
        - generic [ref=e389]:
          - generic [ref=e390]: Upload Bukti Dukung (Opsional, Maks 1MB)
          - button [ref=e391] [cursor=pointer]
          - text: "Format: JPG, PNG, PDF. Menimpa bukti foto yang sudah ada."
        - button [ref=e392] [cursor=pointer]:
          - generic [ref=e393]: 
          - text: Simpan Status
  - text:                  
  - dialog [ref=e396]:
    - heading "Gagal" [level=2] [ref=e401]
    - generic [ref=e402]: "Gagal memperbarui: Bukti dukung (Foto/PDF) wajib dilampirkan."
    - text: "!"
    - button "OK" [ref=e404] [cursor=pointer]
```

# Test source

```ts
  44  |     await expect(page.locator('#rekapKeseluruhanContainer')).toBeVisible({ timeout: 10000 });
  45  |   });
  46  | 
  47  |   test('Uji coba Verifikasi Manual & Hapus Data pada 5 Data Teratas (Rentang Juli 2026)', async ({ page }) => {
  48  |     logAction.verify('Menunggu instance Flatpickr siap di DOM...');
  49  |     await page.waitForFunction(() => {
  50  |       const el = document.getElementById('rekapKeseluruhanStartDate');
  51  |       return el && el._flatpickr;
  52  |     }, { timeout: 10000 });
  53  | 
  54  |     logAction.input('Tanggal Mulai', '#rekapKeseluruhanStartDate', '2026-07-01');
  55  |     logAction.input('Tanggal Selesai', '#rekapKeseluruhanEndDate', '2026-07-31');
  56  |     await page.evaluate(() => {
  57  |       const startEl = document.getElementById('rekapKeseluruhanStartDate');
  58  |       const endEl = document.getElementById('rekapKeseluruhanEndDate');
  59  |       if (startEl && startEl._flatpickr) startEl._flatpickr.setDate('2026-07-01', true);
  60  |       if (endEl && endEl._flatpickr) endEl._flatpickr.setDate('2026-07-31', true);
  61  |     });
  62  | 
  63  |     logAction.click('Tombol Tampilkan Data', 'button[onclick="terapkanFilterRekapKeseluruhan()"]');
  64  |     await page.click('button[onclick="terapkanFilterRekapKeseluruhan()"]');
  65  | 
  66  |     logAction.verify('Menunggu respon data tabel rekap kehadiran dari server...');
  67  |     await page.waitForFunction(() => {
  68  |       const tbody = document.getElementById('rekapKeseluruhanTableBody');
  69  |       if (!tbody) return false;
  70  |       const html = tbody.innerHTML;
  71  |       return html.includes('bukaModalVerifikasiKeseluruhan') ||
  72  |         html.includes('Tidak ada data') ||
  73  |         html.includes('Gagal memuat') ||
  74  |         (!html.includes('spinner-border') && !html.includes('Memuat data'));
  75  |     }, { timeout: 25000 });
  76  | 
  77  |     const hasData = await page.evaluate(() => {
  78  |       return document.querySelector('#rekapKeseluruhanTableBody button[onclick*="bukaModalVerifikasiKeseluruhan"]') !== null;
  79  |     });
  80  | 
  81  |     if (!hasData) {
  82  |       logAction.verify('Tidak ada data absensi untuk rentang 1-30 Juli 2026.');
  83  |       test.skip(true, 'Tidak ada data rekap kehadiran pada bulan Juli 2026 untuk diuji.');
  84  |     }
  85  | 
  86  |     const availableRows = await page.locator('#rekapKeseluruhanTableBody tr button[onclick*="bukaModalVerifikasiKeseluruhan"]').count();
  87  |     const countToTest = Math.min(availableRows, 5);
  88  |     logAction.verify(`Ditemukan ${availableRows} baris absensi. Menjalankan pengujian untuk ${countToTest} data teratas...`);
  89  | 
  90  |     for (let i = 1; i <= countToTest; i++) {
  91  |       console.log(`\n----------------------------------------------------------------------`);
  92  |       console.log(`🚀 [ITERASI ${i}/${countToTest}] Memulai Siklus Verifikasi & Hapus Baris ke-${i}`);
  93  |       console.log(`----------------------------------------------------------------------`);
  94  | 
  95  |       // 1. Reset filter pencarian
  96  |       logAction.input('Reset Pencarian NIP/Nama', '#rekapKeseluruhanSearchInput', '');
  97  |       await page.fill('#rekapKeseluruhanSearchInput', '');
  98  |       logAction.select('Filter Status Kehadiran', '#rekapKeseluruhanFilterStatus', 'semua');
  99  |       await page.selectOption('#rekapKeseluruhanFilterStatus', 'semua');
  100 |       logAction.select('Filter Status Verifikasi', '#rekapKeseluruhanFilterVerifikasi', 'semua');
  101 |       await page.selectOption('#rekapKeseluruhanFilterVerifikasi', 'semua');
  102 |       logAction.click('Tampilkan Semua Data', 'button[onclick="terapkanFilterRekapKeseluruhan()"]');
  103 |       await page.click('button[onclick="terapkanFilterRekapKeseluruhan()"]');
  104 | 
  105 |       logAction.verify('Menunggu baris teratas muncul di tabel...');
  106 |       await page.waitForFunction(() => {
  107 |         const editBtn = document.querySelector('#rekapKeseluruhanTableBody tr button[onclick*="bukaModalVerifikasiKeseluruhan"]');
  108 |         return editBtn !== null && editBtn.offsetParent !== null;
  109 |       }, { timeout: 15000 });
  110 | 
  111 |       const editBtn = page.locator('#rekapKeseluruhanTableBody tr button[onclick*="bukaModalVerifikasiKeseluruhan"]').first();
  112 |       const row = page.locator('#rekapKeseluruhanTableBody tr').first();
  113 |       const rowInfo = (await row.innerText()).replace(/\n/g, ' | ');
  114 |       console.log(`  📋 [DATA SAAT INI] ${rowInfo}`);
  115 | 
  116 |       logAction.click('Tombol Edit Status (Pensil)', 'button[onclick*="bukaModalVerifikasiKeseluruhan"]');
  117 |       await editBtn.click();
  118 | 
  119 |       const modalVerif = page.locator('#modalVerifikasi');
  120 |       await expect(modalVerif).toBeVisible({ timeout: 10000 });
  121 |       logAction.success('Modal "Verifikasi Manual Admin" berhasil terbuka');
  122 | 
  123 |       const nipTarget = await page.inputValue('#verifNip');
  124 |       const namaTarget = await page.inputValue('#verifNama');
  125 |       console.log(`  👤 [TARGET PEGAWAI] Nama: "${namaTarget}", NIP: "${nipTarget}"`);
  126 | 
  127 |       const newStatusKehadiran = (i % 2 === 0) ? 'Sakit' : 'Hadir';
  128 |       const newStatusVerifikasi = 'Terverifikasi Oleh Admin';
  129 |       const catatanAdmin = `Verifikasi Test E2E Iterasi ${i} - ${Date.now()}`;
  130 | 
  131 |       logAction.select('Status Kehadiran Baru', '#verifStatusKehadiran', newStatusKehadiran);
  132 |       await page.selectOption('#verifStatusKehadiran', newStatusKehadiran);
  133 | 
  134 |       logAction.select('Tindakan Verifikasi', '#verifStatus', newStatusVerifikasi);
  135 |       await page.selectOption('#verifStatus', newStatusVerifikasi);
  136 | 
  137 |       logAction.input('Catatan / Keterangan Admin', '#verifKeterangan', catatanAdmin);
  138 |       await page.fill('#verifKeterangan', catatanAdmin);
  139 | 
  140 |       logAction.click('Simpan Status Verifikasi', '#btnSimpanVerif');
  141 |       await page.click('#btnSimpanVerif');
  142 | 
  143 |       logAction.verify('Menunggu modal verifikasi tertutup...');
> 144 |       await expect(modalVerif).toBeHidden({ timeout: 15000 });
      |                                ^ Error: expect(locator).toBeHidden() failed
  145 |       logAction.success('Perubahan status berhasil disimpan');
  146 | 
  147 |       // 2. Cari lagi data menggunakan filter spesifik
  148 |       logAction.menu('Pencarian dengan Filter Hasil Perubahan');
  149 |       logAction.input('Cari NIP Pegawai', '#rekapKeseluruhanSearchInput', nipTarget);
  150 |       await page.fill('#rekapKeseluruhanSearchInput', nipTarget);
  151 |       logAction.select('Filter Status Kehadiran', '#rekapKeseluruhanFilterStatus', newStatusKehadiran);
  152 |       await page.selectOption('#rekapKeseluruhanFilterStatus', newStatusKehadiran);
  153 |       logAction.select('Filter Status Verifikasi', '#rekapKeseluruhanFilterVerifikasi', newStatusVerifikasi);
  154 |       await page.selectOption('#rekapKeseluruhanFilterVerifikasi', newStatusVerifikasi);
  155 |       logAction.click('Terapkan Filter Pencarian', 'button[onclick="terapkanFilterRekapKeseluruhan()"]');
  156 |       await page.click('button[onclick="terapkanFilterRekapKeseluruhan()"]');
  157 | 
  158 |       logAction.verify(`Memastikan data dengan NIP "${nipTarget}" muncul pada tabel...`);
  159 |       await page.waitForFunction((nip) => {
  160 |         const deleteBtn = document.querySelector('#rekapKeseluruhanTableBody tr button[onclick*="hapusDataAbsensiKeseluruhan"]');
  161 |         const tbody = document.getElementById('rekapKeseluruhanTableBody');
  162 |         return deleteBtn !== null && tbody.innerText.includes(nip);
  163 |       }, nipTarget, { timeout: 15000 });
  164 | 
  165 |       const filteredRow = page.locator('#rekapKeseluruhanTableBody tr', { hasText: nipTarget });
  166 |       const deleteBtn = filteredRow.locator('button[onclick*="hapusDataAbsensiKeseluruhan"]').first();
  167 |       await expect(deleteBtn).toBeVisible({ timeout: 10000 });
  168 |       logAction.success(`Data NIP "${nipTarget}" berhasil ditemukan kembali sesuai filter.`);
  169 | 
  170 |       // 3. Hapus data
  171 |       logAction.click('Tombol Hapus Absensi (Silang/Trash)', 'button[onclick*="hapusDataAbsensiKeseluruhan"]');
  172 |       await deleteBtn.click();
  173 | 
  174 |       logAction.verify('Menunggu konfirmasi dialog SweetAlert2 ("Anda Yakin?")...');
  175 |       const confirmModal = page.locator('.swal2-popup');
  176 |       await expect(confirmModal).toBeVisible({ timeout: 10000 });
  177 |       await expect(confirmModal).toContainText('Anda Yakin?');
  178 |       logAction.click('Konfirmasi "Ya, Hapus!"', '.swal2-confirm');
  179 |       await page.click('.swal2-confirm');
  180 | 
  181 |       logAction.verify('Menunggu notifikasi "Terhapus!"...');
  182 |       await expect(confirmModal).toContainText('Terhapus', { timeout: 15000 });
  183 |       logAction.click('Tutup Alert Berhasil Hapus', '.swal2-confirm');
  184 |       await page.click('.swal2-confirm');
  185 | 
  186 |       logAction.click('Refresh Data', 'button[onclick="terapkanFilterRekapKeseluruhan()"]');
  187 |       await page.click('button[onclick="terapkanFilterRekapKeseluruhan()"]');
  188 | 
  189 |       logAction.verify(`Memastikan NIP "${nipTarget}" telah hilang dari tabel...`);
  190 |       await expect(page.locator('#rekapKeseluruhanTableBody tr', { hasText: nipTarget })).toBeHidden({ timeout: 5000 });
  191 |       logAction.success(`[ITERASI ${i} SELESAI] Data NIP "${nipTarget}" berhasil diverifikasi dan dihapus.`);
  192 |     }
  193 | 
  194 |     logAction.success(`PENGUJIAN VERIFIKASI & HAPUS ${countToTest} DATA SELESAI DENGAN SUKSES!`);
  195 |   });
  196 | 
  197 | });
  198 | 
```