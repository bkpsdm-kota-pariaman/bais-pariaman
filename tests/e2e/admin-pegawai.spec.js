const { test, expect } = require('@playwright/test');
const { attachLogger, logAction } = require('./test-logger');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

test.describe('Admin Manajemen Data Pegawai Flow (CRUD Pegawai)', () => {

  test.beforeEach(async ({ page }) => {
    attachLogger(page, 'Data Pegawai');

    test.skip(!ADMIN_USER || !ADMIN_PASS, 
      'Set ADMIN_USER dan ADMIN_PASS di environment variable untuk menjalankan pengujian Data Pegawai.');

    logAction.navigate('admin/index.html');
    await page.goto('admin/index.html');

    const isLoginVisible = await page.locator('#adminUser').isVisible();
    if (isLoginVisible) {
      logAction.input('Username Admin', '#adminUser', ADMIN_USER);
      await page.fill('#adminUser', ADMIN_USER);
      logAction.input('Password Admin', '#adminPass', '******');
      await page.fill('#adminPass', ADMIN_PASS);
      logAction.click('Tombol Masuk', '#btnLogin');
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
      logAction.success('Berhasil login ke Dashboard Admin.');
    }

    logAction.menu('Manajemen Data Pegawai (bukaHalamanPegawai)');
    await page.evaluate(() => bukaHalamanPegawai());
    await expect(page.locator('#pegawaiContainer')).toBeVisible({ timeout: 10000 });
  });

  test('Alur Lengkap CRUD Data Pegawai (Create, Read, Update, Delete)', async ({ page }) => {
    const timestamp = Date.now();
    const testNip = `1995${String(timestamp).padStart(14, '0').slice(-14)}`;
    const testNik = `1371${String(timestamp).padStart(12, '0').slice(-12)}`;
    const namaPegawai = `Pegawai Test ${timestamp}`;
    const namaUpdated = `Pegawai Test ${timestamp} - Updated`;

    // ----------------------------------------------------
    // 1. CREATE: Tambah Pegawai Baru
    // ----------------------------------------------------
    logAction.menu('Buka Modal Tambah Pegawai Baru');
    logAction.click('Tombol Tambah Pegawai', 'button[onclick="bukaModalTambahPegawai()"]');
    const btnTambah = page.locator('button[onclick="bukaModalTambahPegawai()"]');
    await expect(btnTambah).toBeVisible({ timeout: 10000 });
    await btnTambah.click();

    const modalPegawai = page.locator('#modalPegawai');
    await expect(modalPegawai).toBeVisible({ timeout: 10000 });

    logAction.verify('Menunggu pilihan OPD terisi dari server...');
    await page.waitForFunction(() => {
      const select = document.getElementById('pegawaiOpd');
      return select && select.options.length > 1;
    }, { timeout: 10000 });

    const firstValidOpd = await page.evaluate(() => {
      const select = document.getElementById('pegawaiOpd');
      return select.options.length > 1 ? select.options[1].value : '';
    });

    logAction.input('NIP Pegawai (18 Digit)', '#pegawaiNip', testNip);
    await page.fill('#pegawaiNip', testNip);
    logAction.input('Nama Pegawai', '#pegawaiNama', namaPegawai);
    await page.fill('#pegawaiNama', namaPegawai);
    logAction.input('NIK Pegawai (16 Digit)', '#pegawaiNik', testNik);
    await page.fill('#pegawaiNik', testNik);
    logAction.select('Perangkat Daerah (OPD)', '#pegawaiOpd', firstValidOpd);
    await page.selectOption('#pegawaiOpd', firstValidOpd);
    logAction.input('Jabatan Pegawai', '#pegawaiJabatan', 'Pranata Komputer');
    await page.fill('#pegawaiJabatan', 'Pranata Komputer');
    logAction.select('Jenis ASN', '#pegawaiJenisAsn', 'PNS');
    await page.selectOption('#pegawaiJenisAsn', 'PNS');

    logAction.check('Role ASN (Default)', '#roleAsn');
    await page.evaluate(() => {
      document.getElementById('roleAsn').checked = true;
    });

    logAction.click('Simpan Pegawai Baru', '#btnSimpanPegawai');
    const [createResponse] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/admin/pegawai') && res.request().method() === 'POST', { timeout: 15000 }),
      page.click('#btnSimpanPegawai')
    ]);

    const createStatus = createResponse.status();
    const createBodyText = await createResponse.text();
    console.log(`  📥 [API RESPONSE POST PEGAWAI] Status HTTP: ${createStatus} | Respon: ${createBodyText}`);

    if (createStatus !== 200 && createStatus !== 201) {
      throw new Error(`[ERROR API CREATE] Server mengembalikan HTTP ${createStatus}: ${createBodyText}`);
    }

    logAction.verify('Menunggu modalPegawai tertutup...');
    await expect(modalPegawai).toBeHidden({ timeout: 15000 });
    logAction.success('Pegawai baru berhasil ditambahkan.');

    // ----------------------------------------------------
    // 2. READ & SEARCH: Cari Pegawai di Tabel
    // ----------------------------------------------------
    logAction.menu('Pencarian Data Pegawai');
    logAction.input('Kata Kunci Pencarian Nama', '#pegawaiSearchInput', namaPegawai);
    await page.fill('#pegawaiSearchInput', namaPegawai);
    logAction.click('Tombol Cari Pegawai', 'button[onclick="loadPegawai()"]');
    await page.click('button[onclick="loadPegawai()"]');

    logAction.verify(`Memastikan baris pegawai "${namaPegawai}" tampil di tabel...`);
    const targetRow = page.locator('#pegawaiTableBody tr', { hasText: namaPegawai });
    await expect(targetRow).toBeVisible({ timeout: 15000 });
    await expect(targetRow).toContainText(testNip);
    logAction.success('Data pegawai berhasil ditemukan pada tabel.');

    // ----------------------------------------------------
    // 3. UPDATE: Edit Data Pegawai
    // ----------------------------------------------------
    logAction.menu('Edit Data Pegawai');
    logAction.click('Tombol Edit Pegawai', 'button[title="Edit Pegawai"]');
    await targetRow.locator('button[title="Edit Pegawai"]').click();
    await expect(modalPegawai).toBeVisible({ timeout: 10000 });

    logAction.input('Ubah Nama Pegawai', '#pegawaiNama', namaUpdated);
    await page.fill('#pegawaiNama', namaUpdated);
    logAction.input('Ubah Jabatan Pegawai', '#pegawaiJabatan', 'Analis Sistem Informasi');
    await page.fill('#pegawaiJabatan', 'Analis Sistem Informasi');

    logAction.click('Simpan Perubahan Pegawai', '#btnSimpanPegawai');
    const [updateResponse] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/admin/pegawai') && res.request().method() === 'PUT', { timeout: 15000 }),
      page.click('#btnSimpanPegawai')
    ]);

    const updateStatus = updateResponse.status();
    const updateBodyText = await updateResponse.text();
    console.log(`  📥 [API RESPONSE PUT PEGAWAI] Status HTTP: ${updateStatus} | Respon: ${updateBodyText}`);

    if (updateStatus !== 200) {
      throw new Error(`[ERROR API UPDATE] Server mengembalikan HTTP ${updateStatus}: ${updateBodyText}`);
    }

    await expect(modalPegawai).toBeHidden({ timeout: 15000 });

    logAction.input('Cari Nama Pegawai Terupdate', '#pegawaiSearchInput', namaUpdated);
    await page.fill('#pegawaiSearchInput', namaUpdated);
    logAction.click('Tombol Cari Pegawai', 'button[onclick="loadPegawai()"]');
    await page.click('button[onclick="loadPegawai()"]');

    const updatedRow = page.locator('#pegawaiTableBody tr', { hasText: namaUpdated });
    await expect(updatedRow).toBeVisible({ timeout: 15000 });
    await expect(updatedRow).toContainText('Analis Sistem Informasi');
    logAction.success('Perubahan data pegawai berhasil disimpan.');

    // ----------------------------------------------------
    // 4. DELETE: Hapus Data Pegawai
    // ----------------------------------------------------
    logAction.menu('Hapus Data Pegawai');
    logAction.click('Tombol Hapus Pegawai', 'button[title="Hapus Pegawai"]');
    await updatedRow.locator('button[title="Hapus Pegawai"]').click();

    logAction.verify('Menunggu konfirmasi dialog SweetAlert2 ("Anda Yakin?")...');
    const confirmModal = page.locator('.swal2-popup');
    await expect(confirmModal).toBeVisible({ timeout: 10000 });
    await expect(confirmModal).toContainText('Anda Yakin?');
    logAction.click('Konfirmasi "Ya, Hapus!"', '.swal2-confirm');
    await page.click('.swal2-confirm');

    logAction.verify('Menunggu notifikasi berhasil terhapus...');
    await expect(confirmModal).toContainText('Terhapus', { timeout: 15000 });
    logAction.click('Tutup Alert Terhapus', '.swal2-confirm');
    await page.click('.swal2-confirm');

    logAction.input('Cari Pegawai Terhapus', '#pegawaiSearchInput', namaUpdated);
    await page.fill('#pegawaiSearchInput', namaUpdated);
    logAction.click('Tombol Cari Pegawai', 'button[onclick="loadPegawai()"]');
    await page.click('button[onclick="loadPegawai()"]');
    await expect(page.locator('#pegawaiTableBody tr', { hasText: namaUpdated })).toBeHidden({ timeout: 5000 });
    logAction.success('Data pegawai berhasil dihapus dari sistem.');
  });

});
