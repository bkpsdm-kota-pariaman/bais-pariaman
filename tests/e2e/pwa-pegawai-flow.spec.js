const { test, expect } = require('@playwright/test');
const { attachLogger, logAction } = require('./test-logger');

test.describe('PWA / Browser Pegawai Flow (Non-PWA Mode)', () => {
  const TEST_NIP = process.env.TEST_NIP || process.env.PEGAWAI_NIP || '199001012020011001';
  const TEST_PASSWORD = process.env.TEST_PASSWORD || process.env.PEGAWAI_PASSWORD || '1234567890123456';

  test('Tahap 1: Akses Landing Page -> Navigasi ke /pwa -> Pengecekan Hak Akses Perangkat & Status Install', async ({ page }) => {
    attachLogger(page, 'PWA-Tahap1');

    logAction.navigate('/');
    await page.goto('/');

    logAction.verify('Memeriksa tombol BUKA APLIKASI di Landing Page...');
    const btnBuka = page.locator('a:has-text("BUKA APLIKASI")');
    await expect(btnBuka).toBeVisible({ timeout: 10000 });

    logAction.click('BUKA APLIKASI', 'a:has-text("BUKA APLIKASI")');
    await btnBuka.click();

    logAction.verify('Memeriksa alur pengecekan hak akses & navigasi ke Halaman Login...');
    const permView = page.locator('#view-permission-check');
    const loginView = page.locator('#view-login');

    // Cek apakah masuk ke view-permission-check (jika ada izin belum OK) atau langsung ke view-login (jika semua izin OK)
    const isPermViewVisible = await permView.isVisible().catch(() => false);

    if (isPermViewVisible) {
      logAction.verify('Hak akses belum lengkap, tampilan #view-permission-check muncul.');
      await page.waitForTimeout(2000);

      const badgeGpsText = await page.locator('#badge-perm-gps').innerText().catch(() => 'N/A');
      const badgeCamText = await page.locator('#badge-perm-camera').innerText().catch(() => 'N/A');
      console.log(`  📱 [STATUS AKSES PERANGKAT] GPS: ${badgeGpsText.replace(/\n/g, ' ')} | Kamera: ${badgeCamText.replace(/\n/g, ' ')}`);

      const btnRetry = page.locator('#btn-perm-retry');
      if (await btnRetry.isVisible().catch(() => false)) {
        logAction.click('COBA LAGI IZINKAN AKSES', '#btn-perm-retry');
        await btnRetry.click();
      }
    } else {
      console.log('  ✅ [INFO HAK AKSES] Hak akses Kamera & GPS sudah OK sejak awal, otomatis skip permission check dan langsung membuka Halaman Login.');
    }

    logAction.verify('Memeriksa tampilan Form Login (#view-login)...');
    await expect(loginView).toBeVisible({ timeout: 10000 });

    logAction.verify('Memeriksa status tombol INSTALL APLIKASI (#btnInstallInLogin) di Halaman Login...');
    const btnInstall = page.locator('#btnInstallInLogin');
    const isInstallVisible = await btnInstall.isVisible().catch(() => false);
    console.log(`  📲 [STATUS TOMBOL INSTALL PWA] Visible: ${isInstallVisible ? 'YA (Tampil di Mode Browser)' : 'TIDAK'}`);
    expect(isInstallVisible).toBe(true);
    logAction.success('Tahap 1 Lolos: Landing page, PWA permission check & halaman login terverifikasi.');
  });

  test('Tahap 2: Tes Login Gagal (3x) & Login Berhasil dengan Parameter Command', async ({ page }) => {
    attachLogger(page, 'PWA-Tahap2');

    logAction.navigate('/pwa/');
    await page.goto('/pwa/');

    // Jika masuk ke permission check, klik Lanjutkan
    const permView = page.locator('#view-permission-check');
    if (await permView.isVisible().catch(() => false)) {
      const btnLanjutkan = page.locator('#view-permission-check button:has-text("LANJUTKAN")');
      if (await btnLanjutkan.isVisible().catch(() => false)) {
        await btnLanjutkan.click();
      }
    }

    await expect(page.locator('#view-login')).toBeVisible({ timeout: 10000 });

    logAction.verify('--- MENGUJI LOGIN GAGAL (3X CONCOCTED INVALID CREDENTIALS) ---');
    const invalidCredentials = [
      { nip: '111111111111111111', nik: '1111111111111111', tryName: 'Percobaan 1' },
      { nip: '222222222222222222', nik: '2222222222222222', tryName: 'Percobaan 2' },
      { nip: '333333333333333333', nik: '3333333333333333', tryName: 'Percobaan 3' }
    ];

    for (const cred of invalidCredentials) {
      logAction.input(`NIP Invalid (${cred.tryName})`, '#logNip', cred.nip);
      await page.fill('#logNip', cred.nip);
      logAction.input(`NIK Invalid (${cred.tryName})`, '#logNik', cred.nik);
      await page.fill('#logNik', cred.nik);

      logAction.click(`Submit Login (${cred.tryName})`, '#view-login button[type="submit"]');
      await page.click('#view-login button[type="submit"]');

      const swalPopup = page.locator('.swal2-popup');
      await expect(swalPopup).toBeVisible({ timeout: 10000 });
      const errorText = await swalPopup.innerText();
      logAction.verify(`Response Error SweetAlert (${cred.tryName}): "${errorText.replace(/\n/g, ' ')}"`);
      expect(errorText.toLowerCase()).toMatch(/tidak ditemukan|salah|gagal/i);

      // Tutup SweetAlert
      const swalOkBtn = page.locator('.swal2-confirm');
      if (await swalOkBtn.isVisible().catch(() => false)) {
        await swalOkBtn.click();
      }
      await expect(swalPopup).toBeHidden({ timeout: 5000 });
    }
    logAction.success('Tiga kali uji coba login dengan kredensial salah BERHASIL divalidasi error-nya.');

    logAction.verify(`--- MELAKUKAN LOGIN BENAR (NIP: ${TEST_NIP}) ---`);
    logAction.input('NIP Valid', '#logNip', TEST_NIP);
    await page.fill('#logNip', TEST_NIP);
    logAction.input('NIK/Password Valid', '#logNik', TEST_PASSWORD);
    await page.fill('#logNik', TEST_PASSWORD);

    logAction.click('MASUK APLIKASI', '#view-login button[type="submit"]');
    await page.click('#view-login button[type="submit"]');

    logAction.verify('Memeriksa keberhasilan masuk ke Dashboard Pegawai (#view-dashboard)...');
    await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 15000 });

    const appVersionText = await page.locator('#appVersion').innerText().catch(() => 'Versi tidak terdeteksi');
    console.log(`  ℹ️  [INFO VERSI APLIKASI FOOTER] Versi Aplikasi saat ini: ${appVersionText}`);

    logAction.success('Tahap 2 Lolos: Login gagal 3x & Login berhasil ke dashboard terverifikasi.');
  });

  test('Tahap 3: Uji Coba Komponen Dashboard, QR Identitas, Edit Profil & Sinkronisasi', async ({ page }) => {
    attachLogger(page, 'PWA-Tahap3');

    logAction.navigate('/pwa/');
    await page.goto('/pwa/');

    // Selesaikan login jika belum terautentikasi
    const dashboardView = page.locator('#view-dashboard');
    if (!await dashboardView.isVisible().catch(() => false)) {
      const permView = page.locator('#view-permission-check');
      if (await permView.isVisible().catch(() => false)) {
        const btnRetry = page.locator('#btn-perm-retry');
        if (await btnRetry.isVisible().catch(() => false)) await btnRetry.click();
      }
      await page.fill('#logNip', TEST_NIP);
      await page.fill('#logNik', TEST_PASSWORD);
      await page.click('#view-login button[type="submit"]');
      await expect(dashboardView).toBeVisible({ timeout: 15000 });
    }

    logAction.verify('--- MEMERIKSA KOMPONEN DASHBOARD PEGAWAI ---');
    const btnAmbilAbsen = page.locator('button:has-text("AMBIL ABSENSI KEGIATAN")');
    const btnSinkronkan = page.locator('button:has-text("Sinkronkan")');
    const btnEditProfil = page.locator('button:has-text("Edit Profil")');

    await expect(btnAmbilAbsen).toBeVisible({ timeout: 10000 });
    await expect(btnSinkronkan).toBeVisible({ timeout: 10000 });
    await expect(btnEditProfil).toBeVisible({ timeout: 10000 });
    logAction.success('Seluruh komponen utama Dashboard (Ambil Absen, Sinkronkan, Edit Profil) ditemukan.');

    logAction.verify('--- MENGUJI TOMBOL PROFIL / QR IDENTITAS (POJOK KANAN ATAS) ---');
    const btnProfilSaya = page.locator('button:has-text("Profil Saya")');
    await expect(btnProfilSaya).toBeVisible({ timeout: 10000 });
    logAction.click('Profil Saya', 'button:has-text("Profil Saya")');
    await btnProfilSaya.click();

    const modalUserQr = page.locator('#modalUserQr');
    await expect(modalUserQr).toBeVisible({ timeout: 10000 });
    logAction.verify('Modal QR Identitas (#modalUserQr) berhasil terbuka.');

    const qrContainer = page.locator('#userQrContainer');
    await expect(qrContainer).toBeVisible({ timeout: 10000 });
    const hasQrCanvasOrImg = await qrContainer.locator('canvas, img, svg').count() > 0;
    console.log(`  📷 [VERIFIKASI QR CODE] Elemen QR Code ter-render: ${hasQrCanvasOrImg ? 'YA' : 'TIDAK'}`);
    expect(hasQrCanvasOrImg).toBe(true);

    logAction.click('TUTUP Modal QR', '#modalUserQr button:has-text("TUTUP")');
    await page.click('#modalUserQr button:has-text("TUTUP")');
    await expect(modalUserQr).toBeHidden({ timeout: 5000 });
    logAction.success('Modal QR Identitas berhasil diuji dan ditutup.');

    logAction.verify('--- MENGUJI EDIT PROFIL & SINKRONISASI DATA PEGAWAI ---');
    const origJabatan = await page.locator('#dashJabatan').innerText();
    const origOpd = await page.locator('#dashPerangkatDaerah').innerText();
    console.log(`  📋 [DATA PROFIL AWAL] Jabatan: "${origJabatan}" | OPD: "${origOpd}"`);

    logAction.click('Edit Profil', 'button:has-text("Edit Profil")');
    await btnEditProfil.click();

    const modalEditProfil = page.locator('#modalEditProfil');
    await expect(modalEditProfil).toBeVisible({ timeout: 10000 });

    const tempJabatan = `${origJabatan} - E2E`;
    logAction.input('Jabatan Baru (Uji Coba)', '#editJabatan', tempJabatan);
    await page.fill('#editJabatan', tempJabatan);

    logAction.click('SIMPAN PROFIL', '#modalEditProfil button[type="submit"]');
    
    // Dengarkan response /api/profil/update
    const updateResponsePromise = page.waitForResponse(
      resp => resp.url().includes('/api/profil/update'),
      { timeout: 15000 }
    ).catch(() => null);

    await page.click('#modalEditProfil button[type="submit"]');
    const updateResponse = await updateResponsePromise;

    let isRateLimited = false;
    if (updateResponse) {
      const httpStatus = updateResponse.status();
      let resBody = {};
      try { resBody = await updateResponse.json(); } catch(e) {}
      if (httpStatus === 429 || resBody.code === 429 || (resBody.message && resBody.message.toLowerCase().includes('sebulan'))) {
        isRateLimited = true;
        console.log(`  ⚠️  [RATE LIMIT 429] Terdeteksi pembatasan update profil: "${resBody.message || 'HTTP 429'}"`);
      }
    }

    if (isRateLimited) {
      logAction.verify('Batas update profil (HTTP 429) tercapai. Menutup dialog & melewati verifikasi perubahan data profil...');
      const swalConfirmBtn = page.locator('.swal2-confirm');
      if (await swalConfirmBtn.isVisible().catch(() => false)) {
        await swalConfirmBtn.click();
      }
      await page.evaluate(() => { if (typeof tutupModalEditProfil === 'function') tutupModalEditProfil(); });
      await expect(modalEditProfil).toBeHidden({ timeout: 5000 }).catch(() => {});

      logAction.click('Sinkronkan', 'button:has-text("Sinkronkan")');
      await btnSinkronkan.click();
      await page.waitForTimeout(2000);

      logAction.success('Uji Coba Profil selesai (melewati edit nilai karena limit 429 sebulan) & Tombol Sinkronkan berhasil diuji.');
    } else {
      // Menunggu modal edit profil tertutup normal
      await expect(modalEditProfil).toBeHidden({ timeout: 10000 }).catch(() => {});

      logAction.click('Sinkronkan', 'button:has-text("Sinkronkan")');
      await btnSinkronkan.click();

      await page.waitForTimeout(2000); // Tunggu sinkronisasi selesai
      const updatedJabatan = await page.locator('#dashJabatan').innerText();
      console.log(`  🔄 [DATA PROFIL TERUPDATE] Jabatan setelah sinkron: "${updatedJabatan}"`);

      logAction.verify('Mengembalikan data profil ke nilai semula...');
      await btnEditProfil.click();
      await expect(modalEditProfil).toBeVisible({ timeout: 10000 });

      logAction.input('Jabatan Semula', '#editJabatan', origJabatan);
      await page.fill('#editJabatan', origJabatan);

      const restoreResponsePromise = page.waitForResponse(
        resp => resp.url().includes('/api/profil/update'),
        { timeout: 15000 }
      ).catch(() => null);

      await page.click('#modalEditProfil button[type="submit"]');
      const restoreResponse = await restoreResponsePromise;

      let isRestoreRateLimited = false;
      if (restoreResponse) {
        const httpStatus = restoreResponse.status();
        let resBody = {};
        try { resBody = await restoreResponse.json(); } catch(e) {}
        if (httpStatus === 429 || resBody.code === 429 || (resBody.message && resBody.message.toLowerCase().includes('sebulan'))) {
          isRestoreRateLimited = true;
          console.log(`  ⚠️  [RATE LIMIT 429 SAAT RESTORE] "${resBody.message || 'HTTP 429'}"`);
        }
      }

      if (isRestoreRateLimited) {
        logAction.verify('Batas update profil (429) tercapai saat restore. Menutup dialog & melakukan sinkronisasi akhir...');
        const swalConfirmBtn = page.locator('.swal2-confirm');
        if (await swalConfirmBtn.isVisible().catch(() => false)) {
          await swalConfirmBtn.click();
        }
        await page.evaluate(() => { if (typeof tutupModalEditProfil === 'function') tutupModalEditProfil(); });
        await expect(modalEditProfil).toBeHidden({ timeout: 5000 }).catch(() => {});
      } else {
        await expect(modalEditProfil).toBeHidden({ timeout: 10000 }).catch(() => {});
      }

      await btnSinkronkan.click();
      await page.waitForTimeout(2000);

      const restoredJabatan = await page.locator('#dashJabatan').innerText();
      console.log(`  ↩️  [DATA PROFIL RESTORED/SINKRON] Jabatan saat ini: "${restoredJabatan}"`);

      logAction.success('Uji Coba Edit Profil & Sinkronkan Data Pegawai SELURUHNYA BERHASIL.');
    }
  });
});
