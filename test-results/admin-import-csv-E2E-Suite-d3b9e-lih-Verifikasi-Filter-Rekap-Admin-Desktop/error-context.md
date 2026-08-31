# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-import-csv.spec.js >> E2E Suite: Admin Import Data Absensi CSV >> Full E2E Flow: Import CSV 20 Pegawai pada Kegiatan Baru (OPD Tidak Dipilih) & Verifikasi Filter Rekap
- Location: tests\e2e\admin-import-csv.spec.js:122:5

# Error details

```
Error: expect(locator).toHaveClass(expected) failed

Locator: locator('#modalImportAbsen')
Expected pattern: /show/
Received string:  "modal fade"
Timeout: 10000ms

Call log:
  - Expect "toHaveClass" with timeout 10000ms
  - waiting for locator('#modalImportAbsen')
    23 × locator resolved to <div tabindex="-1" class="modal fade" aria-hidden="true" id="modalImportAbsen" data-bs-backdrop="static" data-previous-aria-hidden="true">…</div>
       - unexpected value "modal fade"

```

```yaml
- dialog "Kesalahan":
  - heading "Kesalahan" [level=2]
  - text: Data jadwal tidak ditemukan.
  - button "OK"
```

# Test source

```ts
  112 |             console.error(`🚨 Pageerror: ${error.message}`);
  113 |         });
  114 | 
  115 |         attachLogger(page, 'Admin Import CSV 20 Pegawai');
  116 |         logAction.navigate('admin/index.html');
  117 |         await page.goto('admin/index.html');
  118 |         await page.waitForLoadState('domcontentloaded');
  119 |         await doAdminLogin(page);
  120 |     });
  121 | 
  122 |     test('Full E2E Flow: Import CSV 20 Pegawai pada Kegiatan Baru (OPD Tidak Dipilih) & Verifikasi Filter Rekap', async ({ page }) => {
  123 |         // --- STEP 1: Buka Data -> Kegiatan & Tambah Kegiatan Baru (OPD Tidak Dipilih) ---
  124 |         logAction.step('1. Buka Menu Data -> Kegiatan');
  125 |         logAction.click('Dropdown Menu Data', '#navbarDropdownData');
  126 |         await page.click('#navbarDropdownData');
  127 | 
  128 |         logAction.click('Menu Kegiatan', 'a.dropdown-item:has-text("Kegiatan")');
  129 |         await page.click('a.dropdown-item:has-text("Kegiatan")');
  130 |         await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 10000 });
  131 | 
  132 |         logAction.step('2. Buat Kegiatan Baru (OPD Tidak Dipilih)');
  133 |         const btnBuatJadwal = page.locator('button:has-text("Buat Jadwal Baru")');
  134 |         await expect(btnBuatJadwal).toBeVisible();
  135 |         await btnBuatJadwal.click();
  136 | 
  137 |         const modalBuat = page.locator('#modalBuatKegiatan');
  138 |         await expect(modalBuat).toHaveClass(/show/, { timeout: 10000 });
  139 |         // Jeda sebentar agar animasi ditangani Bootstrap & event shown.bs.modal (mapGeofence) selesai
  140 |         await page.waitForTimeout(500);
  141 | 
  142 |         const timestampStr = Date.now().toString().slice(-5);
  143 |         const judulKegiatan = `Kegiatan Import CSV E2E ${timestampStr}`;
  144 | 
  145 |         logAction.input('Judul Jadwal', '#newJudul', judulKegiatan);
  146 |         const inputJudul = page.locator('#newJudul');
  147 |         await expect(inputJudul).toBeVisible();
  148 |         await inputJudul.click();
  149 |         await inputJudul.press('Control+A');
  150 |         await inputJudul.press('Backspace');
  151 |         await inputJudul.pressSequentially(judulKegiatan, { delay: 100 });
  152 | 
  153 |         const todayStr = new Date().toISOString().split('T')[0];
  154 |         await page.evaluate((d) => {
  155 |             if (typeof flatpickr !== 'undefined') {
  156 |                 flatpickr('#newTanggal').setDate(d, true);
  157 |             } else {
  158 |                 document.getElementById('newTanggal').value = d;
  159 |             }
  160 |         }, todayStr);
  161 | 
  162 |         await page.locator('#newJamMulai').fill('07:00');
  163 |         await page.locator('#newJamSelesai').fill('17:00');
  164 | 
  165 |         // Pastikan opsi OPD TIDAK DIPILIH (uncheck all OPD)
  166 |         logAction.step('Pastikan opsi OPD tidak dipilih (Deselect All OPD)');
  167 |         await page.evaluate(() => {
  168 |             if (typeof deselectAllOpd === 'function') {
  169 |                 deselectAllOpd('add');
  170 |             }
  171 |         });
  172 | 
  173 |         logAction.click('Tombol Simpan Jadwal', '#btnSimpanKegiatan');
  174 |         await Promise.all([
  175 |             page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && (resp.status() === 200 || resp.status() === 201)),
  176 |             page.click('#btnSimpanKegiatan')
  177 |         ]);
  178 |         await expect(modalBuat).toBeHidden({ timeout: 15000 });
  179 |         logAction.success(`Kegiatan baru "${judulKegiatan}" tanpa pilihan OPD berhasil dibuat`);
  180 | 
  181 |         // --- STEP 2: Cari Kegiatan Baru & Buka Rekap Absensi ---
  182 |         logAction.step('3. Cari Kegiatan Baru & Buka Rekap Absensi');
  183 |         const filterInput = page.locator('#filterJadwalSearch');
  184 |         await filterInput.click();
  185 |         await filterInput.press('Control+A');
  186 |         await filterInput.press('Backspace');
  187 |         await filterInput.pressSequentially(judulKegiatan, { delay: 100 });
  188 | 
  189 |         await Promise.all([
  190 |             page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.status() === 200),
  191 |             page.click('#dashboardContainer button:has-text("CARI")')
  192 |         ]);
  193 | 
  194 |         const tableRow = page.locator('#listKegiatanBody tr').filter({ hasText: judulKegiatan }).first();
  195 |         await expect(tableRow).toBeVisible({ timeout: 15000 });
  196 | 
  197 |         logAction.click('Tombol Rekap Kegiatan', 'button:has-text("Rekap")');
  198 |         const btnRekap = tableRow.locator('button:has-text("Rekap")').first();
  199 |         await btnRekap.click();
  200 | 
  201 |         const rekapContainer = page.locator('#rekapContainer');
  202 |         await expect(rekapContainer).toBeVisible({ timeout: 15000 });
  203 |         logAction.success('Halaman Rekap Absensi Kegiatan terbuka');
  204 | 
  205 |         // --- STEP 3: Import Data Absen Pakai CSV ---
  206 |         logAction.step('4. Buka Modal Import Absen & Upload CSV 20 Pegawai');
  207 |         const btnImportCsv = rekapContainer.locator('button:has-text("Import Data Absen")');
  208 |         await expect(btnImportCsv).toBeVisible({ timeout: 10000 });
  209 |         await btnImportCsv.click();
  210 | 
  211 |         const modalImport = page.locator('#modalImportAbsen');
> 212 |         await expect(modalImport).toHaveClass(/show/, { timeout: 10000 });
      |                                   ^ Error: expect(locator).toHaveClass(expected) failed
  213 | 
  214 |         logAction.step('Upload File CSV 20 Pegawai');
  215 |         const inputFileCsv = page.locator('#importFileCsv');
  216 |         await inputFileCsv.setInputFiles(tempCsvPath);
  217 | 
  218 |         logAction.verify('Memverifikasi preview data CSV 20 baris muncul');
  219 |         const previewContainer = page.locator('#previewImportContainer');
  220 |         await expect(previewContainer).toBeVisible({ timeout: 10000 });
  221 |         await expect(page.locator('#previewImportCount')).toHaveText('20');
  222 | 
  223 |         logAction.step('Set Status Verifikasi, Status Kehadiran, dan Keterangan Admin');
  224 |         const selectStatusVerifikasi = page.locator('#importStatusVerifikasi');
  225 |         await expect(selectStatusVerifikasi).toBeVisible();
  226 |         await selectStatusVerifikasi.selectOption('Terverifikasi Oleh Admin');
  227 |         logAction.success('Status Verifikasi diset ke: Terverifikasi Oleh Admin');
  228 | 
  229 |         const selectStatusKehadiran = page.locator('#importStatusKehadiran');
  230 |         await expect(selectStatusKehadiran).toBeVisible();
  231 |         await selectStatusKehadiran.selectOption('Hadir');
  232 |         logAction.success('Status Kehadiran diset ke: Hadir');
  233 | 
  234 |         logAction.input('Keterangan Admin Universal', '#importKeteranganAdmin', 'Import E2E Universal Note');
  235 |         const ketAdminInput = page.locator('#importKeteranganAdmin');
  236 |         await expect(ketAdminInput).toBeVisible();
  237 |         await ketAdminInput.click();
  238 |         await ketAdminInput.press('Control+A');
  239 |         await ketAdminInput.press('Backspace');
  240 |         await ketAdminInput.pressSequentially('Import E2E Universal Note', { delay: 100 });
  241 | 
  242 |         logAction.click('Tombol Proses Import Data Terpilih', '#btnProsesImport');
  243 |         const btnProses = page.locator('#btnProsesImport');
  244 |         await Promise.all([
  245 |             page.waitForResponse(resp => resp.url().includes('/admin/rekap/import-csv') && resp.status() === 200),
  246 |             btnProses.click()
  247 |         ]);
  248 | 
  249 |         logAction.verify('Menekan tombol OK pada dialog Import Berhasil');
  250 |         const successDialog = page.locator('.swal2-popup').filter({ hasText: 'Import Berhasil' });
  251 |         await expect(successDialog).toBeVisible({ timeout: 10000 });
  252 |         await expect(successDialog.locator('.swal2-confirm')).toHaveText('OK');
  253 |         await successDialog.locator('.swal2-confirm').click();
  254 |         await expect(successDialog).toBeHidden({ timeout: 10000 });
  255 | 
  256 |         logAction.verify('Memverifikasi modal import tertutup');
  257 |         await expect(modalImport).toBeHidden({ timeout: 15000 });
  258 |         logAction.success('Proses Import 20 Pegawai dari CSV berhasil diselesaikan');
  259 | 
  260 |         // --- STEP 4: Melakukan Pencarian ke Setiap 20 Pegawai di Rekap Absensi ---
  261 |         logAction.step('5. Verifikasi Pencarian 20 Pegawai di Rekap Absensi via Filter NIP / Nama');
  262 | 
  263 |         const searchInputRekap = page.locator('#rekapSearchInput');
  264 |         await expect(searchInputRekap).toBeVisible();
  265 | 
  266 |         for (let i = 0; i < importedPegawaiList.length; i++) {
  267 |             const p = importedPegawaiList[i];
  268 |             logAction.step(`Cek Pegawai [${i + 1}/20]: NIP ${p.nip} - ${p.nama}`);
  269 | 
  270 |             // Clear search box
  271 |             await searchInputRekap.click();
  272 |             await searchInputRekap.press('Control+A');
  273 |             await searchInputRekap.press('Backspace');
  274 | 
  275 |             // Ketik NIP pegawai via keyboard dengan delay 100ms per karakter sesuai aturan
  276 |             await searchInputRekap.pressSequentially(p.nip, { delay: 100 });
  277 | 
  278 |             // Klik Tampilkan
  279 |             const btnTampilkan = page.locator('#rekapContainer button:has-text("Tampilkan")');
  280 |             await btnTampilkan.click();
  281 | 
  282 |             // Verifikasi baris pegawai muncul di tabel rekap
  283 |             const rowTarget = page.locator('#rekapTableBody tr').filter({ hasText: p.nip }).first();
  284 |             await expect(rowTarget).toBeVisible({ timeout: 10000 });
  285 | 
  286 |             // Verifikasi NIP, Nama, OPD, Status Kehadiran & Status Verifikasi tercantum di tabel
  287 |             await expect(rowTarget).toContainText(p.nip);
  288 |             await expect(rowTarget).toContainText(p.nama);
  289 |             await expect(rowTarget).toContainText('Hadir');
  290 |             logAction.success(`Pegawai ${p.nama} (${p.nip}) terverifikasi: Hadir & Terverifikasi`);
  291 |         }
  292 | 
  293 |         // --- STEP 5: Verifikasi Bebas Exception/Error Browser ---
  294 |         logAction.verify('Memverifikasi tidak ada console error dan page error');
  295 |         expect(consoleErrors).toEqual([]);
  296 |         expect(pageErrors).toEqual([]);
  297 | 
  298 |         logAction.success('SELURUH SKENARIO E2E IMPORT CSV 20 PEGAWAI BERHASIL DAN PASSED!');
  299 |     });
  300 | });
  301 | 
```