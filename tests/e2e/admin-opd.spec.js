const { test, expect } = require('@playwright/test');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

test.describe('Admin Manajemen Data OPD Flow (CRUD OPD)', () => {

  test.beforeEach(async ({ page }) => {
    test.skip(!ADMIN_USER || !ADMIN_PASS, 
      'Set ADMIN_USER dan ADMIN_PASS di environment variable untuk menjalankan pengujian Data OPD.');

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
      console.log('[STEP] Berhasil masuk ke Dashboard Admin.');
    }

    console.log('[STEP] Membuka halaman Manajemen OPD (bukaHalamanOpd)...');
    await page.evaluate(() => bukaHalamanOpd());
    await expect(page.locator('#opdContainer')).toBeVisible({ timeout: 10000 });
  });

  test('Alur Lengkap CRUD Data OPD (Create, Read, Update, Delete)', async ({ page }) => {
    const timestamp = Date.now();
    const namaOpd = `Dinas Test E2E ${timestamp}`;
    const namaOpdUpdated = `Dinas Test E2E ${timestamp} - Updated`;

    // ----------------------------------------------------
    // 1. CREATE: Tambah OPD Baru
    // ----------------------------------------------------
    console.log('[STEP 1] Menekan tombol "Tambah OPD Baru" (bukaModalTambahOpd)...');
    const btnTambah = page.locator('button[onclick="bukaModalTambahOpd()"]');
    await expect(btnTambah).toBeVisible({ timeout: 10000 });
    await btnTambah.click();

    const modalOpd = page.locator('#modalOpd');
    await expect(modalOpd).toBeVisible({ timeout: 10000 });

    console.log(`[STEP 1] Mengisi nama OPD "${namaOpd}" ke #opdNama...`);
    await page.fill('#opdNama', namaOpd);

    console.log('[STEP 1] Menekan tombol Simpan OPD (#btnSimpanOpd)...');
    const [createResponse] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/admin/opd') && res.request().method() === 'POST', { timeout: 15000 }),
      page.click('#btnSimpanOpd')
    ]);

    const createStatus = createResponse.status();
    const createBody = await createResponse.text();
    console.log(`[STEP 1 API] HTTP ${createStatus}: ${createBody}`);

    if (createStatus !== 200 && createStatus !== 201) {
      throw new Error(`[ERROR API] Tambah OPD gagal: HTTP ${createStatus} - ${createBody}`);
    }

    console.log('[STEP 1] Memeriksa modal OPD tertutup...');
    await expect(modalOpd).toBeHidden({ timeout: 15000 });
    console.log('[SUCCESS 1] OPD baru berhasil ditambahkan.');

    // ----------------------------------------------------
    // 2. READ: Cari OPD Baru di Tabel
    // ----------------------------------------------------
    console.log(`[STEP 2] Mencari baris tabel dengan teks "${namaOpd}"...`);
    const targetRow = page.locator('#opdTableBody tr', { hasText: namaOpd });
    await expect(targetRow).toBeVisible({ timeout: 15000 });
    console.log('[SUCCESS 2] OPD baru berhasil ditemukan pada tabel.');

    // ----------------------------------------------------
    // 3. UPDATE: Edit Nama OPD
    // ----------------------------------------------------
    console.log('[STEP 3] Menekan tombol Edit OPD pada baris tabel...');
    await targetRow.locator('button[title="Edit OPD"]').click();
    await expect(modalOpd).toBeVisible({ timeout: 10000 });

    console.log(`[STEP 3] Mengubah nama OPD menjadi "${namaOpdUpdated}"...`);
    await page.fill('#opdNama', namaOpdUpdated);

    console.log('[STEP 3] Menekan tombol Simpan Perubahan (#btnSimpanOpd)...');
    const [updateResponse] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/admin/opd') && res.request().method() === 'PUT', { timeout: 15000 }),
      page.click('#btnSimpanOpd')
    ]);

    const updateStatus = updateResponse.status();
    const updateBody = await updateResponse.text();
    console.log(`[STEP 3 API] HTTP ${updateStatus}: ${updateBody}`);

    if (updateStatus !== 200) {
      throw new Error(`[ERROR API] Update OPD gagal: HTTP ${updateStatus} - ${updateBody}`);
    }

    await expect(modalOpd).toBeHidden({ timeout: 15000 });

    console.log(`[STEP 3] Memverifikasi nama OPD terupdate "${namaOpdUpdated}" di tabel...`);
    const updatedRow = page.locator('#opdTableBody tr', { hasText: namaOpdUpdated });
    await expect(updatedRow).toBeVisible({ timeout: 15000 });
    console.log('[SUCCESS 3] Perubahan nama OPD berhasil disimpan.');

    // ----------------------------------------------------
    // 4. DELETE: Hapus OPD
    // ----------------------------------------------------
    console.log('[STEP 4] Menekan tombol Hapus OPD pada baris tabel...');
    await updatedRow.locator('button[title="Hapus OPD"]').click();

    console.log('[STEP 4] Mengonfirmasi dialog SweetAlert2 ("Anda Yakin?" -> "Ya, Hapus!")...');
    const confirmModal = page.locator('.swal2-popup');
    await expect(confirmModal).toBeVisible({ timeout: 10000 });
    await expect(confirmModal).toContainText('Anda Yakin?');
    await page.click('.swal2-confirm');

    console.log('[STEP 4] Memeriksa notifikasi terhapus...');
    await expect(confirmModal).toContainText('Terhapus', { timeout: 15000 });
    await page.click('.swal2-confirm');

    console.log('[STEP 4] Memastikan baris OPD telah hilang dari tabel...');
    await expect(page.locator('#opdTableBody tr', { hasText: namaOpdUpdated })).toBeHidden({ timeout: 5000 });
    console.log('[SUCCESS 4] OPD berhasil dihapus dari tabel.');
  });

});
