const { test, expect } = require('@playwright/test');
const { attachLogger, logAction } = require('./test-logger');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

test.describe('Admin Rekap Kehadiran - Fitur Verifikasi Manual & Hapus Data (5 Data Teratas)', () => {

  test.beforeEach(async ({ page }) => {
    attachLogger(page, 'Rekap Verifikasi');

    test.skip(!ADMIN_USER || !ADMIN_PASS,
      'Set ADMIN_USER dan ADMIN_PASS di environment variable untuk menjalankan pengujian Verifikasi Manual.');

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
      ]).catch(() => { });

      const swalPopup = page.locator('.swal2-popup');
      if (await swalPopup.isVisible().catch(() => false)) {
        const text = await swalPopup.innerText();
        throw new Error(`Login Admin Gagal dari Server: ${text.replace(/\n/g, ' ')}`);
      }

      await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
      logAction.success('Berhasil login dan masuk ke Dashboard Admin');
    }

    logAction.menu('Rekap Kehadiran (bukaHalamanRekapKeseluruhan)');
    await page.evaluate(() => bukaHalamanRekapKeseluruhan());
    await expect(page.locator('#rekapKeseluruhanContainer')).toBeVisible({ timeout: 10000 });
  });

  test('Uji coba Verifikasi Manual & Hapus Data pada 5 Data Teratas (Rentang Juli 2026)', async ({ page }) => {
    logAction.verify('Menunggu instance Flatpickr siap di DOM...');
    await page.waitForFunction(() => {
      const el = document.getElementById('rekapKeseluruhanStartDate');
      return el && el._flatpickr;
    }, { timeout: 10000 });

    logAction.input('Tanggal Mulai', '#rekapKeseluruhanStartDate', '2026-07-01');
    logAction.input('Tanggal Selesai', '#rekapKeseluruhanEndDate', '2026-07-31');
    await page.evaluate(() => {
      const startEl = document.getElementById('rekapKeseluruhanStartDate');
      const endEl = document.getElementById('rekapKeseluruhanEndDate');
      if (startEl && startEl._flatpickr) startEl._flatpickr.setDate('2026-07-01', true);
      if (endEl && endEl._flatpickr) endEl._flatpickr.setDate('2026-07-31', true);
    });

    logAction.click('Tombol Tampilkan Data', 'button[onclick="terapkanFilterRekapKeseluruhan()"]');
    await page.click('button[onclick="terapkanFilterRekapKeseluruhan()"]');

    logAction.verify('Menunggu respon data tabel rekap kehadiran dari server...');
    await page.waitForFunction(() => {
      const tbody = document.getElementById('rekapKeseluruhanTableBody');
      if (!tbody) return false;
      const html = tbody.innerHTML;
      return html.includes('bukaModalVerifikasiKeseluruhan') ||
        html.includes('Tidak ada data') ||
        html.includes('Gagal memuat') ||
        (!html.includes('spinner-border') && !html.includes('Memuat data'));
    }, { timeout: 25000 });

    const hasData = await page.evaluate(() => {
      return document.querySelector('#rekapKeseluruhanTableBody button[onclick*="bukaModalVerifikasiKeseluruhan"]') !== null;
    });

    if (!hasData) {
      logAction.verify('Tidak ada data absensi untuk rentang 1-30 Juli 2026.');
      test.skip(true, 'Tidak ada data rekap kehadiran pada bulan Juli 2026 untuk diuji.');
    }

    const availableRows = await page.locator('#rekapKeseluruhanTableBody tr button[onclick*="bukaModalVerifikasiKeseluruhan"]').count();
    const countToTest = Math.min(availableRows, 5);
    logAction.verify(`Ditemukan ${availableRows} baris absensi. Menjalankan pengujian untuk ${countToTest} data teratas...`);

    for (let i = 1; i <= countToTest; i++) {
      console.log(`\n----------------------------------------------------------------------`);
      console.log(`🚀 [ITERASI ${i}/${countToTest}] Memulai Siklus Verifikasi & Hapus Baris ke-${i}`);
      console.log(`----------------------------------------------------------------------`);

      // 1. Reset filter pencarian
      logAction.input('Reset Pencarian NIP/Nama', '#rekapKeseluruhanSearchInput', '');
      await page.fill('#rekapKeseluruhanSearchInput', '');
      logAction.select('Filter Status Kehadiran', '#rekapKeseluruhanFilterStatus', 'semua');
      await page.selectOption('#rekapKeseluruhanFilterStatus', 'semua');
      logAction.select('Filter Status Verifikasi', '#rekapKeseluruhanFilterVerifikasi', 'semua');
      await page.selectOption('#rekapKeseluruhanFilterVerifikasi', 'semua');
      logAction.click('Tampilkan Semua Data', 'button[onclick="terapkanFilterRekapKeseluruhan()"]');
      await page.click('button[onclick="terapkanFilterRekapKeseluruhan()"]');

      logAction.verify('Menunggu baris teratas muncul di tabel...');
      await page.waitForFunction(() => {
        const editBtn = document.querySelector('#rekapKeseluruhanTableBody tr button[onclick*="bukaModalVerifikasiKeseluruhan"]');
        return editBtn !== null && editBtn.offsetParent !== null;
      }, { timeout: 15000 });

      const editBtn = page.locator('#rekapKeseluruhanTableBody tr button[onclick*="bukaModalVerifikasiKeseluruhan"]').first();
      const row = page.locator('#rekapKeseluruhanTableBody tr').first();
      const rowInfo = (await row.innerText()).replace(/\n/g, ' | ');
      console.log(`  📋 [DATA SAAT INI] ${rowInfo}`);

      logAction.click('Tombol Edit Status (Pensil)', 'button[onclick*="bukaModalVerifikasiKeseluruhan"]');
      await editBtn.click();

      const modalVerif = page.locator('#modalVerifikasi');
      await expect(modalVerif).toBeVisible({ timeout: 10000 });
      logAction.success('Modal "Verifikasi Manual Admin" berhasil terbuka');

      const nipTarget = await page.inputValue('#verifNip');
      const namaTarget = await page.inputValue('#verifNama');
      console.log(`  👤 [TARGET PEGAWAI] Nama: "${namaTarget}", NIP: "${nipTarget}"`);

      const newStatusKehadiran = (i % 2 === 0) ? 'Sakit' : 'Hadir';
      const newStatusVerifikasi = 'Terverifikasi Oleh Admin';
      const catatanAdmin = `Verifikasi Test E2E Iterasi ${i} - ${Date.now()}`;

      logAction.select('Status Kehadiran Baru', '#verifStatusKehadiran', newStatusKehadiran);
      await page.selectOption('#verifStatusKehadiran', newStatusKehadiran);

      logAction.select('Tindakan Verifikasi', '#verifStatus', newStatusVerifikasi);
      await page.selectOption('#verifStatus', newStatusVerifikasi);

      logAction.input('Catatan / Keterangan Admin', '#verifKeterangan', catatanAdmin);
      await page.fill('#verifKeterangan', catatanAdmin);

      logAction.click('Simpan Status Verifikasi', '#btnSimpanVerif');
      await page.click('#btnSimpanVerif');

      logAction.verify('Menunggu modal verifikasi tertutup...');
      await expect(modalVerif).toBeHidden({ timeout: 15000 });
      logAction.success('Perubahan status berhasil disimpan');

      // 2. Cari lagi data menggunakan filter spesifik
      logAction.menu('Pencarian dengan Filter Hasil Perubahan');
      logAction.input('Cari NIP Pegawai', '#rekapKeseluruhanSearchInput', nipTarget);
      await page.fill('#rekapKeseluruhanSearchInput', nipTarget);
      logAction.select('Filter Status Kehadiran', '#rekapKeseluruhanFilterStatus', newStatusKehadiran);
      await page.selectOption('#rekapKeseluruhanFilterStatus', newStatusKehadiran);
      logAction.select('Filter Status Verifikasi', '#rekapKeseluruhanFilterVerifikasi', newStatusVerifikasi);
      await page.selectOption('#rekapKeseluruhanFilterVerifikasi', newStatusVerifikasi);
      logAction.click('Terapkan Filter Pencarian', 'button[onclick="terapkanFilterRekapKeseluruhan()"]');
      await page.click('button[onclick="terapkanFilterRekapKeseluruhan()"]');

      logAction.verify(`Memastikan data dengan NIP "${nipTarget}" muncul pada tabel...`);
      await page.waitForFunction((nip) => {
        const deleteBtn = document.querySelector('#rekapKeseluruhanTableBody tr button[onclick*="hapusDataAbsensiKeseluruhan"]');
        const tbody = document.getElementById('rekapKeseluruhanTableBody');
        return deleteBtn !== null && tbody.innerText.includes(nip);
      }, nipTarget, { timeout: 15000 });

      const filteredRow = page.locator('#rekapKeseluruhanTableBody tr', { hasText: nipTarget });
      const deleteBtn = filteredRow.locator('button[onclick*="hapusDataAbsensiKeseluruhan"]').first();
      await expect(deleteBtn).toBeVisible({ timeout: 10000 });
      logAction.success(`Data NIP "${nipTarget}" berhasil ditemukan kembali sesuai filter.`);

      // 3. Hapus data
      logAction.click('Tombol Hapus Absensi (Silang/Trash)', 'button[onclick*="hapusDataAbsensiKeseluruhan"]');
      await deleteBtn.click();

      logAction.verify('Menunggu konfirmasi dialog SweetAlert2 ("Anda Yakin?")...');
      const confirmModal = page.locator('.swal2-popup');
      await expect(confirmModal).toBeVisible({ timeout: 10000 });
      await expect(confirmModal).toContainText('Anda Yakin?');
      logAction.click('Konfirmasi "Ya, Hapus!"', '.swal2-confirm');
      await page.click('.swal2-confirm');

      logAction.verify('Menunggu notifikasi "Terhapus!"...');
      await expect(confirmModal).toContainText('Terhapus', { timeout: 15000 });
      logAction.click('Tutup Alert Berhasil Hapus', '.swal2-confirm');
      await page.click('.swal2-confirm');

      logAction.click('Refresh Data', 'button[onclick="terapkanFilterRekapKeseluruhan()"]');
      await page.click('button[onclick="terapkanFilterRekapKeseluruhan()"]');

      logAction.verify(`Memastikan NIP "${nipTarget}" telah hilang dari tabel...`);
      await expect(page.locator('#rekapKeseluruhanTableBody tr', { hasText: nipTarget })).toBeHidden({ timeout: 5000 });
      logAction.success(`[ITERASI ${i} SELESAI] Data NIP "${nipTarget}" berhasil diverifikasi dan dihapus.`);
    }

    logAction.success(`PENGUJIAN VERIFIKASI & HAPUS ${countToTest} DATA SELESAI DENGAN SUKSES!`);
  });

});
