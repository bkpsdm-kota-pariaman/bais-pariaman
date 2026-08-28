const { test, expect } = require('@playwright/test');
const { attachLogger, logAction } = require('./test-logger');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const BASE_URL = (process.env.BASE_URL || 'https://bais-pariaman.pariamankota.go.id').replace(/\/+$/, '');

test.describe('Full-Cycle E2E BAIS PWA v3', () => {

  test('Siklus Lengkap Tidak Hadir + Negative Test', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -0.6264, longitude: 100.1186 });
    attachLogger(page, 'BAIS Full-Cycle v3');
    test.skip(!ADMIN_USER || !ADMIN_PASS, 'Set ADMIN_USER dan ADMIN_PASS');
    test.setTimeout(180000);

    const timestamp = Date.now();
    const judulKegiatan = `UJI SIKLUS TIDAK HADIR ${timestamp}`;
    let kodeAkses = null;
    const todayStr = new Date().toISOString().split('T')[0];

    // =========================================================================
    // 1. ADMIN: LOGIN & BUAT JADWAL
    // =========================================================================
    await page.goto(`${BASE_URL}/admin/index.html`);
    await page.waitForLoadState('networkidle');

    if (await page.locator('#adminUser').isVisible()) {
      await page.fill('#adminUser', ADMIN_USER);
      await page.fill('#adminPass', ADMIN_PASS);
      await page.click('#btnLogin');
      await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
    }
    logAction.success('Login Admin OK'); // FIX: step -> success

    await page.click('button[onclick="bukaModalBuatKegiatan()"]');
    await expect(page.locator('#modalBuatKegiatan')).toBeVisible();

    await page.fill('#newJudul', judulKegiatan);
    await page.evaluate((tgl) => document.getElementById('newTanggal')._flatpickr.setDate(tgl, true), todayStr);
    await page.fill('#newJamMulai', '00:00');
    await page.fill('#newJamSelesai', '23:59');
    await page.click('#btnLokasiAdd');
    await page.fill('#geoRadius', '500');

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
    kodeAkses = jsonCreate.data.kode_akses; // AMBIL DARI API LANGSUNG
    expect(kodeAkses).not.toBeNull();
    await expect(page.locator('#modalBuatKegiatan')).toBeHidden();
    logAction.success(`Jadwal dibuat. Kode: ${kodeAkses}`);
    // Logout admin melalui UI asli: expand navbar jika mobile/collapsed, klik tombol Keluar, terima confirm, tunggu reload
    const navbarToggler = page.locator('.navbar-toggler');
    if (await navbarToggler.isVisible().catch(() => false)) {
      await navbarToggler.click();
      await page.waitForTimeout(500);
    }

    const logoutButton = page.locator('button[onclick="logout()"]');
    await expect(logoutButton).toBeVisible({ timeout: 10000 });
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      logoutButton.click()
    ]);
    await expect(page.locator('#loginOverlay')).toBeVisible({ timeout: 15000 });
    logAction.success('Logout Admin OK');

    // =========================================================================
    // 2. PWA: LOGIN
    // =========================================================================
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

    // =========================================================================
    // 3. NEGATIVE TEST 1: KODE AKSES SALAH
    // =========================================================================
    await page.click('button:has-text("AMBIL ABSENSI KEGIATAN")');
    await page.fill('#inputKodeManual', 'KODEABAL123');
    await page.click('#view-pilih-metode button[type="submit"]');
    await expect(page.locator('.swal2-popup:has-text("tidak ditemukan")')).toBeVisible({ timeout: 5000 });
    await page.click('.swal2-confirm');
    logAction.success('Negative Test Kode Salah Lulus');

    // =========================================================================
    // 4. POSITIVE: INPUT KODE BENAR & ISI FORM
    // =========================================================================
    await page.click('button:has-text("AMBIL ABSENSI KEGIATAN")');
    await expect(page.locator('#view-pilih-metode')).toBeVisible({ timeout: 10000 });
    await page.fill('#inputKodeManual', kodeAkses);
    await page.click('#view-pilih-metode button[type="submit"]');
    await expect(page.locator('#view-form')).toBeVisible({ timeout: 15000 });

    await page.click('input[name="tipeKehadiran"][value="izin"]');
    await page.evaluate(() => pilihOpsiKehadiran('izin'));
    await page.selectOption('#alasanIzin', 'Dinas Luar Daerah');
    await page.fill('#keteranganIzin', `Uji E2E ${timestamp}`);

    // NEGATIVE TEST 2: UPLOAD TXT
    const mockTxtBuffer = Buffer.from('ini file txt', 'utf-8');
    await page.locator('#buktiIzin').setInputFiles({ name: 'salah.txt', mimeType: 'text/plain', buffer: mockTxtBuffer });
    await page.evaluate(() => { if (typeof checkIzinForm === 'function') checkIzinForm(); });
    const swalAlert = page.locator('.swal2-confirm');
    if (await swalAlert.isVisible().catch(() => false)) {
      await swalAlert.click();
      await page.waitForTimeout(300);
    }
    await expect(page.locator('#btnKirim')).toBeDisabled();

    // POSITIVE: UPLOAD PNG
    const mockPngBuffer = Buffer.from('iVBORw0KGgoAAAANSU5EUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.locator('#buktiIzin').setInputFiles({ name: 'bukti.png', mimeType: 'image/png', buffer: mockPngBuffer });
    await page.evaluate(() => { if (typeof handleProofFileChange === 'function') handleProofFileChange('buktiIzin', checkIzinForm); });
    await expect(page.locator('#btnKirim')).toBeEnabled();

    // =========================================================================
    // 5. KIRIM & CEK RIWAYAT LOKAL
    // =========================================================================
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/absen/submit') && resp.status() === 200),
      page.click('#btnKirim')
    ]);
    await page.locator('.swal2-confirm').click({ timeout: 10000 });

    const listRiwayat = page.locator('#listRiwayatLokal');
    await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 15000 });
    await expect(listRiwayat).toBeVisible({ timeout: 10000 });
    await expect(listRiwayat).toContainText(judulKegiatan, { timeout: 15000 });
    const riwayatText = await listRiwayat.innerText();
    console.log(` 📋 DITEMUKAN DI RIWAYAT:\n${riwayatText}`);
    logAction.success('Data ada di Riwayat Lokal');

    // =========================================================================
    // 6. ADMIN: LOGIN LAGI & CEK REKAP
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

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes(`/admin/rekap/${kodeAkses}`) && resp.status() === 200),
      page.evaluate((kode) => {
        if (typeof lihatRekap === 'function') {
          lihatRekap(kode);
        }
      }, kodeAkses)
    ]);
    await expect(page.locator('#rekapContainer')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    await page.fill('#rekapSearchInput', ADMIN_USER);
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes(`/admin/rekap/details/${kodeAkses}`) && resp.status() === 200),
      page.click('button[onclick="terapkanFilterRekap()"]')
    ]);

    await page.waitForFunction(() => {
      const tbody = document.getElementById('rekapTableBody');
      return tbody && tbody.querySelector('tr') && !tbody.innerHTML.includes('spinner') && !tbody.innerHTML.includes('Memuat data');
    }, { timeout: 15000 });
    await page.waitForTimeout(1000);

    const rows = page.locator('#rekapTableBody tr');
    let foundRekap = false;
    for (let i = 0; i < await rows.count(); i++) {
      const rowTxt = await rows.nth(i).innerText();
      if (rowTxt.includes(ADMIN_USER)) {
        foundRekap = true;
        console.log(` 📋 DITEMUKAN DI REKAP: ${rowTxt.replace(/\s+/g, ' ')}`);
        break;
      }
    }
    expect(foundRekap).toBe(true);
    logAction.success('SELESAI 100% SIKLUS');
  });
});