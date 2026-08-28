const { test, expect } = require('@playwright/test');
const { attachLogger, logAction } = require('./test-logger');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const BASE_URL = (process.env.BASE_URL || 'https://bais-pariaman.pariamankota.go.id').replace(/\/+$/, '');

test.describe('E2E Strict Time: Pengujian Aturan Waktu Ketat (is_strict_time)', () => {

  test('Aturan Ketat Waktu: Hadir Ditolak (Terlambat) & Tidak Hadir Diizinkan', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -0.6264, longitude: 100.1186 });
    attachLogger(page, 'E2E Strict Time');
    test.skip(!ADMIN_USER || !ADMIN_PASS, 'Set ADMIN_USER dan ADMIN_PASS di environment variables.');
    test.setTimeout(180000);

    const timestamp = Date.now();
    const judulKegiatan = `UJI STRICT TIME ${timestamp}`;
    let kodeAkses = null;
    const todayStr = new Date().toISOString().split('T')[0];

    // =========================================================================
    // 1. ADMIN: LOGIN & BUAT JADWAL DENGAN STRICT TIME (WAKTU SUDAH LEWAT)
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
    logAction.success('Login Admin OK');

    await page.click('button[onclick="bukaModalBuatKegiatan()"]');
    await expect(page.locator('#modalBuatKegiatan')).toBeVisible({ timeout: 10000 });

    await page.fill('#newJudul', judulKegiatan);
    await page.evaluate((tgl) => document.getElementById('newTanggal')._flatpickr.setDate(tgl, true), todayStr);
    
    // Set jam selesai yang sudah lewat (00:00 - 00:01) agar terdeteksi terlambat
    await page.fill('#newJamMulai', '00:00');
    await page.fill('#newJamSelesai', '00:01');
    await page.click('#btnLokasiAdd');
    await page.fill('#geoRadius', '500');

    // AKTIFKAN ATURAN KETAT WAKTU (Strict Time)
    logAction.check('Aktifkan Strict Time', '#addStrictTime');
    await page.locator('#addStrictTime').check();

    // Pilih OPD dengan kata kunci "BADAN"
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
    kodeAkses = jsonCreate.data.kode_akses;
    expect(kodeAkses).not.toBeNull();
    await expect(page.locator('#modalBuatKegiatan')).toBeHidden({ timeout: 10000 });
    logAction.success(`Jadwal Strict Time berhasil dibuat. Kode: ${kodeAkses}`);

    // LOGOUT ADMIN MELALUI UI
    const navbarToggler = page.locator('.navbar-toggler');
    if (await navbarToggler.isVisible().catch(() => false)) {
      await navbarToggler.click();
      await page.waitForTimeout(500);
    }
    const logoutButton = page.locator('button[onclick="logout()"]');
    await expect(logoutButton).toBeVisible({ timeout: 10000 });
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      logoutButton.click()
    ]);
    await expect(page.locator('#loginOverlay')).toBeVisible({ timeout: 15000 });
    logAction.success('Logout Admin OK');

    // =========================================================================
    // 2. PWA: LOGIN PEGAWAI
    // =========================================================================
    logAction.navigate(`${BASE_URL}/pwa/index.html`);
    await page.goto(`${BASE_URL}/pwa/index.html`);
    await page.waitForLoadState('networkidle');
    if (await page.locator('#view-desktop-denied').isVisible().catch(() => false)) {
      await page.evaluate(() => document.getElementById('view-desktop-denied').classList.add('hidden-view'));
    }
    await expect(page.locator('#view-login')).toBeVisible({ timeout: 15000 });
    await page.fill('#logNip', ADMIN_USER);
    await page.fill('#logNik', ADMIN_PASS);
    await page.click('#view-login button[type="submit"]');
    await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 15000 });
    logAction.success('Login PWA Pegawai OK');

    // =========================================================================
    // 3. PENGUJIAN HADIR (DITOLAK KARENA STRICT TIME AKTIF & WAKTU HABIS)
    // =========================================================================
    logAction.click('Buka Input Kode Akses', 'button:has-text("AMBIL ABSENSI KEGIATAN")');
    await page.click('button:has-text("AMBIL ABSENSI KEGIATAN")');
    await expect(page.locator('#view-pilih-metode')).toBeVisible({ timeout: 10000 });

    await page.fill('#inputKodeManual', kodeAkses);
    await page.click('#view-pilih-metode button[type="submit"]');
    await expect(page.locator('#view-form')).toBeVisible({ timeout: 15000 });

    // Pilih OPSI HADIR saat Strict Time aktif dan waktu habis
    logAction.check('Pilih Opsi Hadir (Strict Time)', 'input[name="tipeKehadiran"][value="hadir"]');
    await page.click('input[name="tipeKehadiran"][value="hadir"]');
    await page.evaluate(() => {
      if (typeof pilihOpsiKehadiran === 'function') pilihOpsiKehadiran('hadir');
    });

    // Harusnya muncul SweetAlert error 'Waktu Berakhir' / 'Aturan Waktu Berlaku aktif'
    const swalStrictTime = page.locator('.swal2-popup:has-text("Waktu Berakhir"), .swal2-popup:has-text("Aturan Waktu Berlaku")');
    await expect(swalStrictTime).toBeVisible({ timeout: 8000 });
    logAction.success('SweetAlert "Waktu Berakhir" berhasil muncul memblokir absensi Hadir!');
    
    // Tutup SweetAlert error
    await page.locator('.swal2-confirm').click();
    await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 15000 });
    logAction.success('PWA otomatis membatalkan form dan kembali ke dashboard setelah penolakan.');

    // =========================================================================
    // 4. PENGUJIAN TIDAK HADIR (DIIZINKAN & SUBMIT BERHASIL)
    // =========================================================================
    logAction.click('Buka Input Kode Akses Ulang', 'button:has-text("AMBIL ABSENSI KEGIATAN")');
    await page.click('button:has-text("AMBIL ABSENSI KEGIATAN")');
    await expect(page.locator('#view-pilih-metode')).toBeVisible({ timeout: 10000 });

    await page.fill('#inputKodeManual', kodeAkses);
    await page.click('#view-pilih-metode button[type="submit"]');
    await expect(page.locator('#view-form')).toBeVisible({ timeout: 15000 });

    // Pilih OPSI TIDAK HADIR
    logAction.check('Pilih Opsi TIDAK HADIR', 'input[name="tipeKehadiran"][value="izin"]');
    await page.click('input[name="tipeKehadiran"][value="izin"]');
    await page.evaluate(() => {
      if (typeof pilihOpsiKehadiran === 'function') pilihOpsiKehadiran('izin');
    });

    await page.selectOption('#alasanIzin', 'Dinas Luar Daerah');
    await page.fill('#keteranganIzin', `Uji Strict Time Tidak Hadir ${timestamp}`);

    // Upload Bukti Dukung PNG
    const mockPngBuffer = Buffer.from('iVBORw0KGgoAAAANSU5EUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.locator('#buktiIzin').setInputFiles({ name: 'bukti-strict.png', mimeType: 'image/png', buffer: mockPngBuffer });
    await page.evaluate(() => { if (typeof handleProofFileChange === 'function') handleProofFileChange('buktiIzin', checkIzinForm); });
    await expect(page.locator('#btnKirim')).toBeEnabled();

    // Kirim Absen Tidak Hadir
    logAction.click('Kirim Absensi Tidak Hadir', '#btnKirim');
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/absen/submit') && resp.status() === 200),
      page.click('#btnKirim')
    ]);
    await page.locator('.swal2-confirm').click({ timeout: 10000 });

    // Verifikasi di Riwayat Lokal
    const listRiwayat = page.locator('#listRiwayatLokal');
    await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 15000 });
    await expect(listRiwayat).toBeVisible({ timeout: 10000 });
    await expect(listRiwayat).toContainText(judulKegiatan, { timeout: 15000 });
    logAction.success('Data Tidak Hadir tersimpan di Riwayat Lokal PWA.');

    // =========================================================================
    // 5. ADMIN: LOGIN LAGI & VERIFIKASI REKAP KEGIATAN
    // =========================================================================
    await page.goto(`${BASE_URL}/admin/index.html`);
    await page.waitForLoadState('networkidle');
    if (await page.locator('#adminUser').isVisible().catch(() => false)) {
      await page.fill('#adminUser', ADMIN_USER);
      await page.fill('#adminPass', ADMIN_PASS);
      await page.click('#btnLogin');
      await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);
    }

    // Buka rekap kegiatan langsung
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes(`/admin/rekap/${kodeAkses}`) && resp.status() === 200),
      page.evaluate((kode) => {
        if (typeof lihatRekap === 'function') lihatRekap(kode);
      }, kodeAkses)
    ]);
    await expect(page.locator('#rekapContainer')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Filter rekap berdasarkan NIP
    await page.fill('#rekapSearchInput', ADMIN_USER);
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes(`/admin/rekap/details/${kodeAkses}`) && resp.status() === 200),
      page.click('button[onclick="terapkanFilterRekap()"]')
    ]);

    await page.waitForFunction(() => {
      const tbody = document.getElementById('rekapTableBody');
      return tbody && tbody.querySelector('tr') && !tbody.innerHTML.includes('spinner') && !tbody.innerHTML.includes('Memuat data');
    }, { timeout: 15000 });

    const rows = page.locator('#rekapTableBody tr');
    let foundRekap = false;
    for (let i = 0; i < await rows.count(); i++) {
      const rowTxt = await rows.nth(i).innerText();
      if (rowTxt.includes(ADMIN_USER) && (rowTxt.includes('Dinas Luar Daerah') || rowTxt.includes('Menunggu Verifikasi'))) {
        foundRekap = true;
        console.log(` 📋 DITEMUKAN DI REKAP: ${rowTxt.replace(/\s+/g, ' ')}`);
        break;
      }
    }
    expect(foundRekap).toBe(true);
    logAction.success('PENGUJIAN STRICT TIME SELESAI 100% SUKSES!');
  });
});
