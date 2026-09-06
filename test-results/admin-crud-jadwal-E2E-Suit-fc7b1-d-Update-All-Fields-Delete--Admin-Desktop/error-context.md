# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-crud-jadwal.spec.js >> E2E Suite: Admin CRUD Jadwal Kegiatan >> Full CRUD Lifecycle: Jadwal Kegiatan (Create, Read, Update All Fields, Delete)
- Location: tests\e2e\admin-crud-jadwal.spec.js:59:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('#listKegiatanBody tr').filter({ hasText: 'Rapat E2E Test 706' }).first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for locator('#listKegiatanBody tr').filter({ hasText: 'Rapat E2E Test 706' }).first()

```

```yaml
- navigation:
  - link "PEMERINTAH KOTA PARIAMAN  BAIS Pariaman":
    - /url: "#"
  - list:
    - listitem:
      - button " Data"
    - listitem:
      - button " Rekap"
    - listitem:
      - button "Keluar"
- heading " Daftar Jadwal Kegiatan" [level=4]
- button " Buat Jadwal Baru"
- text: Cari Kode Akses / Judul Kegiatan
- textbox "Ketik Kode Akses atau Judul Kegiatan...": Rapat E2E Test 706
- text: Kategori Kegiatan
- combobox:
  - option "-- Semua Kategori --" [selected]
  - option "Apel Pagi"
  - option "Rapat"
  - option "Upacara"
  - option "Senam"
  - option "Lainnya"
- button " CARI"
- button " Reset"
- table:
  - rowgroup:
    - row "No Judul & Tanggal Kategori Waktu Pelaksanaan Aturan absensi Sinkron Cache Manajemen":
      - columnheader "No"
      - columnheader "Judul & Tanggal"
      - columnheader "Kategori"
      - columnheader "Waktu Pelaksanaan"
      - columnheader "Aturan absensi"
      - columnheader "Sinkron Cache"
      - columnheader "Manajemen"
  - rowgroup:
    - row "Belum ada jadwal kegiatan.":
      - cell "Belum ada jadwal kegiatan."
```

# Test source

```ts
  29  |     }
  30  | 
  31  |     test.beforeEach(async ({ page }) => {
  32  |         test.setTimeout(90000);
  33  |         consoleErrors = [];
  34  |         pageErrors = [];
  35  | 
  36  |         // HENTIKAN PROSES TEST JIKA TERJADI ERROR CONSOLE ATAU PAGE ERROR
  37  |         page.on('console', msg => {
  38  |             if (msg.type() === 'error') {
  39  |                 const text = msg.text();
  40  |                 consoleErrors.push(text);
  41  |                 console.error(`🚨 [STOP PROSES TEST] Console error dideteksi pada browser: ${text}`);
  42  |                 throw new Error(`[CRITICAL - TEST STOPPED] Console error dideteksi pada browser: ${text}`);
  43  |             }
  44  |         });
  45  | 
  46  |         page.on('pageerror', error => {
  47  |             pageErrors.push(error.message);
  48  |             console.error(`🚨 [STOP PROSES TEST] Page uncaught error dideteksi: ${error.message}`);
  49  |             throw new Error(`[CRITICAL - TEST STOPPED] Page uncaught error dideteksi pada browser: ${error.message}`);
  50  |         });
  51  | 
  52  |         attachLogger(page, 'Admin CRUD Jadwal');
  53  |         logAction.navigate('admin/index.html');
  54  |         await page.goto('admin/index.html');
  55  |         await page.waitForLoadState('domcontentloaded');
  56  |         await doAdminLogin(page);
  57  |     });
  58  | 
  59  |     test('Full CRUD Lifecycle: Jadwal Kegiatan (Create, Read, Update All Fields, Delete)', async ({ page }) => {
  60  |         logAction.step('1. Buka Menu Data -> Kegiatan');
  61  |         logAction.click('Dropdown Menu Data', '#navbarDropdownData');
  62  |         await page.click('#navbarDropdownData');
  63  | 
  64  |         logAction.click('Menu Kegiatan', 'a.dropdown-item:has-text("Kegiatan")');
  65  |         await page.click('a.dropdown-item:has-text("Kegiatan")');
  66  | 
  67  |         logAction.verify('Memverifikasi kontainer kegiatan/dashboard terbuka');
  68  |         await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 10000 });
  69  | 
  70  |         logAction.step('2. CREATE: Buka Modal & Tambah Jadwal Kegiatan Baru');
  71  |         const btnBuatJadwal = page.locator('button:has-text("Buat Jadwal Baru")');
  72  |         await expect(btnBuatJadwal).toBeVisible();
  73  |         logAction.click('Tombol Buat Jadwal Baru', 'button:has-text("Buat Jadwal Baru")');
  74  |         await btnBuatJadwal.click();
  75  | 
  76  |         const modalBuat = page.locator('#modalBuatKegiatan');
  77  |         await expect(modalBuat).toHaveClass(/show/, { timeout: 10000 });
  78  | 
  79  |         const rand3Digits = (Math.floor(100 + Math.random() * 900)).toString();
  80  |         const judulKegiatan = `Rapat E2E Test ${rand3Digits}`;
  81  | 
  82  |         logAction.input('Judul Jadwal', '#newJudul', judulKegiatan);
  83  |         await page.locator('#newJudul').pressSequentially(judulKegiatan, { delay: 100 });
  84  | 
  85  |         const todayStr = new Date().toISOString().split('T')[0];
  86  |         logAction.input('Tanggal Kegiatan via Flatpickr', '#newTanggal', todayStr);
  87  |         await page.evaluate((d) => {
  88  |             if (typeof flatpickr !== 'undefined') {
  89  |                 flatpickr('#newTanggal').setDate(d, true);
  90  |             } else {
  91  |                 document.getElementById('newTanggal').value = d;
  92  |             }
  93  |         }, todayStr);
  94  | 
  95  |         logAction.input('Jam Mulai', '#newJamMulai', '07:00');
  96  |         await page.locator('#newJamMulai').pressSequentially('07:00', { delay: 100 });
  97  | 
  98  |         logAction.input('Jam Selesai', '#newJamSelesai', '09:00');
  99  |         await page.locator('#newJamSelesai').pressSequentially('09:00', { delay: 100 });
  100 | 
  101 |         logAction.click('Tombol Pilih Semua OPD Target', '#modalBuatKegiatan button:has-text("Pilih Semua")');
  102 |         await page.click('#modalBuatKegiatan button:has-text("Pilih Semua")');
  103 | 
  104 |         logAction.click('Tombol Simpan Jadwal', '#btnSimpanKegiatan');
  105 |         await Promise.all([
  106 |             page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.status() === 200 || resp.status() === 200),
  107 |             page.click('#btnSimpanKegiatan')
  108 |         ]);
  109 | 
  110 |         logAction.verify('Memverifikasi modal tertutup dan respons sukses ditampilkan');
  111 |         await expect(modalBuat).toBeHidden({ timeout: 15000 });
  112 | 
  113 |         logAction.step('3. READ & FILTER: Gunakan Filter Pencarian untuk Menemukan Jadwal');
  114 |         const filterInput = page.locator('#filterJadwalSearch');
  115 |         await expect(filterInput).toBeVisible();
  116 |         logAction.input('Cari Judul Jadwal Kegiatan', '#filterJadwalSearch', judulKegiatan);
  117 |         await filterInput.click();
  118 |         await filterInput.press('Control+A');
  119 |         await filterInput.press('Backspace');
  120 |         await filterInput.pressSequentially(judulKegiatan, { delay: 100 });
  121 | 
  122 |         logAction.click('Tombol CARI Filter Jadwal', '#dashboardContainer button:has-text("CARI")');
  123 |         await Promise.all([
  124 |             page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.status() === 200),
  125 |             page.click('#dashboardContainer button:has-text("CARI")')
  126 |         ]);
  127 | 
  128 |         const tableRow = page.locator('#listKegiatanBody tr').filter({ hasText: judulKegiatan }).first();
> 129 |         await expect(tableRow).toBeVisible({ timeout: 15000 });
      |                                ^ Error: expect(locator).toBeVisible() failed
  130 |         logAction.success(`Jadwal "${judulKegiatan}" berhasil ditemukan di tabel listKegiatanBody`);
  131 | 
  132 |         logAction.step('4. UPDATE ALL FIELDS: Buka Modal Edit & Perbarui SELURUH Kolom Data Jadwal');
  133 |         const btnEdit = tableRow.locator('button.btn-outline-warning, button[title="Edit Jadwal"]').first();
  134 |         await expect(btnEdit).toBeVisible();
  135 |         logAction.click('Tombol Edit Jadwal', 'Edit');
  136 |         await btnEdit.click();
  137 | 
  138 |         const modalEdit = page.locator('#modalEditKegiatan');
  139 |         await expect(modalEdit).toHaveClass(/show/, { timeout: 10000 });
  140 | 
  141 |         // 4a. Edit Judul
  142 |         const editJudulInput = page.locator('#editJudul');
  143 |         await expect(editJudulInput).toBeVisible();
  144 |         const judulRevisi = `${judulKegiatan} REVISI`;
  145 |         logAction.input('Judul Jadwal Revisi', '#editJudul', judulRevisi);
  146 |         await editJudulInput.click();
  147 |         await editJudulInput.press('Control+A');
  148 |         await editJudulInput.press('Backspace');
  149 |         await editJudulInput.pressSequentially(judulRevisi, { delay: 100 });
  150 | 
  151 |         // 4b. Edit Kategori
  152 |         logAction.step('Perbarui Kategori Kegiatan ke Upacara');
  153 |         await page.locator('#editKategori').selectOption('Upacara');
  154 | 
  155 |         // 4c. Edit Tanggal (besok)
  156 |         const tomorrow = new Date();
  157 |         tomorrow.setDate(tomorrow.getDate() + 1);
  158 |         const tomorrowStr = tomorrow.toISOString().split('T')[0];
  159 |         logAction.input('Tanggal Kegiatan Revisi via Flatpickr', '#editTanggal', tomorrowStr);
  160 |         await page.evaluate((d) => {
  161 |             if (typeof flatpickr !== 'undefined') {
  162 |                 flatpickr('#editTanggal').setDate(d, true);
  163 |             } else {
  164 |                 document.getElementById('editTanggal').value = d;
  165 |             }
  166 |         }, tomorrowStr);
  167 | 
  168 |         // 4d. Edit Jam Mulai & Selesai
  169 |         logAction.input('Jam Mulai Revisi', '#editJamMulai', '08:00');
  170 |         await page.locator('#editJamMulai').pressSequentially('08:00', { delay: 100 });
  171 | 
  172 |         logAction.input('Jam Selesai Revisi', '#editJamSelesai', '11:00');
  173 |         await page.locator('#editJamSelesai').pressSequentially('11:00', { delay: 100 });
  174 | 
  175 |         // 4e. Edit Radius Geofence
  176 |         logAction.input('Radius Meter Revisi', '#editGeoRadius', '150');
  177 |         const radiusInput = page.locator('#editGeoRadius');
  178 |         await radiusInput.click();
  179 |         await radiusInput.press('Control+A');
  180 |         await radiusInput.press('Backspace');
  181 |         await radiusInput.pressSequentially('150', { delay: 100 });
  182 | 
  183 |         // 4f. Edit Target OPD (Select OPD Dinas)
  184 |         logAction.step('Perbarui Target Perangkat Daerah');
  185 |         await page.click('#modalEditKegiatan button:has-text("Pilih Dinas/Badan")');
  186 | 
  187 |         // 4g. Toggle Strict Mode Waktu & Lokasi
  188 |         logAction.step('Perbarui Pengaturan Strict Mode Waktu & Lokasi');
  189 |         const chkStrictTime = page.locator('#editStrictTime');
  190 |         if (!(await chkStrictTime.isChecked())) {
  191 |             await chkStrictTime.check();
  192 |         }
  193 | 
  194 |         // 4h. Klik Tombol Perbarui Jadwal (#btnSimpanEditKegiatan)
  195 |         logAction.click('Tombol Perbarui Jadwal', '#btnSimpanEditKegiatan');
  196 |         await Promise.all([
  197 |             page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.status() === 200),
  198 |             page.click('#btnSimpanEditKegiatan')
  199 |         ]);
  200 | 
  201 |         await expect(modalEdit).toBeHidden({ timeout: 15000 });
  202 |         logAction.success('Update SELURUH data Jadwal Kegiatan berhasil');
  203 | 
  204 |         logAction.step('5. DELETE: Cari Jadwal Revisi via Filter & Hapus');
  205 |         await filterInput.click();
  206 |         await filterInput.press('Control+A');
  207 |         await filterInput.press('Backspace');
  208 |         await filterInput.pressSequentially(judulRevisi, { delay: 100 });
  209 | 
  210 |         await Promise.all([
  211 |             page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.status() === 200),
  212 |             page.click('#dashboardContainer button:has-text("CARI")')
  213 |         ]);
  214 | 
  215 |         const targetRow = page.locator('#listKegiatanBody tr').filter({ hasText: judulRevisi }).first();
  216 |         await expect(targetRow).toBeVisible({ timeout: 15000 });
  217 | 
  218 |         const btnDelete = targetRow.locator('button.btn-outline-danger, button[title="Hapus Jadwal"]').first();
  219 |         await expect(btnDelete).toBeVisible();
  220 |         logAction.click('Tombol Hapus Jadwal', 'Hapus');
  221 |         await btnDelete.click();
  222 | 
  223 |         logAction.verify('Memverifikasi dialog konfirmasi hapus SweetAlert');
  224 |         const swalConfirm = page.locator('.swal2-confirm');
  225 |         await expect(swalConfirm).toBeVisible({ timeout: 10000 });
  226 |         logAction.click('Konfirmasi Hapus (Ya, Hapus!)', '.swal2-confirm');
  227 |         await swalConfirm.click();
  228 | 
  229 |         const swalOk = page.locator('.swal2-confirm');
```