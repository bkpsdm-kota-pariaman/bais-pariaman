const { test, expect } = require('@playwright/test');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

test.describe('Admin Rekap Statistik Kehadiran Flow (Rentang Tanggal Juni 2026)', () => {

  test.beforeEach(async ({ page }) => {
    test.skip(!ADMIN_USER || !ADMIN_PASS, 
      'Set ADMIN_USER dan ADMIN_PASS di environment variable untuk menjalankan pengujian Statistik Admin.');

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

    console.log('[STEP] Membuka menu Rekap -> Statistik Kehadiran...');
    await page.click('#navbarDropdownRekap');
    await page.click('a[onclick*="bukaHalamanStatistikKehadiran"]');
    await expect(page.locator('#statistikKehadiranContainer')).toBeVisible({ timeout: 10000 });
  });

  test('1. Validasi peringatan jika tanggal mulai/selesai dikosongkan', async ({ page }) => {
    console.log('[STEP 1] Mengosongkan Flatpickr tanggal statistik...');
    await page.evaluate(() => {
      const startEl = document.getElementById('statistikStartDate');
      const endEl = document.getElementById('statistikEndDate');
      if (startEl && startEl._flatpickr) startEl._flatpickr.clear();
      if (endEl && endEl._flatpickr) endEl._flatpickr.clear();
    });

    console.log('[STEP 1] Menekan tombol Tampilkan Statistik...');
    await page.click('button[onclick="terapkanFilterStatistik()"]');

    console.log('[STEP 1] Memeriksa kemunculan alert peringatan SweetAlert2...');
    const swalModal = page.locator('.swal2-popup');
    await expect(swalModal).toBeVisible({ timeout: 10000 });
    await expect(swalModal).toContainText('Input Tidak Lengkap');
    console.log('[STEP 1] Menutup dialog warning...');
    await page.click('.swal2-confirm');
    console.log('[SUCCESS 1] Validasi tanggal kosong berhasil diuji.');
  });

  test('2. Tampilkan Statistik Rentang Tanggal 1 Juni 2026 s.d. 30 Juni 2026', async ({ page }) => {
    console.log('[STEP 2] Mengisi rentang tanggal statistik 1 Juni 2026 s.d. 30 Juni 2026 via Flatpickr...');
    await page.evaluate(() => {
      const startEl = document.getElementById('statistikStartDate');
      const endEl = document.getElementById('statistikEndDate');
      if (startEl && startEl._flatpickr) startEl._flatpickr.setDate('2026-06-01', true);
      if (endEl && endEl._flatpickr) endEl._flatpickr.setDate('2026-06-30', true);
    });

    console.log('[STEP 2] Menekan tombol Tampilkan Statistik...');
    await page.click('button[onclick="terapkanFilterStatistik()"]');

    console.log('[STEP 2] Memeriksa data statistik dimuat di tabel...');
    const tbody = page.locator('#statistikTableBody');
    await expect(tbody).toBeVisible({ timeout: 15000 });
    await expect(tbody).not.toContainText('Pilih filter di atas');
    console.log('[SUCCESS 2] Tabel data statistik kehadiran berhasil dimuat.');
  });

  test('3. Uji Filter Kategori Status Kehadiran (Radio) dan Reset Filter', async ({ page }) => {
    console.log('[STEP 3] Mengisi tanggal 1 Juni 2026 s.d. 30 Juni 2026...');
    await page.evaluate(() => {
      const startEl = document.getElementById('statistikStartDate');
      const endEl = document.getElementById('statistikEndDate');
      if (startEl && startEl._flatpickr) startEl._flatpickr.setDate('2026-06-01', true);
      if (endEl && endEl._flatpickr) endEl._flatpickr.setDate('2026-06-30', true);
    });

    console.log('[STEP 3] Memilih kategori radio "Hadir"...');
    await page.check('input[name="statistikStatusKehadiran"][value="Hadir"]');
    console.log('[STEP 3] Menekan tombol Tampilkan Statistik...');
    await page.click('button[onclick="terapkanFilterStatistik()"]');
    await expect(page.locator('#statistikTableBody')).toBeVisible({ timeout: 15000 });

    console.log('[STEP 3] Memilih kategori radio "Izin Atasan"...');
    await page.check('input[name="statistikStatusKehadiran"][value="Izin Atasan"]');
    console.log('[STEP 3] Menekan tombol Tampilkan Statistik...');
    await page.click('button[onclick="terapkanFilterStatistik()"]');
    await expect(page.locator('#statistikTableBody')).toBeVisible({ timeout: 15000 });

    console.log('[STEP 3] Menekan tombol Reset Filter...');
    await page.click('button[onclick="resetStatistikFilters()"]');
    console.log('[STEP 3] Memverifikasi radio default "Alpa" tercentang kembali...');
    await expect(page.locator('#statAlpaKes')).toBeChecked();
    console.log('[SUCCESS 3] Filter kategori status dan tombol reset sukses diuji.');
  });

  test('4. Uji Modal Detail Statistik Pegawai (jika data tabel tersedia)', async ({ page }) => {
    console.log('[STEP 4] Mengisi tanggal 1 Juni 2026 s.d. 30 Juni 2026...');
    await page.evaluate(() => {
      const startEl = document.getElementById('statistikStartDate');
      const endEl = document.getElementById('statistikEndDate');
      if (startEl && startEl._flatpickr) startEl._flatpickr.setDate('2026-06-01', true);
      if (endEl && endEl._flatpickr) endEl._flatpickr.setDate('2026-06-30', true);
    });

    console.log('[STEP 4] Menekan tombol Tampilkan Statistik...');
    await page.click('button[onclick="terapkanFilterStatistik()"]');

    console.log('[STEP 4] Memeriksa ketersediaan tombol detail pegawai...');
    const btnDetail = page.locator('#statistikTableBody button[onclick*="lihatDetailStatistik"]').first();
    const isAvailable = await btnDetail.isVisible().catch(() => false);

    if (isAvailable) {
      console.log('[STEP 4] Klik tombol Detail Pegawai...');
      await btnDetail.click();
      const modalDetail = page.locator('#modalDetailStatistik');
      await expect(modalDetail).toBeVisible({ timeout: 10000 });
      console.log('[STEP 4] Klik tombol Tutup Modal Detail...');
      await modalDetail.locator('button[data-bs-dismiss="modal"]').first().click();
      await expect(modalDetail).toBeHidden({ timeout: 5000 });
      console.log('[SUCCESS 4] Modal detail statistik berhasil dibuka dan ditutup.');
    } else {
      console.log('[INFO 4] Tombol detail tidak tersedia karena tabel kosong.');
    }
  });

});
