const { test, expect } = require('@playwright/test');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

test.describe('Admin Rekap Keseluruhan Flow (Rentang Tanggal Juni 2026)', () => {

  test.beforeEach(async ({ page }) => {
    test.skip(!ADMIN_USER || !ADMIN_PASS, 
      'Set ADMIN_USER dan ADMIN_PASS di environment variable untuk menjalankan pengujian Rekap.');

    console.log('[STEP] Navigasi ke Halaman Admin (admin/index.html)...');
    await page.goto('admin/index.html');

    const isLoginVisible = await page.locator('#adminUser').isVisible();
    if (isLoginVisible) {
      console.log(`[STEP] Mengisi form login dengan username: "${ADMIN_USER}"...`);
      await page.fill('#adminUser', ADMIN_USER);
      await page.fill('#adminPass', ADMIN_PASS);
      console.log('[STEP] Menekan tombol login #btnLogin...');
      await page.click('#btnLogin');

      await Promise.race([
        page.waitForSelector('#dashboardContainer:not(.d-none)', { timeout: 15000 }),
        page.waitForSelector('.swal2-popup', { timeout: 15000 })
      ]).catch(() => {});

      const swalPopup = page.locator('.swal2-popup');
      if (await swalPopup.isVisible().catch(() => false)) {
        const text = await swalPopup.innerText();
        throw new Error(`Login Admin Gagal dari Server: ${text.replace(/\n/g, ' ')}`);
      }

      await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
    }

    console.log('[STEP] Membuka menu Rekap -> Kehadiran...');
    await page.evaluate(() => bukaHalamanRekapKeseluruhan());
    await expect(page.locator('#rekapKeseluruhanContainer')).toBeVisible({ timeout: 10000 });
  });

  test('1. Menampilkan peringatan jika tanggal mulai/selesai dikosongkan', async ({ page }) => {
    console.log('[STEP 1] Mengosongkan isian Flatpickr tanggal rekap...');
    await page.evaluate(() => {
      const startEl = document.getElementById('rekapKeseluruhanStartDate');
      const endEl = document.getElementById('rekapKeseluruhanEndDate');
      if (startEl && startEl._flatpickr) startEl._flatpickr.clear();
      if (endEl && endEl._flatpickr) endEl._flatpickr.clear();
    });

    console.log('[STEP 1] Menekan tombol Tampilkan Data...');
    await page.click('button[onclick="terapkanFilterRekapKeseluruhan()"]');

    console.log('[STEP 1] Memverifikasi SweetAlert "Input Tidak Lengkap" muncul...');
    const swalModal = page.locator('.swal2-popup');
    await expect(swalModal).toBeVisible({ timeout: 10000 });
    await expect(swalModal).toContainText('Input Tidak Lengkap');
    console.log('[STEP 1] Menutup dialog warning SweetAlert...');
    await page.click('.swal2-confirm');
    console.log('[SUCCESS 1] Peringatan berhasil terverifikasi.');
  });

  test('2. Tampilkan Rekap Kehadiran Tanggal 1 Juni 2026 s.d. 30 Juni 2026', async ({ page }) => {
    console.log('[STEP 2] Mengisi rentang tanggal rekap 1 Juni 2026 s.d. 30 Juni 2026 via Flatpickr...');
    await page.evaluate(() => {
      const startEl = document.getElementById('rekapKeseluruhanStartDate');
      const endEl = document.getElementById('rekapKeseluruhanEndDate');
      if (startEl && startEl._flatpickr) startEl._flatpickr.setDate('2026-06-01', true);
      if (endEl && endEl._flatpickr) endEl._flatpickr.setDate('2026-06-30', true);
    });

    console.log('[STEP 2] Menekan tombol Tampilkan Data...');
    await page.click('button[onclick="terapkanFilterRekapKeseluruhan()"]');

    console.log('[STEP 2] Memverifikasi data dimuat di tabel #rekapKeseluruhanTableBody...');
    const tbody = page.locator('#rekapKeseluruhanTableBody');
    await expect(tbody).toBeVisible({ timeout: 15000 });
    await expect(tbody).not.toContainText('Pilih rentang tanggal');
    console.log('[SUCCESS 2] Rekap kehadiran berhasil dimuat di tabel.');
  });

  test('3. Pencarian NIP dan Filter Status Kehadiran serta Status Verifikasi', async ({ page }) => {
    console.log('[STEP 3] Mengisi tanggal rekap 1 Juni 2026 s.d. 30 Juni 2026...');
    await page.evaluate(() => {
      const startEl = document.getElementById('rekapKeseluruhanStartDate');
      const endEl = document.getElementById('rekapKeseluruhanEndDate');
      if (startEl && startEl._flatpickr) startEl._flatpickr.setDate('2026-06-01', true);
      if (endEl && endEl._flatpickr) endEl._flatpickr.setDate('2026-06-30', true);
    });

    console.log('[STEP 3] Mengisi NIP / Nama Pegawai: "19" ke #rekapKeseluruhanSearchInput...');
    await page.fill('#rekapKeseluruhanSearchInput', '19');

    console.log('[STEP 3] Memilih Filter Status Kehadiran: "Hadir"...');
    await page.selectOption('#rekapKeseluruhanFilterStatus', 'Hadir');

    console.log('[STEP 3] Memilih Filter Status Verifikasi: "Terverifikasi Oleh Admin"...');
    await page.selectOption('#rekapKeseluruhanFilterVerifikasi', 'Terverifikasi Oleh Admin');

    console.log('[STEP 3] Menekan tombol Tampilkan Data...');
    await page.click('button[onclick="terapkanFilterRekapKeseluruhan()"]');
    await expect(page.locator('#rekapKeseluruhanTableBody')).toBeVisible({ timeout: 15000 });

    console.log('[STEP 3] Menekan tombol Reset Filter...');
    await page.click('button[onclick="resetRekapKeseluruhanFilters()"]');

    console.log('[STEP 3] Memverifikasi isian pencarian dan status di-reset...');
    await expect(page.locator('#rekapKeseluruhanSearchInput')).toHaveValue('');
    await expect(page.locator('#rekapKeseluruhanFilterStatus')).toHaveValue('semua');
    await expect(page.locator('#rekapKeseluruhanFilterVerifikasi')).toHaveValue('semua');
    console.log('[SUCCESS 3] Pencarian, filter, dan tombol reset berhasil diuji.');
  });

});
