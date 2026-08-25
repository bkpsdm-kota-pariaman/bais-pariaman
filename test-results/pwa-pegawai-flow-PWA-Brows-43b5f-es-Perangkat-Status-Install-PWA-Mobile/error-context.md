# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pwa-pegawai-flow.spec.js >> PWA / Browser Pegawai Flow (Non-PWA Mode) >> Tahap 1: Akses Landing Page -> Navigasi ke /pwa -> Cek Hak Akses Perangkat & Status Install
- Location: tests\e2e\pwa-pegawai-flow.spec.js:8:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('#view-permission-check')
Expected: visible
Received: hidden
Timeout:  10000ms

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('#view-permission-check')
    18 × locator resolved to <div id="view-permission-check" class="hidden-view fade-in bg-gray-50 min-h-screen pb-10">…</div>
       - unexpected value "hidden"

```

```yaml
- heading "PEMERINTAH KOTA PARIAMAN" [level=6]
- heading " BAIS Pariaman" [level=2]
- paragraph: Bukti Absensi Instan & Swafoto, Berbasis Akurasi Lokasi ASN Daerah
- heading " Verifikasi Pegawai" [level=5]
- text: NIP
- spinbutton "Masukkan NIP"
- text: NIK (Password)
- textbox "Masukkan NIK"
- button "MASUK APLIKASI"
- button " INSTALL APLIKASI"
- button " Panduan & Tutorial Install Manual"
- paragraph: BAIS Pariaman Kota Pariaman © 2026
- paragraph: "Versi: v6.1.169"
```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | const { attachLogger, logAction } = require('./test-logger');
  3   | 
  4   | test.describe('PWA / Browser Pegawai Flow (Non-PWA Mode)', () => {
  5   |   const TEST_NIP = process.env.TEST_NIP || process.env.PEGAWAI_NIP || '199001012020011001';
  6   |   const TEST_PASSWORD = process.env.TEST_PASSWORD || process.env.PEGAWAI_PASSWORD || '1234567890123456';
  7   | 
  8   |   test('Tahap 1: Akses Landing Page -> Navigasi ke /pwa -> Cek Hak Akses Perangkat & Status Install', async ({ page }) => {
  9   |     attachLogger(page, 'PWA-Tahap1');
  10  | 
  11  |     logAction.navigate('/');
  12  |     await page.goto('/');
  13  | 
  14  |     logAction.verify('Memeriksa tombol BUKA APLIKASI di Landing Page...');
  15  |     const btnBuka = page.locator('a:has-text("BUKA APLIKASI")');
  16  |     await expect(btnBuka).toBeVisible({ timeout: 10000 });
  17  | 
  18  |     logAction.click('BUKA APLIKASI', 'a:has-text("BUKA APLIKASI")');
  19  |     await btnBuka.click();
  20  | 
  21  |     logAction.verify('Memeriksa tampilan Hak Akses Perangkat (#view-permission-check)...');
  22  |     const permView = page.locator('#view-permission-check');
> 23  |     await expect(permView).toBeVisible({ timeout: 10000 });
      |                            ^ Error: expect(locator).toBeVisible() failed
  24  | 
  25  |     logAction.verify('Menahan tampilan hak akses selama 5 detik untuk inspeksi...');
  26  |     await page.waitForTimeout(5000);
  27  | 
  28  |     const badgeGpsText = await page.locator('#badge-perm-gps').innerText().catch(() => 'N/A');
  29  |     const badgeCamText = await page.locator('#badge-perm-camera').innerText().catch(() => 'N/A');
  30  |     console.log(`  📱 [STATUS AKSES PERANGKAT] Status GPS: ${badgeGpsText.replace(/\n/g, ' ')} | Status Kamera: ${badgeCamText.replace(/\n/g, ' ')}`);
  31  | 
  32  |     const btnLanjutkan = page.locator('#view-permission-check button:has-text("LANJUTKAN")');
  33  |     if (await btnLanjutkan.isVisible().catch(() => false)) {
  34  |       logAction.click('LANJUTKAN', '#view-permission-check button:has-text("LANJUTKAN")');
  35  |       await btnLanjutkan.click();
  36  |     }
  37  | 
  38  |     logAction.verify('Memeriksa tampilan Form Login (#view-login)...');
  39  |     await expect(page.locator('#view-login')).toBeVisible({ timeout: 10000 });
  40  | 
  41  |     logAction.verify('Memeriksa status tombol INSTALL APLIKASI (#btnInstallInLogin) di Halaman Login...');
  42  |     const btnInstall = page.locator('#btnInstallInLogin');
  43  |     const isInstallVisible = await btnInstall.isVisible().catch(() => false);
  44  |     console.log(`  📲 [STATUS TOMBOL INSTALL PWA] Visible: ${isInstallVisible ? 'YA (Tampil di Mode Browser)' : 'TIDAK'}`);
  45  |     expect(isInstallVisible).toBe(true);
  46  |     logAction.success('Tahap 1 Lolos: Landing page, PWA permission check & halaman login terverifikasi.');
  47  |   });
  48  | 
  49  |   test('Tahap 2: Tes Login Gagal (3x) & Login Berhasil dengan Parameter Command', async ({ page }) => {
  50  |     attachLogger(page, 'PWA-Tahap2');
  51  | 
  52  |     logAction.navigate('/pwa/');
  53  |     await page.goto('/pwa/');
  54  | 
  55  |     // Jika masuk ke permission check, klik Lanjutkan
  56  |     const permView = page.locator('#view-permission-check');
  57  |     if (await permView.isVisible().catch(() => false)) {
  58  |       const btnLanjutkan = page.locator('#view-permission-check button:has-text("LANJUTKAN")');
  59  |       if (await btnLanjutkan.isVisible().catch(() => false)) {
  60  |         await btnLanjutkan.click();
  61  |       }
  62  |     }
  63  | 
  64  |     await expect(page.locator('#view-login')).toBeVisible({ timeout: 10000 });
  65  | 
  66  |     logAction.verify('--- MENGUJI LOGIN GAGAL (3X CONCOCTED INVALID CREDENTIALS) ---');
  67  |     const invalidCredentials = [
  68  |       { nip: '111111111111111111', nik: '1111111111111111', tryName: 'Percobaan 1' },
  69  |       { nip: '222222222222222222', nik: '2222222222222222', tryName: 'Percobaan 2' },
  70  |       { nip: '333333333333333333', nik: '3333333333333333', tryName: 'Percobaan 3' }
  71  |     ];
  72  | 
  73  |     for (const cred of invalidCredentials) {
  74  |       logAction.input(`NIP Invalid (${cred.tryName})`, '#logNip', cred.nip);
  75  |       await page.fill('#logNip', cred.nip);
  76  |       logAction.input(`NIK Invalid (${cred.tryName})`, '#logNik', cred.nik);
  77  |       await page.fill('#logNik', cred.nik);
  78  | 
  79  |       logAction.click(`Submit Login (${cred.tryName})`, '#view-login button[type="submit"]');
  80  |       await page.click('#view-login button[type="submit"]');
  81  | 
  82  |       const swalPopup = page.locator('.swal2-popup');
  83  |       await expect(swalPopup).toBeVisible({ timeout: 10000 });
  84  |       const errorText = await swalPopup.innerText();
  85  |       logAction.verify(`Response Error SweetAlert (${cred.tryName}): "${errorText.replace(/\n/g, ' ')}"`);
  86  |       expect(errorText.toLowerCase()).toMatch(/tidak ditemukan|salah|gagal/i);
  87  | 
  88  |       // Tutup SweetAlert
  89  |       const swalOkBtn = page.locator('.swal2-confirm');
  90  |       if (await swalOkBtn.isVisible().catch(() => false)) {
  91  |         await swalOkBtn.click();
  92  |       }
  93  |       await expect(swalPopup).toBeHidden({ timeout: 5000 });
  94  |     }
  95  |     logAction.success('Tiga kali uji coba login dengan kredensial salah BERHASIL divalidasi error-nya.');
  96  | 
  97  |     logAction.verify(`--- MELAKUKAN LOGIN BENAR (NIP: ${TEST_NIP}) ---`);
  98  |     logAction.input('NIP Valid', '#logNip', TEST_NIP);
  99  |     await page.fill('#logNip', TEST_NIP);
  100 |     logAction.input('NIK/Password Valid', '#logNik', TEST_PASSWORD);
  101 |     await page.fill('#logNik', TEST_PASSWORD);
  102 | 
  103 |     logAction.click('MASUK APLIKASI', '#view-login button[type="submit"]');
  104 |     await page.click('#view-login button[type="submit"]');
  105 | 
  106 |     logAction.verify('Memeriksa keberhasilan masuk ke Dashboard Pegawai (#view-dashboard)...');
  107 |     await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 15000 });
  108 | 
  109 |     const appVersionText = await page.locator('#appVersion').innerText().catch(() => 'Versi tidak terdeteksi');
  110 |     console.log(`  ℹ️  [INFO VERSI APLIKASI FOOTER] Versi Aplikasi saat ini: ${appVersionText}`);
  111 | 
  112 |     logAction.success('Tahap 2 Lolos: Login gagal 3x & Login berhasil ke dashboard terverifikasi.');
  113 |   });
  114 | 
  115 |   test('Tahap 3: Uji Coba Komponen Dashboard, QR Identitas, Edit Profil & Sinkronisasi', async ({ page }) => {
  116 |     attachLogger(page, 'PWA-Tahap3');
  117 | 
  118 |     logAction.navigate('/pwa/');
  119 |     await page.goto('/pwa/');
  120 | 
  121 |     // Selesaikan login jika belum terautentikasi
  122 |     const dashboardView = page.locator('#view-dashboard');
  123 |     if (!await dashboardView.isVisible().catch(() => false)) {
```