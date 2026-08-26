# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pwa-admin-full-cycle-absensi.spec.js >> Full-Cycle E2E: Admin Buat Jadwal -> PWA Pegawai Absen Selfie -> Admin Cek Rekap >> Siklus Lengkap Presensi: Admin Jadwal (Kode Akses Otomatis) -> PWA Presensi Kamera -> Admin Cek Rekap
- Location: tests\e2e\pwa-admin-full-cycle-absensi.spec.js:9:3

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: page.fill: Test timeout of 120000ms exceeded.
Call log:
  - waiting for locator('#searchInput')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - text: 
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link "PEMERINTAH KOTA PARIAMAN  BAIS Pariaman" [ref=e4] [cursor=pointer]:
        - /url: "#"
        - generic [ref=e5]: PEMERINTAH KOTA PARIAMAN
        - generic [ref=e6]:
          - generic [ref=e7]: 
          - text: BAIS Pariaman
      - list [ref=e9]:
        - listitem [ref=e10]:
          - button " Data" [ref=e11] [cursor=pointer]:
            - generic [ref=e12]: 
            - text: Data
          - text:   
        - listitem [ref=e13]:
          - button " Rekap" [ref=e14] [cursor=pointer]:
            - generic [ref=e15]: 
            - text: Rekap
          - text:   
        - listitem [ref=e16]:
          - button "Keluar" [ref=e17] [cursor=pointer]
  - generic [ref=e18]:
    - generic [ref=e19]:
      - generic [ref=e20]:
        - heading " Daftar Jadwal Kegiatan" [level=4] [ref=e21]:
          - generic [ref=e22]: 
          - text: Daftar Jadwal Kegiatan
        - button " Buat Jadwal Baru" [ref=e23] [cursor=pointer]:
          - generic [ref=e24]: 
          - text: Buat Jadwal Baru
      - generic [ref=e26]:
        - generic [ref=e27]:
          - generic [ref=e28]: "Total Data: 12"
          - button " Download Excel" [ref=e29] [cursor=pointer]:
            - generic [ref=e30]: 
            - text: Download Excel
        - generic [ref=e31]:
          - generic [ref=e32]: Tampilkan
          - combobox [ref=e33]:
            - option "10" [selected]
            - option "25"
            - option "50"
            - option "100"
            - option "Semua Data"
          - generic [ref=e34]: baris
      - generic [ref=e35]:
        - table [ref=e36]:
          - rowgroup [ref=e37]:
            - row [ref=e38]:
              - columnheader "No" [ref=e39]
              - columnheader "Judul & Tanggal" [ref=e40]
              - columnheader "Kategori" [ref=e41]
              - columnheader "Waktu Pelaksanaan" [ref=e42]
              - columnheader "Aturan absensi" [ref=e43]
              - columnheader "Sinkron Cache" [ref=e44]
              - columnheader "Manajemen" [ref=e45]
          - rowgroup [ref=e46]:
            - row [ref=e47]:
              - cell "1" [ref=e48]
              - cell "UJI SIKLUS PRESENSI 1787735503851 Rabu, 26 Agustus 2026" [ref=e49]:
                - strong [ref=e50]: UJI SIKLUS PRESENSI 1787735503851
                - generic [ref=e51]: Rabu, 26 Agustus 2026
              - cell "Apel" [ref=e52]
              - cell "08:00:00 - 16:00:00 WIB" [ref=e54]
              - cell "-" [ref=e55]
              - cell " Sinkron  Sinkron Ulang" [ref=e56]:
                - generic [ref=e57]:
                  - generic [ref=e58]:
                    - generic [ref=e59]: 
                    - text: Sinkron
                  - button " Sinkron Ulang" [ref=e60] [cursor=pointer]:
                    - generic [ref=e61]: 
                    - text: Sinkron Ulang
              - cell [ref=e62]:
                - generic [ref=e63]:
                  - button " Lihat Rekap" [ref=e64] [cursor=pointer]:
                    - generic [ref=e65]: 
                    - text: Lihat Rekap
                  - generic [ref=e66]:
                    - button " QR" [ref=e67] [cursor=pointer]:
                      - generic [ref=e68]: 
                      - text: QR
                    - button " Edit" [ref=e69] [cursor=pointer]:
                      - generic [ref=e70]: 
                      - text: Edit
                    - button " Hapus" [ref=e71] [cursor=pointer]:
                      - generic [ref=e72]: 
                      - text: Hapus
            - row [ref=e73]:
              - cell "2" [ref=e74]
              - cell "Uji Coba Geofence 1787548845960 - Updated Senin, 24 Agustus 2026" [ref=e75]:
                - strong [ref=e76]: Uji Coba Geofence 1787548845960 - Updated
                - generic [ref=e77]: Senin, 24 Agustus 2026
              - cell "Apel" [ref=e78]
              - cell "07:30:00 - 16:00:00 WIB" [ref=e80]
              - cell " Wajib di Lokasi  Wajib Tepat Waktu" [ref=e81]:
                - generic [ref=e82]:
                  - generic [ref=e83]:
                    - generic [ref=e84]: 
                    - text: Wajib di Lokasi
                  - generic [ref=e85]:
                    - generic [ref=e86]: 
                    - text: Wajib Tepat Waktu
              - cell " Sinkron  Sinkron Ulang" [ref=e87]:
                - generic [ref=e88]:
                  - generic [ref=e89]:
                    - generic [ref=e90]: 
                    - text: Sinkron
                  - button " Sinkron Ulang" [ref=e91] [cursor=pointer]:
                    - generic [ref=e92]: 
                    - text: Sinkron Ulang
              - cell [ref=e93]:
                - generic [ref=e94]:
                  - button " Lihat Rekap" [ref=e95] [cursor=pointer]:
                    - generic [ref=e96]: 
                    - text: Lihat Rekap
                  - generic [ref=e97]:
                    - button " QR" [ref=e98] [cursor=pointer]:
                      - generic [ref=e99]: 
                      - text: QR
                    - button " Edit" [ref=e100] [cursor=pointer]:
                      - generic [ref=e101]: 
                      - text: Edit
                    - button " Hapus" [ref=e102] [cursor=pointer]:
                      - generic [ref=e103]: 
                      - text: Hapus
            - row [ref=e104]:
              - cell "3" [ref=e105]
              - cell "mknjbhvg Minggu, 23 Agustus 2026" [ref=e106]:
                - strong [ref=e107]: mknjbhvg
                - generic [ref=e108]: Minggu, 23 Agustus 2026
              - cell "Apel" [ref=e109]
              - cell "16:00:00 - 17:00:00 WIB" [ref=e111]
              - cell "-" [ref=e112]
              - cell " Sinkron  Sinkron Ulang" [ref=e113]:
                - generic [ref=e114]:
                  - generic [ref=e115]:
                    - generic [ref=e116]: 
                    - text: Sinkron
                  - button " Sinkron Ulang" [ref=e117] [cursor=pointer]:
                    - generic [ref=e118]: 
                    - text: Sinkron Ulang
              - cell [ref=e119]:
                - generic [ref=e120]:
                  - button " Lihat Rekap" [ref=e121] [cursor=pointer]:
                    - generic [ref=e122]: 
                    - text: Lihat Rekap
                  - generic [ref=e123]:
                    - button " QR" [ref=e124] [cursor=pointer]:
                      - generic [ref=e125]: 
                      - text: QR
                    - button " Edit" [ref=e126] [cursor=pointer]:
                      - generic [ref=e127]: 
                      - text: Edit
                    - button " Hapus" [ref=e128] [cursor=pointer]:
                      - generic [ref=e129]: 
                      - text: Hapus
            - row [ref=e130]:
              - cell "4" [ref=e131]
              - cell "Senam Mingguan Balai Kota Selasa, 18 Agustus 2026" [ref=e132]:
                - strong [ref=e133]: Senam Mingguan Balai Kota
                - generic [ref=e134]: Selasa, 18 Agustus 2026
              - cell "Senam" [ref=e135]
              - cell "08:20:00 - 11:00:00 WIB" [ref=e137]
              - cell " Wajib Tepat Waktu" [ref=e138]:
                - generic [ref=e140]:
                  - generic [ref=e141]: 
                  - text: Wajib Tepat Waktu
              - cell " Sinkron  Sinkron Ulang" [ref=e142]:
                - generic [ref=e143]:
                  - generic [ref=e144]:
                    - generic [ref=e145]: 
                    - text: Sinkron
                  - button " Sinkron Ulang" [ref=e146] [cursor=pointer]:
                    - generic [ref=e147]: 
                    - text: Sinkron Ulang
              - cell [ref=e148]:
                - generic [ref=e149]:
                  - button " Lihat Rekap" [ref=e150] [cursor=pointer]:
                    - generic [ref=e151]: 
                    - text: Lihat Rekap
                  - generic [ref=e152]:
                    - button " QR" [ref=e153] [cursor=pointer]:
                      - generic [ref=e154]: 
                      - text: QR
                    - button " Edit" [ref=e155] [cursor=pointer]:
                      - generic [ref=e156]: 
                      - text: Edit
                    - button " Hapus" [ref=e157] [cursor=pointer]:
                      - generic [ref=e158]: 
                      - text: Hapus
            - row [ref=e159]:
              - cell "5" [ref=e160]
              - cell "Gotong Royong Lomba Desa dan Kelurahan Bersih MINTA BERLIAN Minggu, 26 Juli 2026" [ref=e161]:
                - strong [ref=e162]: Gotong Royong Lomba Desa dan Kelurahan Bersih MINTA BERLIAN
                - generic [ref=e163]: Minggu, 26 Juli 2026
              - cell "Goro" [ref=e164]
              - cell "07:00:00 - 09:00:00 WIB" [ref=e166]
              - cell "-" [ref=e167]
              - cell " Sinkron  Sinkron Ulang" [ref=e168]:
                - generic [ref=e169]:
                  - generic [ref=e170]:
                    - generic [ref=e171]: 
                    - text: Sinkron
                  - button " Sinkron Ulang" [ref=e172] [cursor=pointer]:
                    - generic [ref=e173]: 
                    - text: Sinkron Ulang
              - cell [ref=e174]:
                - generic [ref=e175]:
                  - button " Lihat Rekap" [ref=e176] [cursor=pointer]:
                    - generic [ref=e177]: 
                    - text: Lihat Rekap
                  - generic [ref=e178]:
                    - button " QR" [ref=e179] [cursor=pointer]:
                      - generic [ref=e180]: 
                      - text: QR
                    - button " Edit" [ref=e181] [cursor=pointer]:
                      - generic [ref=e182]: 
                      - text: Edit
                    - button " Hapus" [ref=e183] [cursor=pointer]:
                      - generic [ref=e184]: 
                      - text: Hapus
            - row [ref=e185]:
              - cell "6" [ref=e186]
              - cell "Senam Mingguan Balaikota Jumat, 24 Juli 2026" [ref=e187]:
                - strong [ref=e188]: Senam Mingguan Balaikota
                - generic [ref=e189]: Jumat, 24 Juli 2026
              - cell "Senam" [ref=e190]
              - cell "08:20:00 - 09:00:00 WIB" [ref=e192]
              - cell "-" [ref=e193]
              - cell " Sinkron  Sinkron Ulang" [ref=e194]:
                - generic [ref=e195]:
                  - generic [ref=e196]:
                    - generic [ref=e197]: 
                    - text: Sinkron
                  - button " Sinkron Ulang" [ref=e198] [cursor=pointer]:
                    - generic [ref=e199]: 
                    - text: Sinkron Ulang
              - cell [ref=e200]:
                - generic [ref=e201]:
                  - button " Lihat Rekap" [ref=e202] [cursor=pointer]:
                    - generic [ref=e203]: 
                    - text: Lihat Rekap
                  - generic [ref=e204]:
                    - button " QR" [ref=e205] [cursor=pointer]:
                      - generic [ref=e206]: 
                      - text: QR
                    - button " Edit" [ref=e207] [cursor=pointer]:
                      - generic [ref=e208]: 
                      - text: Edit
                    - button " Hapus" [ref=e209] [cursor=pointer]:
                      - generic [ref=e210]: 
                      - text: Hapus
            - row [ref=e211]:
              - cell "7" [ref=e212]
              - cell "Pesantren ASN Masjid Istiqamah Adam Sorin Jumat, 17 Juli 2026" [ref=e213]:
                - strong [ref=e214]: Pesantren ASN Masjid Istiqamah Adam Sorin
                - generic [ref=e215]: Jumat, 17 Juli 2026
              - cell "Apel" [ref=e216]
              - cell "09:00:00 - 11:30:00 WIB" [ref=e218]
              - cell "-" [ref=e219]
              - cell " Sinkron  Sinkron Ulang" [ref=e220]:
                - generic [ref=e221]:
                  - generic [ref=e222]:
                    - generic [ref=e223]: 
                    - text: Sinkron
                  - button " Sinkron Ulang" [ref=e224] [cursor=pointer]:
                    - generic [ref=e225]: 
                    - text: Sinkron Ulang
              - cell [ref=e226]:
                - generic [ref=e227]:
                  - button " Lihat Rekap" [ref=e228] [cursor=pointer]:
                    - generic [ref=e229]: 
                    - text: Lihat Rekap
                  - generic [ref=e230]:
                    - button " QR" [ref=e231] [cursor=pointer]:
                      - generic [ref=e232]: 
                      - text: QR
                    - button " Edit" [ref=e233] [cursor=pointer]:
                      - generic [ref=e234]: 
                      - text: Edit
                    - button " Hapus" [ref=e235] [cursor=pointer]:
                      - generic [ref=e236]: 
                      - text: Hapus
            - row [ref=e237]:
              - cell "8" [ref=e238]
              - cell "Pesantren ASN Masjid Raya Badano Sungai Rotan Jumat, 17 Juli 2026" [ref=e239]:
                - strong [ref=e240]: Pesantren ASN Masjid Raya Badano Sungai Rotan
                - generic [ref=e241]: Jumat, 17 Juli 2026
              - cell "Wirid" [ref=e242]
              - cell "08:45:00 - 09:30:00 WIB" [ref=e244]
              - cell "-" [ref=e245]
              - cell " Sinkron  Sinkron Ulang" [ref=e246]:
                - generic [ref=e247]:
                  - generic [ref=e248]:
                    - generic [ref=e249]: 
                    - text: Sinkron
                  - button " Sinkron Ulang" [ref=e250] [cursor=pointer]:
                    - generic [ref=e251]: 
                    - text: Sinkron Ulang
              - cell [ref=e252]:
                - generic [ref=e253]:
                  - button " Lihat Rekap" [ref=e254] [cursor=pointer]:
                    - generic [ref=e255]: 
                    - text: Lihat Rekap
                  - generic [ref=e256]:
                    - button " QR" [ref=e257] [cursor=pointer]:
                      - generic [ref=e258]: 
                      - text: QR
                    - button " Edit" [ref=e259] [cursor=pointer]:
                      - generic [ref=e260]: 
                      - text: Edit
                    - button " Hapus" [ref=e261] [cursor=pointer]:
                      - generic [ref=e262]: 
                      - text: Hapus
            - row [ref=e263]:
              - cell "9" [ref=e264]
              - cell "Sidak Dinas Kesehatan Rabu, 15 Juli 2026" [ref=e265]:
                - strong [ref=e266]: Sidak Dinas Kesehatan
                - generic [ref=e267]: Rabu, 15 Juli 2026
              - cell "Sidak" [ref=e268]
              - cell "15:25:00 - 15:55:00 WIB" [ref=e270]
              - cell "-" [ref=e271]
              - cell " Sinkron  Sinkron Ulang" [ref=e272]:
                - generic [ref=e273]:
                  - generic [ref=e274]:
                    - generic [ref=e275]: 
                    - text: Sinkron
                  - button " Sinkron Ulang" [ref=e276] [cursor=pointer]:
                    - generic [ref=e277]: 
                    - text: Sinkron Ulang
              - cell [ref=e278]:
                - generic [ref=e279]:
                  - button " Lihat Rekap" [ref=e280] [cursor=pointer]:
                    - generic [ref=e281]: 
                    - text: Lihat Rekap
                  - generic [ref=e282]:
                    - button " QR" [ref=e283] [cursor=pointer]:
                      - generic [ref=e284]: 
                      - text: QR
                    - button " Edit" [ref=e285] [cursor=pointer]:
                      - generic [ref=e286]: 
                      - text: Edit
                    - button " Hapus" [ref=e287] [cursor=pointer]:
                      - generic [ref=e288]: 
                      - text: Hapus
            - row [ref=e289]:
              - cell "10" [ref=e290]
              - cell "Senam Mingguan Balaikota Jumat, 10 Juli 2026" [ref=e291]:
                - strong [ref=e292]: Senam Mingguan Balaikota
                - generic [ref=e293]: Jumat, 10 Juli 2026
              - cell "Senam" [ref=e294]
              - cell "07:15:00 - 07:50:00 WIB" [ref=e296]
              - cell "-" [ref=e297]
              - cell " Belum Sinkron  Sinkronkan" [ref=e298]:
                - generic [ref=e299]:
                  - generic [ref=e300]:
                    - generic [ref=e301]: 
                    - text: Belum Sinkron
                  - button " Sinkronkan" [ref=e302] [cursor=pointer]:
                    - generic [ref=e303]: 
                    - text: Sinkronkan
              - cell [ref=e304]:
                - generic [ref=e305]:
                  - button " Lihat Rekap" [ref=e306] [cursor=pointer]:
                    - generic [ref=e307]: 
                    - text: Lihat Rekap
                  - generic [ref=e308]:
                    - button " QR" [ref=e309] [cursor=pointer]:
                      - generic [ref=e310]: 
                      - text: QR
                    - button " Edit" [ref=e311] [cursor=pointer]:
                      - generic [ref=e312]: 
                      - text: Edit
                    - button " Hapus" [ref=e313] [cursor=pointer]:
                      - generic [ref=e314]: 
                      - text: Hapus
        - navigation "Page navigation" [ref=e316]:
          - list [ref=e317]:
            - listitem [ref=e318]:
              - button "« Prev"
            - listitem [ref=e319]:
              - button "1" [ref=e320] [cursor=pointer]
            - listitem [ref=e321]:
              - button "2" [ref=e322] [cursor=pointer]
            - listitem [ref=e323]:
              - button "Next »" [ref=e324] [cursor=pointer]
    - text:                                      
  - text:                     
```

# Test source

```ts
  42  | 
  43  |     const isLoginVisible = await page.locator('#adminUser').isVisible();
  44  |     if (isLoginVisible) {
  45  |       logAction.input('Username Admin', '#adminUser', ADMIN_USER);
  46  |       await page.fill('#adminUser', ADMIN_USER);
  47  |       await page.waitForTimeout(1000);
  48  | 
  49  |       logAction.input('Password Admin', '#adminPass', '******');
  50  |       await page.fill('#adminPass', ADMIN_PASS);
  51  |       await page.waitForTimeout(1000);
  52  | 
  53  |       logAction.click('Tombol Masuk Admin', '#btnLogin');
  54  |       await page.click('#btnLogin');
  55  | 
  56  |       await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
  57  |       await page.waitForTimeout(1000);
  58  |       logAction.success('Berhasil login ke Dashboard Admin');
  59  |     }
  60  | 
  61  |     logAction.menu('Buka Modal Tambah Jadwal Kegiatan Baru');
  62  |     logAction.click('Tombol Buat Jadwal Baru', 'button[onclick="bukaModalBuatKegiatan()"]');
  63  |     await page.evaluate(async () => {
  64  |       if (typeof bukaModalBuatKegiatan === 'function') {
  65  |         await bukaModalBuatKegiatan();
  66  |       }
  67  |     });
  68  | 
  69  |     const modalBuat = page.locator('#modalBuatKegiatan');
  70  |     await expect(modalBuat).toBeVisible({ timeout: 10000 });
  71  |     await page.waitForTimeout(1000);
  72  | 
  73  |     logAction.input('Judul Kegiatan', '#newJudul', judulKegiatan);
  74  |     await page.fill('#newJudul', judulKegiatan);
  75  |     await page.waitForTimeout(1000);
  76  | 
  77  |     logAction.input('Tanggal Kegiatan', '#newTanggal', todayStr);
  78  |     await page.evaluate((tgl) => {
  79  |       const el = document.getElementById('newTanggal');
  80  |       if (el && el._flatpickr) el._flatpickr.setDate(tgl, true);
  81  |     }, todayStr);
  82  |     await page.waitForTimeout(1000);
  83  | 
  84  |     logAction.input('Jam Mulai', '#newJamMulai', '08:00');
  85  |     await page.fill('#newJamMulai', '08:00');
  86  |     await page.waitForTimeout(1000);
  87  | 
  88  |     logAction.input('Jam Selesai', '#newJamSelesai', '16:00');
  89  |     await page.fill('#newJamSelesai', '16:00');
  90  |     await page.waitForTimeout(1000);
  91  | 
  92  |     // Pengaturan Lokasi: Klik Tombol "LOKASI SAYA"
  93  |     logAction.click('Tombol Lokasi Saya', '#btnLokasiAdd');
  94  |     await page.click('#btnLokasiAdd');
  95  |     await page.waitForTimeout(1500);
  96  | 
  97  |     const latLngVal = await page.inputValue('#geoLatLang');
  98  |     console.log(`  📍 [LOKASI SAYA TERDETEKSI SIKLUS]: "${latLngVal || 'Terisi Otomatis (Geolocated)'}"`);
  99  | 
  100 |     logAction.input('Radius Geofence (Meter)', '#geoRadius', '500');
  101 |     await page.fill('#geoRadius', '500');
  102 |     await page.waitForTimeout(1000);
  103 | 
  104 |     // Pengaturan Perangkat Daerah: Filter Kata Kunci "BADAN" & Masukkan Semuanya
  105 |     logAction.input('Cari OPD dengan kata kunci "BADAN"', '#searchAvailableOpd', 'BADAN');
  106 |     await page.fill('#searchAvailableOpd', 'BADAN');
  107 |     await page.waitForTimeout(1000);
  108 | 
  109 |     logAction.click('Masukkan Seluruh OPD Berkata Kunci "BADAN"', '#searchAvailableOpd');
  110 |     await page.evaluate(() => {
  111 |       const mode = 'add';
  112 |       if (typeof opdState !== 'undefined' && opdState[mode] && Array.isArray(opdState[mode].available)) {
  113 |         const badanOpds = opdState[mode].available.filter(opd => opd.toUpperCase().includes('BADAN'));
  114 |         badanOpds.forEach(opd => moveOpd(opd, mode, 'select'));
  115 |         renderOpdSelector(mode);
  116 |       } else if (typeof selectAllOpd === 'function') {
  117 |         selectAllOpd('add');
  118 |       }
  119 |     });
  120 |     await page.waitForTimeout(1000);
  121 | 
  122 |     // Submit tambah kegiatan & tangkap respon server untuk membaca Kode Akses otomatis
  123 |     logAction.click('Simpan Jadwal Kegiatan', '#btnSimpanKegiatan');
  124 |     const [createResponse] = await Promise.all([
  125 |       page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.request().method() === 'POST' && resp.status() === 200, { timeout: 20000 }),
  126 |       page.click('#btnSimpanKegiatan')
  127 |     ]);
  128 | 
  129 |     const resJson = await createResponse.json();
  130 |     if (resJson && resJson.data && resJson.data.kode_akses) {
  131 |       kodeAkses = resJson.data.kode_akses;
  132 |     }
  133 | 
  134 |     logAction.verify('Menunggu modal tambah kegiatan tertutup...');
  135 |     await expect(modalBuat).toBeHidden({ timeout: 15000 });
  136 |     await page.waitForTimeout(1000);
  137 | 
  138 |     // =========================================================================
  139 |     // LANGKAH 2: Ambil & Verifikasi Kode Akses Otomatis dari Tabel, Lalu Logout
  140 |     // =========================================================================
  141 |     logAction.input('Cari Judul Kegiatan Baru', '#searchInput', judulKegiatan);
> 142 |     await page.fill('#searchInput', judulKegiatan);
      |                ^ Error: page.fill: Test timeout of 120000ms exceeded.
  143 |     await page.press('#searchInput', 'Enter');
  144 |     await page.waitForTimeout(1000);
  145 | 
  146 |     const rowKegiatan = page.locator(`#listKegiatanBody tr:has-text("${judulKegiatan}")`);
  147 |     await expect(rowKegiatan).toBeVisible({ timeout: 10000 });
  148 | 
  149 |     // Jika belum didapat dari respon JSON, ekstraksi dari onclick tombol lihatRekap di tabel
  150 |     if (!kodeAkses) {
  151 |       kodeAkses = await page.evaluate((judul) => {
  152 |         const rows = Array.from(document.querySelectorAll('#listKegiatanBody tr'));
  153 |         const matchedRow = rows.find(r => r.innerText.includes(judul));
  154 |         if (!matchedRow) return null;
  155 |         const btn = matchedRow.querySelector('button[onclick*="lihatRekap"]');
  156 |         if (!btn) return null;
  157 |         const match = btn.getAttribute('onclick').match(/lihatRekap\('([^']+)'\)/);
  158 |         return match ? match[1] : null;
  159 |       }, judulKegiatan);
  160 |     }
  161 | 
  162 |     expect(kodeAkses).not.toBeNull();
  163 |     console.log(`\n  🔑 [KODE AKSES GENERATED OTOMATIS SYSTEM DITERIMA]: "${kodeAkses}"\n`);
  164 |     logAction.success(`Kode Akses "${kodeAkses}" berhasil didapatkan otomatis dari server!`);
  165 | 
  166 |     logAction.menu('Logout dari Admin');
  167 |     await page.evaluate(() => {
  168 |       if (typeof logoutAdmin === 'function') logoutAdmin();
  169 |       localStorage.clear();
  170 |       sessionStorage.clear();
  171 |     });
  172 |     await page.waitForTimeout(1000);
  173 | 
  174 |     // =========================================================================
  175 |     // LANGKAH 3: Buka /pwa & Login Menggunakan Akun (NIP & Password)
  176 |     // =========================================================================
  177 |     logAction.navigate('pwa/index.html');
  178 |     await page.goto('pwa/index.html');
  179 |     await page.waitForTimeout(1000);
  180 | 
  181 |     // Handle view-permission-check jika muncul
  182 |     const permView = page.locator('#view-permission-check');
  183 |     if (await permView.isVisible().catch(() => false)) {
  184 |       const btnLanjut = page.locator('#btn-perm-retry');
  185 |       if (await btnLanjut.isVisible().catch(() => false)) {
  186 |         logAction.click('KLIK DISINI UNTUK MELANJUTKAN', '#btn-perm-retry');
  187 |         await btnLanjut.click();
  188 |         await page.waitForTimeout(1000);
  189 |       }
  190 |     }
  191 | 
  192 |     const loginPwaView = page.locator('#view-login');
  193 |     await expect(loginPwaView).toBeVisible({ timeout: 15000 });
  194 | 
  195 |     logAction.input('NIP Pegawai (Akun NIP Admin)', '#logNip', ADMIN_USER);
  196 |     await page.fill('#logNip', ADMIN_USER);
  197 |     await page.waitForTimeout(1000);
  198 | 
  199 |     logAction.input('Password Pegawai', '#logNik', ADMIN_PASS);
  200 |     await page.fill('#logNik', ADMIN_PASS);
  201 |     await page.waitForTimeout(1000);
  202 | 
  203 |     logAction.click('Masuk Aplikasi PWA', '#view-login button[type="submit"]');
  204 |     await page.click('#view-login button[type="submit"]');
  205 | 
  206 |     const dashPwaView = page.locator('#view-dashboard');
  207 |     await expect(dashPwaView).toBeVisible({ timeout: 15000 });
  208 |     await page.waitForTimeout(1000);
  209 |     logAction.success('Berhasil login ke PWA Dashboard');
  210 | 
  211 |     // =========================================================================
  212 |     // LANGKAH 4: Tekan Tombol "AMBIL ABSENSI KEGIATAN"
  213 |     // =========================================================================
  214 |     logAction.click('Tombol AMBIL ABSENSI KEGIATAN', 'button:has-text("AMBIL ABSENSI KEGIATAN")');
  215 |     const btnAmbilAbsen = page.locator('button:has-text("AMBIL ABSENSI KEGIATAN")');
  216 |     await expect(btnAmbilAbsen).toBeVisible({ timeout: 10000 });
  217 |     await btnAmbilAbsen.click();
  218 |     await page.waitForTimeout(1000);
  219 | 
  220 |     // =========================================================================
  221 |     // LANGKAH 5: Input Kode Akses Otomatis & Cek Akses
  222 |     // =========================================================================
  223 |     const viewPilihMetode = page.locator('#view-pilih-metode');
  224 |     await expect(viewPilihMetode).toBeVisible({ timeout: 10000 });
  225 | 
  226 |     logAction.input(`Input Kode Akses Otomatis (${kodeAkses})`, '#inputKodeManual', kodeAkses);
  227 |     await page.fill('#inputKodeManual', kodeAkses);
  228 |     await page.waitForTimeout(1000);
  229 | 
  230 |     logAction.click('Lanjutkan Proses Kode Akses', '#view-pilih-metode button[type="submit"]');
  231 |     await Promise.all([
  232 |       page.waitForResponse(resp => resp.url().includes('/api/jadwal/check') && resp.status() === 200, { timeout: 15000 }),
  233 |       page.click('#view-pilih-metode button[type="submit"]')
  234 |     ]);
  235 | 
  236 |     const viewForm = page.locator('#view-form');
  237 |     await expect(viewForm).toBeVisible({ timeout: 15000 });
  238 |     await page.waitForTimeout(1000);
  239 |     logAction.success(`Form absensi kegiatan "${kodeAkses}" berhasil terbuka.`);
  240 | 
  241 |     // =========================================================================
  242 |     // LANGKAH 6: Pilih "Hadir", Akses Kamera & Ambil Foto Selfie
```