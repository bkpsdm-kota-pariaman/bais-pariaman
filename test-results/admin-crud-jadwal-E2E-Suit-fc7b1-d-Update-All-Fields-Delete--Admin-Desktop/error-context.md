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

Locator: locator('#listKegiatanBody tr').filter({ hasText: 'Rapat E2E Test 542' }).first()
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for locator('#listKegiatanBody tr').filter({ hasText: 'Rapat E2E Test 542' }).first()
  - Target page, context or browser has been closed

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
- textbox "Ketik Kode Akses atau Judul Kegiatan...": Rapat E2E Test 542
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
  96  |         await page.locator('#newJamMulai').fill('07:00');
  97  | 
  98  |         logAction.input('Jam Selesai', '#newJamSelesai', '09:00');
  99  |         await page.locator('#newJamSelesai').fill('09:00');
  100 | 
  101 |         logAction.click('Tombol Pilih Semua OPD Target', 'button:has-text("Pilih Semua")');
  102 |         await page.evaluate(() => {
  103 |             if (typeof selectAllOpd === 'function') {
  104 |                 selectAllOpd('add');
  105 |             }
  106 |         });
  107 | 
  108 |         logAction.click('Tombol Simpan Jadwal', '#btnSimpanKegiatan');
  109 |         await Promise.all([
  110 |             page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.status() === 200 || resp.status() === 201),
  111 |             page.click('#btnSimpanKegiatan')
  112 |         ]);
  113 | 
  114 |         logAction.verify('Memverifikasi modal tertutup dan respons sukses ditampilkan');
  115 |         await expect(modalBuat).toBeHidden({ timeout: 15000 });
  116 | 
  117 |         logAction.step('3. READ & FILTER: Gunakan Filter Pencarian untuk Menemukan Jadwal');
  118 |         const filterInput = page.locator('#filterJadwalSearch');
  119 |         await expect(filterInput).toBeVisible();
  120 |         logAction.input('Cari Judul Jadwal Kegiatan', '#filterJadwalSearch', judulKegiatan);
  121 |         await filterInput.click();
  122 |         await filterInput.press('Control+A');
  123 |         await filterInput.press('Backspace');
  124 |         await filterInput.pressSequentially(judulKegiatan, { delay: 100 });
  125 | 
  126 |         logAction.click('Tombol CARI Filter Jadwal', '#dashboardContainer button:has-text("CARI")');
  127 |         await Promise.all([
  128 |             page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.status() === 200),
  129 |             page.click('#dashboardContainer button:has-text("CARI")')
  130 |         ]);
  131 | 
  132 |         const tableRow = page.locator('#listKegiatanBody tr').filter({ hasText: judulKegiatan }).first();
> 133 |         await expect(tableRow).toBeVisible({ timeout: 15000 });
      |                                ^ Error: expect(locator).toBeVisible() failed
  134 |         logAction.success(`Jadwal "${judulKegiatan}" berhasil ditemukan di tabel listKegiatanBody`);
  135 | 
  136 |         logAction.step('4. UPDATE ALL FIELDS: Buka Modal Edit & Perbarui SELURUH Kolom Data Jadwal');
  137 |         const btnEdit = tableRow.locator('button.btn-outline-warning, button[title="Edit Jadwal"]').first();
  138 |         await expect(btnEdit).toBeVisible();
  139 |         logAction.click('Tombol Edit Jadwal', 'Edit');
  140 |         await btnEdit.click();
  141 | 
  142 |         const modalEdit = page.locator('#modalEditKegiatan');
  143 |         await expect(modalEdit).toHaveClass(/show/, { timeout: 10000 });
  144 | 
  145 |         // 4a. Edit Judul
  146 |         const editJudulInput = page.locator('#editJudul');
  147 |         await expect(editJudulInput).toBeVisible();
  148 |         const judulRevisi = `${judulKegiatan} REVISI`;
  149 |         logAction.input('Judul Jadwal Revisi', '#editJudul', judulRevisi);
  150 |         await editJudulInput.click();
  151 |         await editJudulInput.press('Control+A');
  152 |         await editJudulInput.press('Backspace');
  153 |         await editJudulInput.pressSequentially(judulRevisi, { delay: 100 });
  154 | 
  155 |         // 4b. Edit Kategori
  156 |         logAction.step('Perbarui Kategori Kegiatan ke Upacara');
  157 |         await page.locator('#editKategori').selectOption('Upacara');
  158 | 
  159 |         // 4c. Edit Tanggal (besok)
  160 |         const tomorrow = new Date();
  161 |         tomorrow.setDate(tomorrow.getDate() + 1);
  162 |         const tomorrowStr = tomorrow.toISOString().split('T')[0];
  163 |         logAction.input('Tanggal Kegiatan Revisi via Flatpickr', '#editTanggal', tomorrowStr);
  164 |         await page.evaluate((d) => {
  165 |             if (typeof flatpickr !== 'undefined') {
  166 |                 flatpickr('#editTanggal').setDate(d, true);
  167 |             } else {
  168 |                 document.getElementById('editTanggal').value = d;
  169 |             }
  170 |         }, tomorrowStr);
  171 | 
  172 |         // 4d. Edit Jam Mulai & Selesai
  173 |         logAction.input('Jam Mulai Revisi', '#editJamMulai', '08:00');
  174 |         await page.locator('#editJamMulai').fill('08:00');
  175 | 
  176 |         logAction.input('Jam Selesai Revisi', '#editJamSelesai', '11:00');
  177 |         await page.locator('#editJamSelesai').fill('11:00');
  178 | 
  179 |         // 4e. Edit Radius Geofence
  180 |         logAction.input('Radius Meter Revisi', '#editGeoRadius', '150');
  181 |         const radiusInput = page.locator('#editGeoRadius');
  182 |         await radiusInput.click();
  183 |         await radiusInput.press('Control+A');
  184 |         await radiusInput.press('Backspace');
  185 |         await radiusInput.pressSequentially('150', { delay: 100 });
  186 | 
  187 |         // 4f. Edit Target OPD (Select OPD Dinas)
  188 |         logAction.step('Perbarui Target Perangkat Daerah');
  189 |         await page.evaluate(() => {
  190 |             if (typeof selectOpdDinas === 'function') {
  191 |                 selectOpdDinas('edit');
  192 |             }
  193 |         });
  194 | 
  195 |         // 4g. Toggle Strict Mode Waktu & Lokasi
  196 |         logAction.step('Perbarui Pengaturan Strict Mode Waktu & Lokasi');
  197 |         const chkStrictTime = page.locator('#editStrictTime');
  198 |         if (!(await chkStrictTime.isChecked())) {
  199 |             await chkStrictTime.check();
  200 |         }
  201 | 
  202 |         // 4h. Klik Tombol Perbarui Jadwal (#btnSimpanEditKegiatan)
  203 |         logAction.click('Tombol Perbarui Jadwal', '#btnSimpanEditKegiatan');
  204 |         await Promise.all([
  205 |             page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.status() === 200),
  206 |             page.click('#btnSimpanEditKegiatan')
  207 |         ]);
  208 | 
  209 |         await expect(modalEdit).toBeHidden({ timeout: 15000 });
  210 |         logAction.success('Update SELURUH data Jadwal Kegiatan berhasil');
  211 | 
  212 |         logAction.step('5. DELETE: Cari Jadwal Revisi via Filter & Hapus');
  213 |         await filterInput.click();
  214 |         await filterInput.press('Control+A');
  215 |         await filterInput.press('Backspace');
  216 |         await filterInput.pressSequentially(judulRevisi, { delay: 100 });
  217 | 
  218 |         await Promise.all([
  219 |             page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.status() === 200),
  220 |             page.click('#dashboardContainer button:has-text("CARI")')
  221 |         ]);
  222 | 
  223 |         const targetRow = page.locator('#listKegiatanBody tr').filter({ hasText: judulRevisi }).first();
  224 |         await expect(targetRow).toBeVisible({ timeout: 15000 });
  225 | 
  226 |         const btnDelete = targetRow.locator('button.btn-outline-danger, button[title="Hapus Jadwal"]').first();
  227 |         await expect(btnDelete).toBeVisible();
  228 |         logAction.click('Tombol Hapus Jadwal', 'Hapus');
  229 |         await btnDelete.click();
  230 | 
  231 |         logAction.verify('Memverifikasi dialog konfirmasi hapus SweetAlert');
  232 |         const swalConfirm = page.locator('.swal2-confirm');
  233 |         await expect(swalConfirm).toBeVisible({ timeout: 10000 });
```