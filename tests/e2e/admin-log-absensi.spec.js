const { test, expect } = require('@playwright/test');
const { attachLogger, logAction } = require('./test-logger');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

test.describe('Admin Log Absensi Audit Flow (Uji 5 Kode Akses Kegiatan)', () => {

  test.beforeEach(async ({ page }) => {
    attachLogger(page, 'Log Absensi');

    test.skip(!ADMIN_USER || !ADMIN_PASS, 
      'Set ADMIN_USER dan ADMIN_PASS di environment variable untuk menjalankan pengujian Log Absensi.');

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
      logAction.success('Berhasil masuk ke Dashboard Admin.');
    }
  });

  test('1. Validasi error jika Kode Akses Kegiatan kosong', async ({ page }) => {
    logAction.menu('Halaman Log Absensi (bukaHalamanLogAbsensi)');
    await page.evaluate(() => bukaHalamanLogAbsensi());
    await expect(page.locator('#logAbsensiContainer')).toBeVisible({ timeout: 10000 });

    logAction.input('Kode Akses Kegiatan (Dikosongkan)', '#logFilterKegiatan', '');
    await page.fill('#logFilterKegiatan', '');

    logAction.click('Tombol Cari Log', 'button[onclick="terapkanFilterLogAbsensi()"]');
    await page.click('button[onclick="terapkanFilterLogAbsensi()"]');

    logAction.verify('Memeriksa munculnya dialog peringatan SweetAlert2...');
    const swalModal = page.locator('.swal2-popup');
    await expect(swalModal).toBeVisible({ timeout: 10000 });
    await expect(swalModal).toContainText('Silakan masukkan kode akses kegiatan terlebih dahulu');
    logAction.click('Tutup Alert Warning', '.swal2-confirm');
    await page.click('.swal2-confirm');
    logAction.success('Peringatan kode akses kosong berhasil divalidasi.');
  });

  test('2. Salin 5 Kode Akses dari Tabel Kegiatan dan Uji Log Absensi Masing-masing', async ({ page }) => {
    logAction.menu('Halaman Daftar Kegiatan');
    await page.evaluate(() => {
      kembaliKeDaftar();
      if (typeof loadJadwalKegiatan === 'function') {
        loadJadwalKegiatan();
      }
    });
    await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#listKegiatanBody tr').first()).toBeVisible({ timeout: 15000 });

    logAction.verify('Mengekstrak hingga 5 kode akses kegiatan...');
    const kodeAksesList = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('#listKegiatanBody button[onclick*="lihatRekap"]'));
      return buttons.map(btn => {
        const match = btn.getAttribute('onclick').match(/lihatRekap\(['"]([^'"]+)['"]\)/);
        return match ? match[1] : null;
      }).filter(Boolean).slice(0, 5);
    });

    console.log(`  📌 [DATA KODE AKSES] Ditemukan ${kodeAksesList.length} kode akses:`, kodeAksesList);
    test.skip(kodeAksesList.length === 0, 'Tidak ada data kegiatan di tabel untuk diambil kode aksesnya.');

    logAction.menu('Halaman Log Absensi');
    await page.evaluate(() => bukaHalamanLogAbsensi());
    await expect(page.locator('#logAbsensiContainer')).toBeVisible({ timeout: 10000 });

    for (let i = 0; i < kodeAksesList.length; i++) {
      const kodeAkses = kodeAksesList[i];
      console.log(`\n  --- [UJI KODE AKSES ${i + 1}/${kodeAksesList.length}] Kode: ${kodeAkses} ---`);

      logAction.input('Kode Akses Kegiatan', '#logFilterKegiatan', kodeAkses);
      await page.fill('#logFilterKegiatan', kodeAkses);
      logAction.click('Tombol Cari Log', 'button[onclick="terapkanFilterLogAbsensi()"]');
      await page.click('button[onclick="terapkanFilterLogAbsensi()"]');

      logAction.verify('Memverifikasi detail box kegiatan dan tabel log audit...');
      const detailBox = page.locator('#logKegiatanDetailBox');
      await expect(detailBox).toBeVisible({ timeout: 15000 });
      await expect(page.locator('#logDetailKodeAkses')).toContainText(kodeAkses);

      const tbody = page.locator('#logAbsensiTableBody');
      await expect(tbody).toBeVisible({ timeout: 10000 });
      await expect(tbody).not.toContainText('Silakan masukkan kode akses kegiatan');
      logAction.success(`Log audit untuk kode akses "${kodeAkses}" berhasil dimuat.`);
    }
  });

  test('3. Uji Filter Tambahan Jenis Aksi (Edit, Tambah, Hapus) pada Log Absensi', async ({ page }) => {
    logAction.menu('Halaman Daftar Kegiatan');
    await page.evaluate(() => {
      kembaliKeDaftar();
      if (typeof loadJadwalKegiatan === 'function') {
        loadJadwalKegiatan();
      }
    });
    await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#listKegiatanBody tr').first()).toBeVisible({ timeout: 15000 });

    const sampleKodeAkses = await page.evaluate(() => {
      const btn = document.querySelector('#listKegiatanBody button[onclick*="lihatRekap"]');
      if (!btn) return 'DEMO123';
      const match = btn.getAttribute('onclick').match(/lihatRekap\(['"]([^'"]+)['"]\)/);
      return match ? match[1] : 'DEMO123';
    });

    logAction.menu('Halaman Log Absensi');
    await page.evaluate(() => bukaHalamanLogAbsensi());
    await expect(page.locator('#logAbsensiContainer')).toBeVisible({ timeout: 10000 });

    logAction.input('Kode Akses Sampel', '#logFilterKegiatan', sampleKodeAkses);
    await page.fill('#logFilterKegiatan', sampleKodeAkses);

    logAction.select('Filter Jenis Aksi', '#logFilterAksi', 'tambah');
    await page.selectOption('#logFilterAksi', 'tambah');
    logAction.click('Cari Filter Aksi Tambah', 'button[onclick="terapkanFilterLogAbsensi()"]');
    await page.click('button[onclick="terapkanFilterLogAbsensi()"]');
    await expect(page.locator('#logAbsensiTableBody')).toBeVisible({ timeout: 15000 });

    logAction.select('Filter Jenis Aksi', '#logFilterAksi', 'edit');
    await page.selectOption('#logFilterAksi', 'edit');
    logAction.click('Cari Filter Aksi Edit', 'button[onclick="terapkanFilterLogAbsensi()"]');
    await page.click('button[onclick="terapkanFilterLogAbsensi()"]');
    await expect(page.locator('#logAbsensiTableBody')).toBeVisible({ timeout: 15000 });

    logAction.select('Filter Jenis Aksi', '#logFilterAksi', 'hapus');
    await page.selectOption('#logFilterAksi', 'hapus');
    logAction.click('Cari Filter Aksi Hapus', 'button[onclick="terapkanFilterLogAbsensi()"]');
    await page.click('button[onclick="terapkanFilterLogAbsensi()"]');
    await expect(page.locator('#logAbsensiTableBody')).toBeVisible({ timeout: 15000 });
    logAction.success('Filter jenis aksi log absensi berhasil diverifikasi.');
  });

});
