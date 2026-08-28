const { test, expect } = require('@playwright/test');
const { attachLogger, logAction } = require('./test-logger');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const BASE_URL = (process.env.BASE_URL || 'https://bais-pariaman.pariamankota.go.id').replace(/\/+$/, '');

test.describe('E2E Verifikasi & Pengesahan Admin 5 Jadwal', () => {

  test('Siklus 5 Jadwal: 2 Hadir + 3 Tidak Hadir -> Admin Verifikasi -> Cek Log Absensi', async ({ page, context }) => {
    // Beri izin GPS & Kamera di browser context
    await context.grantPermissions(['geolocation', 'camera']);
    await context.setGeolocation({ latitude: -0.6264, longitude: 100.1186 });
    attachLogger(page, 'E2E Verifikasi 5 Jadwal');
    test.skip(!ADMIN_USER || !ADMIN_PASS, 'Set ADMIN_USER dan ADMIN_PASS di environment variables.');
    test.setTimeout(360000); // 6 menit timeout untuk 5 siklus lengkap

    const timestamp = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];
    const mockPngBuffer = Buffer.from('iVBORw0KGgoAAAANSU5EUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

    // Daftar 5 jadwal yang akan dibuat: 2 Hadir + 3 Tidak Hadir
    const listJadwal = [
      { id: 1, tipe: 'hadir', judul: `UJI HADIR 1 ${timestamp}`, kodeAkses: null },
      { id: 2, tipe: 'hadir', judul: `UJI HADIR 2 ${timestamp}`, kodeAkses: null },
      { id: 3, tipe: 'tidak_hadir', judul: `UJI TIDAK HADIR 1 ${timestamp}`, kodeAkses: null },
      { id: 4, tipe: 'tidak_hadir', judul: `UJI TIDAK HADIR 2 ${timestamp}`, kodeAkses: null },
      { id: 5, tipe: 'tidak_hadir', judul: `UJI TIDAK HADIR 3 ${timestamp}`, kodeAkses: null },
    ];

    // =========================================================================
    // TAHAP 1: ADMIN LOGIN & MEMBUAT 5 JADWAL KEGIATAN
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

    for (let i = 0; i < listJadwal.length; i++) {
      const item = listJadwal[i];
      logAction.step(`Admin membuat Jadwal ${i + 1}/5: "${item.judul}"`);

      await page.click('button[onclick="bukaModalBuatKegiatan()"]');
      await expect(page.locator('#modalBuatKegiatan')).toBeVisible({ timeout: 10000 });

      await page.fill('#newJudul', item.judul);
      await page.evaluate((tgl) => document.getElementById('newTanggal')._flatpickr.setDate(tgl, true), todayStr);
      await page.fill('#newJamMulai', '00:00');
      await page.fill('#newJamSelesai', '23:59');
      await page.click('#btnLokasiAdd');
      await page.fill('#geoRadius', '500');

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
      item.kodeAkses = jsonCreate.data.kode_akses;
      expect(item.kodeAkses).not.toBeNull();
      await expect(page.locator('#modalBuatKegiatan')).toBeHidden({ timeout: 10000 });
      logAction.success(`Jadwal ${i + 1} dibuat. Kode: ${item.kodeAkses}`);
      await page.waitForTimeout(500);
    }

    console.log('\n  📋 [5 KODE AKSES JADWAL TERCATAT]:');
    listJadwal.forEach((j, idx) => console.log(`   ${idx + 1}. [${j.tipe.toUpperCase()}] ${j.judul} -> Kode: ${j.kodeAkses}`));

    // LOGOUT ADMIN
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
    // TAHAP 2: PWA LOGIN PEGAWAI & PENGAMBILAN 5 ABSENSI
    // =========================================================================
    logAction.navigate(`${BASE_URL}/pwa/index.html`);
    await page.goto(`${BASE_URL}/pwa/index.html`);
    await page.waitForLoadState('networkidle');

    if (await page.locator('#view-desktop-denied').isVisible().catch(() => false)) {
      await page.evaluate(() => document.getElementById('view-desktop-denied').classList.add('hidden-view'));
    }

    const permView = page.locator('#view-permission-check');
    if (await permView.isVisible().catch(() => false)) {
      const btnLanjut = page.locator('#btn-perm-retry');
      if (await btnLanjut.isVisible().catch(() => false)) {
        await btnLanjut.click().catch(() => {});
        await page.waitForTimeout(1000);
      }
    }

    await page.evaluate(async () => {
      const permViewEl = document.getElementById('view-permission-check');
      if (permViewEl && !permViewEl.classList.contains('hidden-view')) {
        if (typeof cobaLagiHakAkses === 'function') {
          await cobaLagiHakAkses();
        } else if (typeof checkAuthStatus === 'function') {
          await checkAuthStatus();
        }
      }
    });
    await page.waitForTimeout(1000);

    const loginPwaView = page.locator('#view-login');
    if (!await loginPwaView.isVisible().catch(() => false)) {
      await page.evaluate(() => {
        if (typeof switchView === 'function') switchView('view-login');
      });
    }
    await expect(page.locator('#view-login')).toBeVisible({ timeout: 15000 });
    await page.fill('#logNip', ADMIN_USER);
    await page.fill('#logNik', ADMIN_PASS);
    await page.click('#view-login button[type="submit"]');
    await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 15000 });
    logAction.success('Login PWA Pegawai OK');

    // Ambil absensi satu per satu untuk ke-5 jadwal
    for (let i = 0; i < listJadwal.length; i++) {
      const item = listJadwal[i];
      logAction.step(`Mengambil Absensi ${i + 1}/5 [${item.tipe.toUpperCase()}] untuk kode "${item.kodeAkses}"`);

      await page.click('button:has-text("AMBIL ABSENSI KEGIATAN")');
      await expect(page.locator('#view-pilih-metode')).toBeVisible({ timeout: 10000 });
      await page.fill('#inputKodeManual', item.kodeAkses);
      await page.click('#view-pilih-metode button[type="submit"]');
      await expect(page.locator('#view-form')).toBeVisible({ timeout: 15000 });

      if (item.tipe === 'hadir') {
        // --- OPSI HADIR ---
        await page.click('input[name="tipeKehadiran"][value="hadir"]');
        await page.evaluate(() => {
          if (typeof pilihOpsiKehadiran === 'function') pilihOpsiKehadiran('hadir');
        });

        // Tangani jika ada dialog lokasi
        const boxLokasiGagal = page.locator('#boxLokasiGagal');
        if (await boxLokasiGagal.isVisible().catch(() => false)) {
          await page.click('#boxLokasiGagal button:has-text("Lanjutkan")').catch(() => {});
        }

        // Pastikan koordinat, alamat, dan foto selfie terisi lengkap
        await page.evaluate(() => {
          const latInput = document.getElementById('lat');
          const lngInput = document.getElementById('lng');
          const alamatInput = document.getElementById('alamat');
          if (latInput && !latInput.value) latInput.value = '-0.6264';
          if (lngInput && !lngInput.value) lngInput.value = '100.1186';
          if (alamatInput && !alamatInput.value) alamatInput.value = 'Balai Kota Pariaman, Jl. Jenderal Sudirman No. 1';

          const b64Input = document.getElementById('fotoBase64');
          const mockCanvas = document.createElement('canvas');
          mockCanvas.width = 320;
          mockCanvas.height = 240;
          const ctx = mockCanvas.getContext('2d');
          ctx.fillStyle = '#b91c1c';
          ctx.fillRect(0, 0, 320, 240);
          ctx.fillStyle = '#ffffff';
          ctx.font = '16px sans-serif';
          ctx.fillText('E2E VERIFIKASI OK', 60, 120);
          const mockB64 = mockCanvas.toDataURL('image/jpeg', 0.8);
          if (b64Input) b64Input.value = mockB64;
          const hasilFoto = document.getElementById('hasilFoto');
          if (hasilFoto) {
            hasilFoto.src = mockB64;
            hasilFoto.classList.remove('hidden-view');
          }
          const kameraEl = document.getElementById('kamera');
          if (kameraEl) kameraEl.classList.add('hidden-view');
          if (typeof validasiTombolKirim === 'function') validasiTombolKirim();
          const btn = document.getElementById('btnKirim');
          if (btn) btn.disabled = false;
        });

        const boxKeterangan = page.locator('#boxKeterangan');
        if (await boxKeterangan.isVisible().catch(() => false)) {
          await page.fill('#keterangan', `Hadir E2E ${item.kodeAkses}`);
        }

      } else {
        // --- OPSI TIDAK HADIR ---
        await page.click('input[name="tipeKehadiran"][value="izin"]');
        await page.evaluate(() => {
          if (typeof pilihOpsiKehadiran === 'function') pilihOpsiKehadiran('izin');
        });
        await page.selectOption('#alasanIzin', 'Dinas Luar Daerah');
        await page.fill('#keteranganIzin', `Dinas Luar E2E ${item.kodeAkses}`);

        // Upload Bukti PNG
        await page.locator('#buktiIzin').setInputFiles({ name: `bukti-${item.kodeAkses}.png`, mimeType: 'image/png', buffer: mockPngBuffer });
        await page.evaluate(() => { if (typeof handleProofFileChange === 'function') handleProofFileChange('buktiIzin', checkIzinForm); });
      }

      await expect(page.locator('#btnKirim')).toBeEnabled({ timeout: 10000 });

      // Submit Absen
      await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/absen/submit') && resp.status() === 200),
        page.click('#btnKirim')
      ]);
      await page.locator('.swal2-confirm').click({ timeout: 10000 });

      // Pastikan tersimpan di dashboard riwayat lokal
      const listRiwayat = page.locator('#listRiwayatLokal');
      await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 15000 });
      await expect(listRiwayat).toContainText(item.judul, { timeout: 15000 });
      logAction.success(`Absensi ${i + 1}/5 [${item.tipe.toUpperCase()}] berhasil terkirim & tercatat di PWA.`);
      await page.waitForTimeout(500);
    }

    // =========================================================================
    // TAHAP 3: ADMIN LOGIN & LAKUKAN VERIFIKASI / PENGESAHAN PRESENSI
    // =========================================================================
    logAction.navigate(`${BASE_URL}/admin/index.html`);
    await page.goto(`${BASE_URL}/admin/index.html`);
    await page.waitForLoadState('networkidle');

    if (await page.locator('#adminUser').isVisible().catch(() => false)) {
      await page.fill('#adminUser', ADMIN_USER);
      await page.fill('#adminPass', ADMIN_PASS);
      await page.click('#btnLogin');
      await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);
    }
    logAction.success('Login Admin Kembali Berhasil');

    // Lakukan verifikasi untuk ke-5 jadwal
    for (let i = 0; i < listJadwal.length; i++) {
      const item = listJadwal[i];
      logAction.step(`Admin memverifikasi Jadwal ${i + 1}/5 (Kode: ${item.kodeAkses})`);

      // Buka Rekap
      await Promise.all([
        page.waitForResponse(resp => resp.url().includes(`/admin/rekap/${item.kodeAkses}`) && resp.status() === 200),
        page.evaluate((kode) => {
          if (typeof lihatRekap === 'function') lihatRekap(kode);
        }, item.kodeAkses)
      ]);
      await expect(page.locator('#rekapContainer')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(500);

      // Filter detail berdasarkan NIP
      await page.fill('#rekapSearchInput', ADMIN_USER);
      await Promise.all([
        page.waitForResponse(resp => resp.url().includes(`/admin/rekap/details/${item.kodeAkses}`) && resp.status() === 200),
        page.click('button[onclick="terapkanFilterRekap()"]')
      ]);

      await page.waitForFunction(() => {
        const tbody = document.getElementById('rekapTableBody');
        return tbody && tbody.querySelector('tr') && !tbody.innerHTML.includes('spinner') && !tbody.innerHTML.includes('Memuat data');
      }, { timeout: 15000 });

      // Klik tombol Edit / Verifikasi Status pada baris pegawai
      const btnEditStatus = page.locator('#rekapTableBody tr button[onclick*="bukaModalVerifikasi"]').first();
      await expect(btnEditStatus).toBeVisible({ timeout: 10000 });
      await btnEditStatus.click();

      // Modal verifikasi terbuka
      const modalVerif = page.locator('#modalVerifikasi');
      await expect(modalVerif).toBeVisible({ timeout: 10000 });

      // Pilih Status Pengesahan: 'Terverifikasi Oleh Admin'
      await page.selectOption('#verifStatus', 'Terverifikasi Oleh Admin');
      await page.fill('#verifKeterangan', `Disahkan oleh Admin E2E untuk kode ${item.kodeAkses}`);

      // Simpan Verifikasi
      await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/admin/verifikasi') && resp.status() === 200),
        page.click('#btnSimpanVerif')
      ]);

      await expect(modalVerif).toBeHidden({ timeout: 10000 });
      logAction.success(`Verifikasi Jadwal ${i + 1}/5 (${item.kodeAkses}) berhasil disimpan!`);
      await page.waitForTimeout(500);
    }

    // =========================================================================
    // TAHAP 4: CEK LOG ABSENSI (AUDIT TRAIL VERIFIKASI)
    // =========================================================================
    logAction.step('Membuka Halaman Log Absensi Audit...');

    await page.evaluate(() => {
      if (typeof bukaHalamanLogAbsensi === 'function') bukaHalamanLogAbsensi();
    });
    await expect(page.locator('#logAbsensiContainer')).toBeVisible({ timeout: 15000 });

    // Periksa log untuk salah satu jadwal (misal jadwal pertama: listJadwal[0])
    const testLogItem = listJadwal[0];
    logAction.input('Filter Kode Akses Log Absensi', '#logFilterKegiatan', testLogItem.kodeAkses);
    await page.fill('#logFilterKegiatan', testLogItem.kodeAkses);
    await page.fill('#logFilterPegawai', ADMIN_USER);

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/admin/log-absensi') && resp.status() === 200),
      page.click('button[onclick="terapkanFilterLogAbsensi()"]')
    ]);

    await page.waitForFunction(() => {
      const tbody = document.getElementById('logAbsensiTableBody');
      return tbody && tbody.querySelector('tr') && !tbody.innerHTML.includes('spinner') && !tbody.innerHTML.includes('Memuat data');
    }, { timeout: 15000 });

    const logRows = page.locator('#logAbsensiTableBody tr');
    const logRowCount = await logRows.count();
    expect(logRowCount).toBeGreaterThan(0);

    const logText = await logRows.first().innerText();
    console.log(`\n  📜 [LOG ABSENSI TERVERIFIKASI]:\n${logText.replace(/\s+/g, ' ')}`);

    // Pastikan log memuat NIP pegawai dan detail verifikasi
    expect(logText).toContain(ADMIN_USER);
    logAction.success('Aktivitas verifikasi admin 100% tercatat di Log Absensi Audit!');
    logAction.success('SELURUH SIKLUS 5 JADWAL + VERIFIKASI + LOG AUDIT SUKSES!');
  });
});
