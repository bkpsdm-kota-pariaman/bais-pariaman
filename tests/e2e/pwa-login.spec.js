const { test, expect } = require('@playwright/test');

test.describe('PWA Pegawai Login Flow', () => {

  test.beforeEach(async ({ page }) => {
    console.log('[STEP] Mock matchMedia standalone display mode untuk melewati view-install...');
    await page.addInitScript(() => {
      window.matchMedia = (query) => ({
        matches: query.includes('display-mode: standalone'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      });
    });

    console.log('[STEP] Navigasi ke Halaman PWA (pwa/index.html)...');
    await page.goto('pwa/index.html');
  });

  test('1. Halaman PWA menampilkan form login NIP dan NIK', async ({ page }) => {
    console.log('[STEP 1] Memeriksa keberadaan #view-login...');
    const loginView = page.locator('#view-login');
    await expect(loginView).toBeVisible({ timeout: 10000 });

    console.log('[STEP 1] Memeriksa keberadaan input #logNip...');
    await expect(page.locator('#logNip')).toBeVisible({ timeout: 10000 });
    console.log('[STEP 1] Memeriksa keberadaan input #logNik...');
    await expect(page.locator('#logNik')).toBeVisible({ timeout: 10000 });
    console.log('[STEP 1] Memeriksa keberadaan tombol submit login...');
    await expect(page.locator('#view-login button[type="submit"]')).toBeVisible({ timeout: 10000 });
    console.log('[SUCCESS 1] Seluruh elemen form login PWA ditemukan.');
  });

  test('2. Validasi error ketika login dengan NIP/NIK salah', async ({ page }) => {
    console.log('[STEP 2] Memeriksa keberadaan #view-login...');
    const loginView = page.locator('#view-login');
    await expect(loginView).toBeVisible({ timeout: 10000 });

    console.log('[STEP 2] Mengisi NIP dummy "199001012020011001" ke #logNip...');
    await page.fill('#logNip', '199001012020011001');
    console.log('[STEP 2] Mengisi NIK dummy "1234567890123456" ke #logNik...');
    await page.fill('#logNik', '1234567890123456');
    console.log('[STEP 2] Menekan tombol submit login...');
    await page.click('#view-login button[type="submit"]');

    console.log('[STEP 2] Memeriksa munculnya dialog error SweetAlert2...');
    const swalModal = page.locator('.swal2-popup');
    await expect(swalModal).toBeVisible({ timeout: 10000 });
    await expect(swalModal).toContainText('NIP tidak ditemukan atau Password salah');
    console.log('[SUCCESS 2] Pesan error login berhasil divalidasi.');
  });

});
