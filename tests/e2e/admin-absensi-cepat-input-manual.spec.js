const { test, expect } = require('@playwright/test');
const { attachLogger, logAction } = require('./test-logger');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const BASE_URL = (process.env.BASE_URL || 'https://bais-pariaman.pariamankota.go.id').replace(/\/+$/, '');

test.describe('E2E Absensi Cepat / Input Manual Admin', () => {

  test('Siklus Absensi Cepat: Admin Buat Jadwal -> Input Presensi Manual Pegawai -> Verifikasi Rekap & Log Audit', async ({ page }) => {
    attachLogger(page, 'E2E Absensi Cepat Admin');
    test.skip(!ADMIN_USER || !ADMIN_PASS, 'Set ADMIN_USER dan ADMIN_PASS di environment variables.');
    test.setTimeout(120000); // 2 menit timeout

    const timestamp = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];

    // =========================================================================
    // LANGKAH 1: ADMIN LOGIN & BUAT JADWAL BARU
    // =========================================================================
    logAction.navigate(`${BASE_URL}/admin/index.html`);
    await page.goto(`${BASE_URL}/admin/index.html`);
    await page.waitForLoadState('networkidle');

    if (await page.locator('#adminUser').isVisible()) {
      await page.fill('#adminUser', ADMIN_USER);
      await page.fill('#adminPass', ADMIN_PASS);
      await page.click('#btnLogin');
      await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
    }
    logAction.success('Login Admin Berhasil');

    logAction.step('Admin membuat Jadwal Uji Absensi Cepat');
    await page.click('button[onclick="bukaModalBuatKegiatan()"]');
    await expect(page.locator('#modalBuatKegiatan')).toBeVisible({ timeout: 10000 });

    const judulKegiatan = `UJI ABSENSI CEPAT ADMIN ${timestamp}`;
    await page.fill('#newJudul', judulKegiatan);
    await page.evaluate((tgl) => document.getElementById('newTanggal')._flatpickr.setDate(tgl, true), todayStr);
    await page.fill('#newJamMulai', '00:00');
    await page.fill('#newJamSelesai', '23:59');

    // Pilih OPD
    await page.fill('#searchAvailableOpd', 'BADAN');
    await page.evaluate(() => {
      if (typeof opdState !== 'undefined') {
        opdState['add'].available.filter(opd => opd.toUpperCase().includes('BADAN')).forEach(opd => moveOpd(opd, 'add', 'select'));
        renderOpdSelector('add');
      }
    });

    const [respCreate] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.request().method() === 'POST'),
      page.click('#btnSimpanKegiatan')
    ]);
    const jsonCreate = await respCreate.json();
    const kodeAkses = jsonCreate.data.kode_akses;
    expect(kodeAkses).not.toBeNull();
    await expect(page.locator('#modalBuatKegiatan')).toBeHidden({ timeout: 10000 });
    logAction.success(`Jadwal Uji Cepat Berhasil Dibuat. Kode Akses: ${kodeAkses}`);

    // =========================================================================
    // LANGKAH 2: BUAK REKAP KEGIATAN & BUKA MODAL ABSENSI CEPAT / INPUT MANUAL
    // =========================================================================
    logAction.step(`Membuka Rekap Kegiatan untuk Kode: ${kodeAkses}`);
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes(`/admin/rekap/${kodeAkses}`) && resp.status() === 200),
      page.evaluate((kode) => {
        if (typeof lihatRekap === 'function') lihatRekap(kode);
      }, kodeAkses)
    ]);
    await expect(page.locator('#rekapContainer')).toBeVisible({ timeout: 15000 });

    logAction.step('Membuka Modal Tambah Peserta / Input Manual Presensi (Absensi Cepat Admin)');
    await page.click('button[onclick="bukaModalTambahPeserta()"]');
    const modalTambah = page.locator('#modalTambahPeserta');
    await expect(modalTambah).toBeVisible({ timeout: 10000 });

    // =========================================================================
    // LANGKAH 3: CARI PEGAWAI & PILIH STATUS ABSENSI CEPAT
    // =========================================================================
    logAction.input('Cari Pegawai NIP', '#tambahPesertaSearch', ADMIN_USER);
    await page.fill('#tambahPesertaSearch', ADMIN_USER);

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes(`/admin/rekap/eligible-pegawai/${kodeAkses}`) && resp.status() === 200),
      page.evaluate(() => {
        if (typeof cariEligiblePegawai === 'function') cariEligiblePegawai();
      })
    ]);

    await page.waitForTimeout(1000);

    // Pindahkan pegawai dari Available ke Selected
    logAction.step(`Memilih Pegawai NIP: ${ADMIN_USER}`);
    await page.evaluate((nip) => {
      if (typeof movePegawai === 'function') movePegawai(nip, 'select');
    }, ADMIN_USER);

    // Set Status Kehadiran = 'Hadir', Status Verifikasi = 'Terverifikasi Oleh Admin'
    logAction.select('Status Kehadiran', '#bulkStatusKehadiran', 'Hadir');
    await page.selectOption('#bulkStatusKehadiran', 'Hadir');
    await page.selectOption('#bulkStatusVerifikasi', 'Terverifikasi Oleh Admin');
    await page.fill('#bulkKeterangan', `Absensi Cepat Admin E2E ${timestamp}`);

    // =========================================================================
    // LANGKAH 4: SIMPAN ABSENSI CEPAT ADMIN
    // =========================================================================
    logAction.step('Menyimpan Absensi Cepat Admin...');
    const [respBulk] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes(`/admin/rekap/entry/bulk/${kodeAkses}`) && resp.status() === 200),
      page.click('#btnSimpanTambahPeserta')
    ]);
    const jsonBulk = await respBulk.json();
    expect(jsonBulk.status).toBe(true);
    logAction.success(`Absensi Cepat Admin Sukses! Pesan: ${jsonBulk.message}`);

    // Tutup SweetAlert sukses
    await page.click('.swal2-confirm').catch(() => {});
    await expect(modalTambah).toBeHidden({ timeout: 10000 });

    // =========================================================================
    // LANGKAH 5: VERIFIKASI PRESENSI TERAMPIL DI TABEL REKAP
    // =========================================================================
    logAction.step('Memverifikasi Tampilan Rekap Pegawai...');
    await page.fill('#rekapSearchInput', ADMIN_USER);
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes(`/admin/rekap/details/${kodeAkses}`) && resp.status() === 200),
      page.click('button[onclick="terapkanFilterRekap()"]')
    ]);

    await page.waitForFunction(() => {
      const tbody = document.getElementById('rekapTableBody');
      return tbody && tbody.querySelector('tr') && !tbody.innerHTML.includes('spinner') && !tbody.innerHTML.includes('Memuat data');
    }, { timeout: 15000 });

    const rekapText = await page.locator('#rekapTableBody tr').first().innerText();
    console.log(`\n  📋 [BARIS REKAP ABSENSI CEPAT]:\n  ${rekapText.replace(/\s+/g, ' ')}`);
    expect(rekapText).toContain(ADMIN_USER);
    logAction.success('Data Absensi Cepat Admin tampil valid di Rekap!');

    // =========================================================================
    // LANGKAH 6: VERIFIKASI LOG ABSENSI AUDIT
    // =========================================================================
    logAction.step('Membuka Log Absensi Audit untuk Verifikasi...');
    await page.evaluate(() => {
      if (typeof bukaHalamanLogAbsensi === 'function') bukaHalamanLogAbsensi();
    });
    await expect(page.locator('#logAbsensiContainer')).toBeVisible({ timeout: 15000 });

    await page.fill('#logFilterKegiatan', kodeAkses);
    await page.fill('#logFilterPegawai', ADMIN_USER);

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/admin/log-absensi') && resp.status() === 200),
      page.click('button[onclick="terapkanFilterLogAbsensi()"]')
    ]);

    await page.waitForFunction(() => {
      const tbody = document.getElementById('logAbsensiTableBody');
      return tbody && tbody.querySelector('tr') && !tbody.innerHTML.includes('spinner') && !tbody.innerHTML.includes('Memuat data');
    }, { timeout: 15000 });

    const logText = await page.locator('#logAbsensiTableBody tr').first().innerText();
    console.log(`\n  📜 [LOG ABSENSI CEPAT AUDIT]:\n  ${logText.replace(/\s+/g, ' ')}`);
    expect(logText).toContain(ADMIN_USER);
    logAction.success('PENGUJIAN E2E ABSENSI CEPAT ADMIN 100% SUKSES & TERCATAT AUDIT!');
  });
});
