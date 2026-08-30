# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pwa-link-absensi-cadangan.spec.js >> E2E Suite: Simulasi User Link Absensi Cadangan saat Kamera / GPS Gagal >> Skenario 2: Data Link Berhasil Diambil & Halaman Dialihkan (Redirect)
- Location: tests\e2e\pwa-link-absensi-cadangan.spec.js:106:5

# Error details

```
Error: [CRITICAL - TEST STOPPED] Console error dideteksi pada browser: Failed to load resource: the server responded with a status of 404 (Not Found)
```

```
Error: expect(locator).toBeVisible() failed

Locator: locator('#viewForm')
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for locator('#viewForm')
  - Protocol error (Runtime.callFunctionOn): Internal server error, session closed.

```

```yaml
- text: 404 Not Found
```

# Test source

```ts
  53  |         const statusGps = page.locator('#perm-gps-status');
  54  | 
  55  |         logAction.verify('Memverifikasi minimal salah satu status Kamera atau Lokasi belum aktif');
  56  |         const cameraText = await statusCamera.textContent();
  57  |         const gpsText = await statusGps.textContent();
  58  |         expect(cameraText.includes('Belum Aktif') || gpsText.includes('Belum Aktif')).toBeTruthy();
  59  | 
  60  |         logAction.click('Tombol Aktifkan Kamera & Lokasi', '#btn-perm-retry');
  61  |         const btnAktifkan = page.locator('#btn-perm-retry');
  62  |         await btnAktifkan.click();
  63  | 
  64  |         logAction.step('4. Memverifikasi Tampilan Tombol Fallback ke BAIS Pariaman & Absensi Cadangan');
  65  |         const permFallback = page.locator('#perm-state-fallback');
  66  |         await expect(permFallback).toBeVisible({ timeout: 15000 });
  67  | 
  68  |         const btnAbsensiCadangan = page.locator('#btn-absensi-cadangan');
  69  |         await expect(btnAbsensiCadangan).toBeVisible();
  70  | 
  71  |         // Mocking API endpoint link absensi cadangan untuk mengembalikan status kosong (link tidak ditemukan)
  72  |         await page.route('**/pengaturan/link-absensi-cadangan**', async route => {
  73  |             await route.fulfill({
  74  |                 status: 200,
  75  |                 contentType: 'application/json',
  76  |                 body: JSON.stringify({ status: false, data: null, message: 'Link absensi cadangan belum diatur.' })
  77  |             });
  78  |         });
  79  | 
  80  |         logAction.click('Tombol ABSENSI CADANGAN', '#btn-absensi-cadangan');
  81  |         await btnAbsensiCadangan.click();
  82  | 
  83  |         logAction.step('5. Verifikasi Pesan "Link Tidak Ditemukan" & Uji Tekan Tombol "Muat Ulang" 2 Kali');
  84  |         logAction.verify('Menunggu tampilan State Error Link Tidak Ditemukan (#stateError)');
  85  |         const stateError = page.locator('#stateError');
  86  |         await expect(stateError).toBeVisible({ timeout: 15000 });
  87  |         await expect(page.locator('#stateError h4')).toContainText('Link Tidak Ditemukan');
  88  | 
  89  |         const btnMuatUlang = stateError.locator('button:has-text("Muat Ulang")');
  90  |         await expect(btnMuatUlang).toBeVisible();
  91  | 
  92  |         logAction.click('Tombol Muat Ulang (Penekanan Ke-1)', '#stateError button:has-text("Muat Ulang")');
  93  |         await btnMuatUlang.click();
  94  |         await expect(stateError).toBeVisible({ timeout: 10000 });
  95  | 
  96  |         logAction.click('Tombol Muat Ulang (Penekanan Ke-2)', '#stateError button:has-text("Muat Ulang")');
  97  |         await btnMuatUlang.click();
  98  |         await expect(stateError).toBeVisible({ timeout: 10000 });
  99  | 
  100 |         logAction.verify('Memverifikasi tidak ada console.error dan pageerror');
  101 |         expect(consoleErrors).toEqual([]);
  102 |         expect(pageErrors).toEqual([]);
  103 |         logAction.success('Skenario 1: Penarikan link gagal & uji muat ulang 2 kali BERHASIL!');
  104 |     });
  105 | 
  106 |     test('Skenario 2: Data Link Berhasil Diambil & Halaman Dialihkan (Redirect)', async ({ page }) => {
  107 |         logAction.step('1. Mengakses URL Root Halaman Utama (Landing Page)');
  108 |         logAction.navigate('index.html');
  109 |         await page.goto('index.html');
  110 |         await page.waitForLoadState('domcontentloaded');
  111 | 
  112 |         logAction.step('2. Klik Tombol "BUKA APLIKASI"');
  113 |         const btnBuka = page.locator('a:has-text("BUKA APLIKASI")');
  114 |         await expect(btnBuka).toBeVisible({ timeout: 10000 });
  115 |         logAction.click('Tombol BUKA APLIKASI', 'a:has-text("BUKA APLIKASI")');
  116 |         await btnBuka.click();
  117 | 
  118 |         logAction.step('3. Pengecekan Hak Akses & Klik Tombol Aktifkan');
  119 |         const viewPermCheck = page.locator('#view-permission-check');
  120 |         await expect(viewPermCheck).toBeVisible({ timeout: 15000 });
  121 | 
  122 |         logAction.click('Tombol Aktifkan Kamera & Lokasi', '#btn-perm-retry');
  123 |         await page.click('#btn-perm-retry');
  124 | 
  125 |         logAction.step('4. Membuka Menu Absensi Cadangan');
  126 |         const permFallback = page.locator('#perm-state-fallback');
  127 |         await expect(permFallback).toBeVisible({ timeout: 15000 });
  128 | 
  129 |         const targetRedirectUrl = 'absensi-cadangan/cadangan.html';
  130 | 
  131 |         // Mocking API endpoint link absensi cadangan untuk mengembalikan link yang valid
  132 |         await page.route('**/pengaturan/link-absensi-cadangan**', async route => {
  133 |             await route.fulfill({
  134 |                 status: 200,
  135 |                 contentType: 'application/json',
  136 |                 body: JSON.stringify({
  137 |                     status: true,
  138 |                     data: { link_absensi_cadangan: targetRedirectUrl }
  139 |                 })
  140 |             });
  141 |         });
  142 | 
  143 |         const btnAbsensiCadangan = page.locator('#btn-absensi-cadangan');
  144 |         logAction.click('Tombol ABSENSI CADANGAN', '#btn-absensi-cadangan');
  145 |         await btnAbsensiCadangan.click();
  146 | 
  147 |         logAction.step('6. Verifikasi Data Link Berhasil Diambil & Halaman Dialihkan ke Tujuan');
  148 |         logAction.verify('Menunggu alur pengalihan (Redirect) selesai');
  149 |         await page.waitForURL(`**/${targetRedirectUrl}**`, { timeout: 20000 });
  150 | 
  151 |         logAction.verify('Memverifikasi tampilan formulir Absensi Cadangan Internal di halaman tujuan');
  152 |         const formViewTarget = page.locator('#viewForm');
> 153 |         await expect(formViewTarget).toBeVisible({ timeout: 15000 });
      |                                      ^ Error: expect(locator).toBeVisible() failed
  154 | 
  155 |         logAction.verify('Memverifikasi tidak ada console.error dan pageerror');
  156 |         expect(consoleErrors).toEqual([]);
  157 |         expect(pageErrors).toEqual([]);
  158 |         logAction.success('Skenario 2: Data link berhasil diambil & redirect BERHASIL!');
  159 |     });
  160 | 
  161 | });
  162 | 
```