const { test, expect } = require('@playwright/test');
const { attachLogger, logAction } = require('./test-logger');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

test.describe('Admin CRUD Kegiatan Flow (Termasuk Lokasi & Geofence)', () => {

  test.beforeEach(async ({ page }) => {
    attachLogger(page, 'CRUD Kegiatan');

    test.skip(!ADMIN_USER || !ADMIN_PASS, 
      'Set ADMIN_USER dan ADMIN_PASS di environment variable untuk menjalankan pengujian CRUD Admin.');

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
      logAction.success('Berhasil login ke Dashboard Admin');
    }
  });

  test('Alur Lengkap CRUD Kegiatan dengan Pengaturan Lokasi & Geofence', async ({ page }) => {
    const timestamp = Date.now();
    const judulKegiatan = `Kegiatan Test E2E ${timestamp}`;
    const judulKegiatanUpdated = `Kegiatan Test E2E ${timestamp} (Updated)`;
    const kodeAkses = `TEST-${timestamp.toString().slice(-6)}`;

    // ----------------------------------------------------
    // 1. CREATE: Tambah Jadwal Kegiatan Baru
    // ----------------------------------------------------
    logAction.menu('Buka Modal Tambah Jadwal Kegiatan');
    logAction.click('Tombol Buat Jadwal Baru', 'button[data-bs-target="#modalBuatKegiatan"]');
    const btnBukaModal = page.locator('button[data-bs-target="#modalBuatKegiatan"]');
    await expect(btnBukaModal).toBeVisible({ timeout: 10000 });
    await btnBukaModal.click();

    const modalBuat = page.locator('#modalBuatKegiatan');
    await expect(modalBuat).toBeVisible({ timeout: 10000 });

    logAction.input('Judul Kegiatan', '#newJudul', judulKegiatan);
    await page.fill('#newJudul', judulKegiatan);
    logAction.input('Kode Akses Kegiatan', '#newKodeAkses', kodeAkses);
    await page.fill('#newKodeAkses', kodeAkses);

    logAction.input('Tanggal Kegiatan', '#newTanggal', '2026-06-15');
    await page.evaluate(() => {
      document.getElementById('newTanggal')._flatpickr.setDate('2026-06-15', true);
    });
    logAction.input('Jam Mulai', '#newJamMulai', '08:00');
    await page.fill('#newJamMulai', '08:00');
    logAction.input('Jam Selesai', '#newJamSelesai', '16:00');
    await page.fill('#newJamSelesai', '16:00');

    logAction.input('Latitude Lokasi', '#newLatitude', '-0.6264');
    await page.fill('#newLatitude', '-0.6264');
    logAction.input('Longitude Lokasi', '#newLongitude', '100.1186');
    await page.fill('#newLongitude', '100.1186');
    logAction.input('Radius Geofence (Meter)', '#newRadius', '150');
    await page.fill('#newRadius', '150');
    logAction.check('Opsi Geofence Ketat', '#newIsKetat');
    await page.check('#newIsKetat');

    logAction.click('Pilih Semua OPD', 'button[onclick="selectAllOpd(\'add\')"]');
    await page.click('button[onclick="selectAllOpd(\'add\')"]');

    logAction.click('Simpan Jadwal Kegiatan', '#btnSimpanKegiatan');
    await page.click('#btnSimpanKegiatan');

    logAction.verify('Menunggu modal tambah kegiatan tertutup...');
    await expect(modalBuat).toBeHidden({ timeout: 15000 });
    logAction.success('Jadwal Kegiatan Baru Berhasil Dibuat.');

    // ----------------------------------------------------
    // 2. READ & SEARCH: Cari Kegiatan yang Baru Dibuat
    // ----------------------------------------------------
    logAction.menu('Pencarian Data Kegiatan');
    logAction.input('Cari Judul Kegiatan', '#searchInput', judulKegiatan);
    await page.fill('#searchInput', judulKegiatan);
    await page.press('#searchInput', 'Enter');

    logAction.verify(`Memastikan baris kegiatan "${judulKegiatan}" muncul di tabel...`);
    const targetRow = page.locator('#listKegiatanBody tr', { hasText: judulKegiatan });
    await expect(targetRow).toBeVisible({ timeout: 10000 });
    logAction.success('Data kegiatan ditemukan pada tabel.');

    // ----------------------------------------------------
    // 3. UPDATE: Edit Jadwal Kegiatan
    // ----------------------------------------------------
    logAction.menu('Edit Jadwal Kegiatan');
    logAction.click('Tombol Edit Jadwal', 'button[onclick*="bukaModalEdit"]');
    await targetRow.locator('button[onclick*="bukaModalEdit"]').click();

    const modalEdit = page.locator('#modalEditKegiatan');
    await expect(modalEdit).toBeVisible({ timeout: 10000 });

    logAction.input('Ubah Judul Kegiatan', '#editJudul', judulKegiatanUpdated);
    await page.fill('#editJudul', judulKegiatanUpdated);
    logAction.input('Ubah Radius Geofence', '#editRadius', '200');
    await page.fill('#editRadius', '200');

    logAction.click('Simpan Perubahan Jadwal', '#btnUpdateKegiatan');
    await page.click('#btnUpdateKegiatan');
    await expect(modalEdit).toBeHidden({ timeout: 15000 });
    logAction.success('Perubahan Data Kegiatan Berhasil Disimpan.');

    logAction.input('Cari Judul Terupdate', '#searchInput', judulKegiatanUpdated);
    await page.fill('#searchInput', judulKegiatanUpdated);
    await page.press('#searchInput', 'Enter');

    const updatedRow = page.locator('#listKegiatanBody tr', { hasText: judulKegiatanUpdated });
    await expect(updatedRow).toBeVisible({ timeout: 10000 });
    logAction.success(`Verifikasi baris terupdate "${judulKegiatanUpdated}" berhasil.`);

    // ----------------------------------------------------
    // 4. DELETE: Hapus Jadwal Kegiatan
    // ----------------------------------------------------
    logAction.menu('Hapus Jadwal Kegiatan');
    logAction.click('Tombol Hapus Jadwal', 'button[onclick*="hapusKegiatan"]');
    await updatedRow.locator('button[onclick*="hapusKegiatan"]').click();

    logAction.verify('Menunggu konfirmasi dialog SweetAlert2 ("Anda Yakin?")...');
    const confirmModal = page.locator('.swal2-popup');
    await expect(confirmModal).toBeVisible({ timeout: 10000 });
    await expect(confirmModal).toContainText('Anda Yakin?');
    logAction.click('Konfirmasi "Ya, Hapus!"', '.swal2-confirm');
    await page.click('.swal2-confirm');

    logAction.verify('Menunggu notifikasi "Terhapus!"...');
    await expect(confirmModal).toContainText('Terhapus', { timeout: 15000 });
    logAction.click('Tutup Alert Berhasil', '.swal2-confirm');
    await page.click('.swal2-confirm');

    logAction.input('Cari Jadwal Terhapus', '#searchInput', judulKegiatanUpdated);
    await page.fill('#searchInput', judulKegiatanUpdated);
    await page.press('#searchInput', 'Enter');
    await expect(page.locator('#listKegiatanBody tr', { hasText: judulKegiatanUpdated })).toBeHidden({ timeout: 5000 });
    logAction.success('Hapus Jadwal Kegiatan Berhasil Dikonfirmasi.');
  });

});
