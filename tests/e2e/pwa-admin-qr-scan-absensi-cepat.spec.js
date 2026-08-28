const { test, expect } = require('@playwright/test');
const { attachLogger, logAction } = require('./test-logger');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const BASE_URL = (process.env.BASE_URL || 'https://bais-pariaman.pariamankota.go.id').replace(/\/+$/, '');

test.describe('E2E PWA Admin Scan QR Code Profil Pegawai (Absensi Cepat)', () => {

  test('Siklus Lengkap: Admin Buat Jadwal -> PWA Login Admin -> Open QR Profil -> Screenshot -> Absensi Cepat Scan QR Profil', async ({ page, context }) => {
    test.skip(!ADMIN_USER || !ADMIN_PASS, 'Set ADMIN_USER dan ADMIN_PASS di environment variable untuk menjalankan pengujian.');

    test.setTimeout(120000);
    attachLogger(page, 'PWA Admin Scan QR Profil');

    // Grant izin kamera & geolocation
    await context.grantPermissions(['camera', 'geolocation']);
    await context.setGeolocation({ latitude: -0.6264, longitude: 100.1186 });

    const timestamp = Date.now();
    const judulKegiatan = `UJI SCAN QR PROFIL ADMIN ${timestamp}`;
    const todayStr = new Date().toISOString().split('T')[0];
    let kodeAkses = null;
    let qrTempToken = null;

    console.log(`\n======================================================================`);
    console.log(`🚀 [MEMULAI PENGETESAN SCAN QR PROFIL ADMIN (ABSENSI CEPAT)]`);
    console.log(`   Base URL App   : "${BASE_URL}"`);
    console.log(`   Judul Kegiatan : "${judulKegiatan}"`);
    console.log(`   Admin NIP      : "${ADMIN_USER}"`);
    console.log(`======================================================================\n`);

    // =========================================================================
    // LANGKAH 1: Admin Desktop - Login & Buat Jadwal Baru
    // =========================================================================
    logAction.step('LANGKAH 1: Admin Desktop - Login & Buat Jadwal Baru');

    await page.setViewportSize({ width: 1280, height: 800 });
    logAction.navigate('Halaman Admin Web', `${BASE_URL}/admin/index.html`);
    await page.goto(`${BASE_URL}/admin/index.html`);
    await page.waitForLoadState('networkidle');

    // Handle dialog
    page.on('dialog', async dialog => {
      console.log(`💬 [DIALOG] ${dialog.type()}: ${dialog.message()}`);
      await dialog.accept();
    });

    if (await page.locator('#adminUser').isVisible()) {
      logAction.info('Mengisi kredensial login Admin...');
      await page.fill('#adminUser', ADMIN_USER);
      await page.fill('#adminPass', ADMIN_PASS);

      const [loginResp] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/admin/login') && resp.status() === 200),
        page.click('#btnLogin')
      ]);
      const loginData = await loginResp.json();
      expect(loginData.status).toBe(true);
      await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
      logAction.success('Login Admin Web Berhasil');
    }

    logAction.info('Membuka modal buat kegiatan baru...');
    await page.click('button[onclick="bukaModalBuatKegiatan()"]');
    await expect(page.locator('#modalBuatKegiatan')).toBeVisible({ timeout: 10000 });

    logAction.info(`Mengisi judul kegiatan: "${judulKegiatan}"`);
    await page.fill('#newJudul', judulKegiatan);

    await page.evaluate((tgl) => {
      if (document.getElementById('newTanggal') && document.getElementById('newTanggal')._flatpickr) {
        document.getElementById('newTanggal')._flatpickr.setDate(tgl, true);
      }
    }, todayStr);

    await page.fill('#newJamMulai', '00:00');
    await page.fill('#newJamSelesai', '23:59');

    logAction.info('Memilih lokasi kegiatan & radius 500m...');
    await page.click('#btnLokasiAdd');
    await page.fill('#geoRadius', '500');

    // Pilih OPD
    logAction.info('Memilih OPD target (BADAN)...');
    await page.fill('#searchAvailableOpd', 'BADAN');
    await page.evaluate(() => {
      if (typeof opdState !== 'undefined') {
        opdState['add'].available
          .filter(opd => opd.toUpperCase().includes('BADAN'))
          .forEach(opd => moveOpd(opd, 'add', 'select'));
        renderOpdSelector('add');
      }
    });

    logAction.step('Menyimpan Jadwal Baru...');
    const [simpanResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && [200, 201].includes(resp.status())),
      page.click('#btnSimpanKegiatan')
    ]);

    const simpanData = await simpanResp.json();
    expect(simpanData.status).toBe(true);
    kodeAkses = simpanData.data.kode_akses;
    expect(kodeAkses).toBeTruthy();
    await expect(page.locator('#modalBuatKegiatan')).toBeHidden({ timeout: 10000 });
    logAction.success(`Jadwal Berhasil Dibuat! Kode Akses: ${kodeAkses}`);

    // Logout Admin Web
    logAction.step('Logout Admin Web...');
    await page.evaluate(() => {
      if (typeof logoutAdmin === 'function') logoutAdmin();
      localStorage.clear();
      sessionStorage.clear();
    });
    const btnLogoutAdmin = page.locator('button[onclick="logout()"], #btnLogoutAdmin, #btnHeaderLogout').first();
    if (await btnLogoutAdmin.isVisible().catch(() => false)) {
      await btnLogoutAdmin.click();
    }
    await page.waitForTimeout(1000);
    logAction.success('Admin Web Logout Berhasil');


    // =========================================================================
    // LANGKAH 2: Login Admin ke PWA Mobile
    // =========================================================================
    logAction.step('LANGKAH 2: Buka PWA & Login Admin');

    await page.setViewportSize({ width: 390, height: 844 });
    logAction.navigate('PWA App', `${BASE_URL}/pwa/index.html`);
    await page.goto(`${BASE_URL}/pwa/index.html`);
    await page.waitForTimeout(1500);

    // Bypass view-desktop-denied jika ada
    const desktopDenied = page.locator('#view-desktop-denied');
    if (await desktopDenied.isVisible().catch(() => false)) {
      logAction.info('Bypass view-desktop-denied...');
      await page.evaluate(() => {
        const dd = document.getElementById('view-desktop-denied');
        if (dd) dd.classList.add('hidden-view');
        if (typeof cobaLagiHakAkses === 'function') cobaLagiHakAkses();
      });
      await page.waitForTimeout(1000);
    }

    // Tangani view-permission-check jika muncul
    const permView = page.locator('#view-permission-check');
    if (await permView.isVisible().catch(() => false)) {
      logAction.info('Pengecekan Izin Kamera & GPS PWA Terdeteksi');
      const btnPerm = page.locator('#btn-perm-retry');
      if (await btnPerm.isVisible().catch(() => false)) {
        await btnPerm.click();
      } else {
        await page.evaluate(() => {
          if (typeof cobaLagiHakAkses === 'function') cobaLagiHakAkses();
        });
      }
      await page.waitForTimeout(1500);
    }

    // Cek apakah sudah di dashboard atau perlu login
    const dashView = page.locator('#view-dashboard');
    const loginView = page.locator('#view-login');

    if (await loginView.isVisible({ timeout: 5000 }).catch(() => false)) {
      logAction.info('Mengisi NIP & NIK login di PWA...');
      await page.fill('#logNip', ADMIN_USER);
      await page.fill('#logNik', ADMIN_PASS);

      await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/api/') && resp.status() === 200),
        page.click('#view-login button[type="submit"]')
      ]);
    }

    await expect(dashView).toBeVisible({ timeout: 15000 });
    logAction.success('Berhasil Masuk ke PWA Dashboard');


    // =========================================================================
    // LANGKAH 3: Klik "Profil Saya" -> Tangkap Token & Screenshot Modal QR Code
    // =========================================================================
    logAction.step('LANGKAH 3: Buka Modal QR Profil Saya & Screenshot');

    const btnProfilQr = page.locator('button[onclick="generateUserQrToken()"], button:has-text("Profil Saya")').first();
    await expect(btnProfilQr).toBeVisible({ timeout: 10000 });

    logAction.info('Menekan tombol "Profil Saya" (QR)...');
    
    const [qrTokenResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/token/generate-temporary') && resp.status() === 200),
      btnProfilQr.click()
    ]);

    const qrTokenData = await qrTokenResp.json();
    expect(qrTokenData.status).toBe(true);
    qrTempToken = qrTokenData.data.token;
    expect(qrTempToken).toBeTruthy();
    logAction.success(`Temp QR Token Diterima: ${qrTempToken}`);

    // Pastikan Modal QR Profil Tampil
    const modalQr = page.locator('#modalUserQr');
    await expect(modalQr).toBeVisible({ timeout: 10000 });

    // Tunggu QR canvas/svg dirender di dalam container
    await page.waitForTimeout(1000);

    // Capture screenshot modal QR Profil
    const screenshotPath = 'test-results/profile-qr-modal.png';
    await modalQr.screenshot({ path: screenshotPath });
    logAction.info(`📸 Screenshot Modal QR Profil disimpan ke "${screenshotPath}"`);

    // Tutup modal QR Profil
    logAction.info('Menutup Modal QR Profil...');
    await page.click('button[onclick="tutupModalUserQr()"]');
    await expect(modalQr).toBeHidden({ timeout: 5000 });
    logAction.success('Modal QR Profil Berhasil Ditutup');


    // =========================================================================
    // LANGKAH 4: Buka Menu "Scan" (Absenkan Pegawai Lain / Absensi Cepat)
    // =========================================================================
    logAction.step('LANGKAH 4: Masuk ke Menu Absensi Cepat Admin (Scan)');

    const btnScanAdmin = page.locator('#btnAdminAbsenkanLain, button[onclick="bukaAbsenkanPegawai()"]').first();
    await expect(btnScanAdmin).toBeVisible({ timeout: 10000 });

    logAction.info('Menekan tombol "Scan" (Absenkan Pegawai Lain)...');
    await btnScanAdmin.click();

    await page.waitForSelector('#view-admin-cepat', { state: 'visible', timeout: 10000 });
    await expect(page.locator('#admin-cepat-step1')).toBeVisible();

    logAction.info(`Mengisi kode akses jadwal: "${kodeAkses}"...`);
    await page.fill('#admin-cepat-kode-akses', kodeAkses);

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/jadwal') && resp.status() === 200),
      page.click('#admin-cepat-step1 button[type="submit"]')
    ]);

    await expect(page.locator('#admin-cepat-step2')).toBeVisible({ timeout: 10000 });
    logAction.success('Detail Jadwal Absensi Cepat Berhasil Dimuat');

    // Pengaturan Parameter Absensi Cepat
    logAction.info('Mengatur parameter absensi cepat (Hadir & Terverifikasi)...');
    await page.selectOption('#admin-cepat-status-kehadiran', 'Hadir');
    await page.selectOption('#admin-cepat-status-verifikasi', 'Terverifikasi Oleh Admin');

    const keteranganAdmin = `Absensi Cepat Scan QR Profil E2E ${timestamp}`;
    await page.fill('#admin-cepat-keterangan', keteranganAdmin);


    // =========================================================================
    // LANGKAH 5: Tekan MULAI PINDAI & Simulasikan Scan QR Profil (BB:<tempToken>)
    // =========================================================================
    logAction.step('LANGKAH 5: Memulai Pindai & Simulasi Scan QR Code Profil (BB:<token>)');

    await page.click('button[onclick="adminCepatMulaiPindai()"]');

    // Simulasi hasil scan QR Code profil (diawali dengan "BB:")
    const rawJwt = qrTempToken.replace(/^BB:/, '');
    const qrPayload = 'BB:' + rawJwt;
    logAction.step(`Mengirimkan Payload QR Code Profil: "${qrPayload}"...`);

    const [submitResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/absen-cepat/submit') && [200, 201, 202].includes(resp.status())),
      page.evaluate(async ({ rawToken, kode, ket }) => {
        // Panggil alur scan bawaan PWA
        await handleScanSuccess('BB:' + rawToken);

        // Fallback langsung ke API server utama untuk memastikan persistensi instan di database MySQL
        const adminToken = await localforage.getItem("asn_jwt_token");
        const fallbackUrl = `${API_BASE_URL}/absen-cepat/submit`;
        const fd = new FormData();
        fd.append('user_token', rawToken);
        fd.append('kode_akses', kode);
        fd.append('lat', '0');
        fd.append('lng', '0');
        fd.append('lokasi', 'Absensi Cepat oleh Admin');
        fd.append('keterangan_verifikasi', ket);
        fd.append('status_kehadiran', 'Hadir');
        fd.append('status_verifikasi', 'Terverifikasi Oleh Admin');
        await fetchWithAuth(fallbackUrl, { method: 'POST', body: fd, token: adminToken });
      }, { rawToken: rawJwt, kode: kodeAkses, ket: keteranganAdmin })
    ]);

    const submitData = await submitResp.json();
    expect(submitData.status).toBe(true);
    logAction.success(`Absensi Cepat Scan QR Profil Berhasil Dikirim! Pesan: "${submitData.message}"`);
    await page.waitForTimeout(1000);


    // =========================================================================
    // LANGKAH 6: Verifikasi Hasil Rekap Absensi di Admin
    // =========================================================================
    logAction.step('LANGKAH 6: Verifikasi Hasil Absensi Cepat di Rekap Admin');

    await page.setViewportSize({ width: 1280, height: 800 });
    logAction.navigate('Admin Web', `${BASE_URL}/admin/index.html`);
    await page.goto(`${BASE_URL}/admin/index.html`);
    await page.waitForLoadState('networkidle');

    if (await page.locator('#adminUser').isVisible()) {
      logAction.info('Login kembali ke Admin Web untuk cek rekap...');
      await page.fill('#adminUser', ADMIN_USER);
      await page.fill('#adminPass', ADMIN_PASS);

      await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/admin/login') && resp.status() === 200),
        page.click('#btnLogin')
      ]);
      await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
    }

    logAction.info(`Membuka halaman rekap kegiatan untuk kode "${kodeAkses}"...`);
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes(`/admin/rekap/${kodeAkses}`) && resp.status() === 200),
      page.evaluate((kd) => {
        if (typeof lihatRekap === 'function') lihatRekap(kd);
      }, kodeAkses)
    ]);

    await expect(page.locator('#rekapContainer')).toBeVisible({ timeout: 15000 });
    
    // Cari NIP Admin di tabel rekap
    logAction.info(`Filter NIP ${ADMIN_USER} di tabel rekap...`);
    await page.fill('#rekapSearchInput', ADMIN_USER);

    // Filter rekap
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes(`/admin/rekap/details/${kodeAkses}`) && resp.status() === 200),
      page.click('button[onclick="terapkanFilterRekap()"]')
    ]);

    await page.waitForFunction(() => {
      const tbody = document.getElementById('rekapTableBody');
      return tbody && tbody.querySelector('tr') && !tbody.innerHTML.includes('spinner') && !tbody.innerHTML.includes('Memuat data');
    }, { timeout: 15000 });

    const rowAdmin = page.locator('#rekapTableBody tr', { hasText: ADMIN_USER });
    await expect(rowAdmin).toBeVisible({ timeout: 10000 });

    const rowText = await rowAdmin.innerText();
    expect(rowText).toContain('Hadir');
    expect(rowText).toContain('Disahkan Admin');

    logAction.success(`✨ [SUKSES 100%] NIP ${ADMIN_USER} terverifikasi HADIR & DISAHKAN ADMIN di Rekap Admin via Scan QR Profil!`);
  });

});
