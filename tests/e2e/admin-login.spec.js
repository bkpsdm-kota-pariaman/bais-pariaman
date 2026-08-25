const { test, expect } = require('@playwright/test');

test.describe('Admin Login Flow - BAIS Pariaman', () => {

  test.beforeEach(async ({ page }) => {
    console.log('[STEP] Navigasi ke halaman Admin...');
    await page.goto('admin/index.html');
  });

  test('1. Menampilkan form input username, password, dan tombol masuk', async ({ page }) => {
    console.log('[STEP] Memeriksa keberadaan input #adminUser, #adminPass, dan tombol #btnLogin...');
    await expect(page.locator('#adminUser')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#adminPass')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#btnLogin')).toBeVisible({ timeout: 10000 });
    console.log('[SUCCESS] Seluruh elemen form login admin ditemukan.');
  });

  test('2. Menampilkan peringatan jika form login disubmit kosong', async ({ page }) => {
    console.log('[STEP] Menekan tombol masuk #btnLogin tanpa mengisi username/password...');
    await page.click('#btnLogin');

    console.log('[STEP] Memeriksa munculnya dialog peringatan SweetAlert2...');
    const swalModal = page.locator('.swal2-popup');
    await expect(swalModal).toBeVisible({ timeout: 10000 });
    await expect(swalModal).toContainText('Username dan Password harus diisi');
    console.log('[SUCCESS] Dialog peringatan berhasil muncul dengan pesan yang sesuai.');
  });

  test('3. Menampilkan pesan gagal jika kredensial admin salah', async ({ page }) => {
    console.log('[STEP] Mengisi #adminUser dengan username salah...');
    await page.fill('#adminUser', 'admin_invalid');
    console.log('[STEP] Mengisi #adminPass dengan password salah...');
    await page.fill('#adminPass', 'pass_invalid');
    console.log('[STEP] Menekan tombol masuk #btnLogin...');
    await page.click('#btnLogin');

    console.log('[STEP] Memeriksa pesan error "Login Gagal" pada SweetAlert2...');
    const swalModal = page.locator('.swal2-popup');
    await expect(swalModal).toBeVisible({ timeout: 15000 });
    await expect(swalModal).toContainText('Login Gagal');
    console.log('[SUCCESS] Notifikasi gagal login berhasil diverifikasi.');
  });

  test('4. Berhasil masuk ke dashboard ketika kredensial valid (dijalankan jika ENV tersedia)', async ({ page }) => {
    const username = process.env.ADMIN_USER;
    const password = process.env.ADMIN_PASS;

    test.skip(!username || !password, 'Set ADMIN_USER dan ADMIN_PASS di environment variable untuk menguji login sukses.');

    console.log(`[STEP] Mengisi username "${username}" ke #adminUser...`);
    await page.fill('#adminUser', username);
    console.log('[STEP] Mengisi password ke #adminPass...');
    await page.fill('#adminPass', password);
    console.log('[STEP] Menekan tombol masuk #btnLogin...');
    await page.click('#btnLogin');

    console.log('[STEP] Memeriksa kontainer #dashboardContainer tampil...');
    await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#loginOverlay')).toBeHidden();
    console.log('[SUCCESS] Berhasil masuk ke Dashboard Admin.');
  });

});
