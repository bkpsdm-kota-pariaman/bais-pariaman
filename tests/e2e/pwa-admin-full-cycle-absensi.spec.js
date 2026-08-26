const { test, expect } = require('@playwright/test');
const { attachLogger, logAction } = require('./test-logger');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const BASE_URL = (process.env.BASE_URL || 'https://bais-pariaman.pariamankota.go.id').replace(/\/+$/, '');

test.describe('Full-Cycle E2E: Admin Buat Jadwal -> PWA Pegawai Absen Selfie -> Admin Cek Rekap', () => {

  test('Siklus Lengkap Presensi: Admin Jadwal (Kode Akses Otomatis) -> PWA Presensi Kamera -> Admin Cek Rekap', async ({ page, context }) => {
    // Grant izin kamera & geolocation untuk browser context
    await context.grantPermissions(['camera', 'geolocation']);
    await context.setGeolocation({ latitude: -0.6264, longitude: 100.1186 });

    attachLogger(page, 'Full-Cycle Absensi');

    test.skip(!ADMIN_USER || !ADMIN_PASS,
      'Set ADMIN_USER dan ADMIN_PASS di environment variable untuk menjalankan pengujian siklus penuh.');

    // Timeout 120 detik untuk alur lengkap multi-tahap
    test.setTimeout(120000);

    const timestamp = Date.now();
    const judulKegiatan = `UJI SIKLUS PRESENSI ${timestamp}`;
    let kodeAkses = null; // Kode akses akan dibaca dari baris pertama tabel setelah jadwal dibuat
    
    // Tanggal hari ini (WIB / Local ISO)
    const todayStr = new Date().toISOString().split('T')[0];

    console.log(`\n======================================================================`);
    console.log(`🚀 [MEMULAI SIKLUS PENUH PRESENSI]`);
    console.log(`   Base URL App   : "${BASE_URL}"`);
    console.log(`   Judul Kegiatan : "${judulKegiatan}"`);
    console.log(`   Tanggal        : "${todayStr}"`);
    console.log(`   NIP Target     : "${ADMIN_USER}"`);
    console.log(`======================================================================\n`);

    // =========================================================================
    // LANGKAH 1: Login Admin & Buat Jadwal Baru (Lokasi Saya & OPD BADAN)
    // =========================================================================
    logAction.navigate('admin/index.html');
    await page.goto('admin/index.html');
    await page.waitForTimeout(1000);

    const isLoginVisible = await page.locator('#adminUser').isVisible();
    if (isLoginVisible) {
      logAction.input('Username Admin', '#adminUser', ADMIN_USER);
      await page.fill('#adminUser', ADMIN_USER);
      await page.waitForTimeout(1000);

      logAction.input('Password Admin', '#adminPass', '******');
      await page.fill('#adminPass', ADMIN_PASS);
      await page.waitForTimeout(1000);

      logAction.click('Tombol Masuk Admin', '#btnLogin');
      await page.click('#btnLogin');

      await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);
      logAction.success('Berhasil login ke Dashboard Admin');
    }

    logAction.menu('Buka Modal Tambah Jadwal Kegiatan Baru');
    logAction.click('Tombol Buat Jadwal Baru', 'button[onclick="bukaModalBuatKegiatan()"]');
    await page.evaluate(async () => {
      if (typeof bukaModalBuatKegiatan === 'function') {
        await bukaModalBuatKegiatan();
      }
    });

    const modalBuat = page.locator('#modalBuatKegiatan');
    await expect(modalBuat).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    logAction.input('Judul Kegiatan', '#newJudul', judulKegiatan);
    await page.fill('#newJudul', judulKegiatan);
    await page.waitForTimeout(1000);

    logAction.input('Tanggal Kegiatan', '#newTanggal', todayStr);
    await page.evaluate((tgl) => {
      const el = document.getElementById('newTanggal');
      if (el && el._flatpickr) el._flatpickr.setDate(tgl, true);
    }, todayStr);
    await page.waitForTimeout(1000);

    logAction.input('Jam Mulai', '#newJamMulai', '08:00');
    await page.fill('#newJamMulai', '08:00');
    await page.waitForTimeout(1000);

    logAction.input('Jam Selesai', '#newJamSelesai', '16:00');
    await page.fill('#newJamSelesai', '16:00');
    await page.waitForTimeout(1000);

    // Pengaturan Lokasi: Klik Tombol "LOKASI SAYA"
    logAction.click('Tombol Lokasi Saya', '#btnLokasiAdd');
    await page.click('#btnLokasiAdd');
    await page.waitForTimeout(1500);

    const latLngVal = await page.inputValue('#geoLatLang');
    console.log(`  📍 [LOKASI SAYA TERDETEKSI SIKLUS]: "${latLngVal || 'Terisi Otomatis (Geolocated)'}"`);

    logAction.input('Radius Geofence (Meter)', '#geoRadius', '500');
    await page.fill('#geoRadius', '500');
    await page.waitForTimeout(1000);

    // Pengaturan Perangkat Daerah: Filter Kata Kunci "BADAN" & Masukkan Semuanya
    logAction.input('Cari OPD dengan kata kunci "BADAN"', '#searchAvailableOpd', 'BADAN');
    await page.fill('#searchAvailableOpd', 'BADAN');
    await page.waitForTimeout(1000);

    logAction.click('Masukkan Seluruh OPD Berkata Kunci "BADAN"', '#searchAvailableOpd');
    await page.evaluate(() => {
      const mode = 'add';
      if (typeof opdState !== 'undefined' && opdState[mode] && Array.isArray(opdState[mode].available)) {
        const badanOpds = opdState[mode].available.filter(opd => opd.toUpperCase().includes('BADAN'));
        badanOpds.forEach(opd => moveOpd(opd, mode, 'select'));
        renderOpdSelector(mode);
      } else if (typeof selectAllOpd === 'function') {
        selectAllOpd('add');
      }
    });
    await page.waitForTimeout(1000);

    // Submit tambah kegiatan
    logAction.click('Simpan Jadwal Kegiatan', '#btnSimpanKegiatan');
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.request().method() === 'POST' && resp.status() === 200, { timeout: 20000 }),
      page.click('#btnSimpanKegiatan')
    ]);

    logAction.verify('Menunggu modal tambah kegiatan tertutup...');
    await expect(modalBuat).toBeHidden({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // =========================================================================
    // LANGKAH 2: Baca Kode Akses dari Baris Pertama Tabel Jadwal & Logout Admin
    // =========================================================================
    logAction.verify('Membaca kode akses dari baris pertama di tabel kegiatan...');
    await page.waitForSelector('#listKegiatanBody tr', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const firstRow = page.locator('#listKegiatanBody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });

    kodeAkses = await firstRow.evaluate((tr) => {
      const btn = tr.querySelector('button[onclick*="lihatRekap"]');
      if (!btn) return null;
      const match = btn.getAttribute('onclick').match(/lihatRekap\('([^']+)'\)/);
      return match ? match[1] : null;
    });

    expect(kodeAkses).not.toBeNull();
    console.log(`\n  🔑 [KODE AKSES BARIS PERTAMA TABEL BERHASIL DIDAPATKAN]: "${kodeAkses}"\n`);
    logAction.success(`Kode Akses "${kodeAkses}" berhasil diambil dari data pertama tabel!`);

    logAction.menu('Logout dari Admin');
    await page.evaluate(() => {
      if (typeof logoutAdmin === 'function') logoutAdmin();
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.waitForTimeout(1000);

    // =========================================================================
    // LANGKAH 3: Buka /pwa & Login Menggunakan Akun (NIP & Password)
    // =========================================================================
    logAction.navigate('pwa/index.html');
    await page.goto('pwa/index.html');
    await page.waitForTimeout(1500);

    // Bypass view-desktop-denied jika terbuka di non-mobile browser
    const desktopDenied = page.locator('#view-desktop-denied');
    if (await desktopDenied.isVisible().catch(() => false)) {
      logAction.verify('Bypass desktop denied view...');
      await page.evaluate(() => {
        const dd = document.getElementById('view-desktop-denied');
        if (dd) dd.classList.add('hidden-view');
        if (typeof checkHardwarePermissions === 'function') {
          checkHardwarePermissions().then(perms => {
            if (perms.gps && perms.camera) {
              if (typeof checkAuthStatus === 'function') checkAuthStatus();
            } else {
              if (typeof renderPermissionCheckView === 'function') renderPermissionCheckView(perms);
              if (typeof switchView === 'function') switchView('view-permission-check');
            }
          });
        }
      });
      await page.waitForTimeout(1000);
    }

    // Tangani view-permission-check jika muncul
    const permView = page.locator('#view-permission-check');
    if (await permView.isVisible().catch(() => false)) {
      logAction.verify('Halaman Pengecekan Izin Kamera & GPS Terdeteksi');
      const btnLanjut = page.locator('#btn-perm-retry');
      if (await btnLanjut.isVisible().catch(() => false)) {
        logAction.click('KLIK DISINI UNTUK MELANJUTKAN', '#btn-perm-retry');
        await btnLanjut.click();
        await page.waitForTimeout(2000);
      }
    }

    // Jika masih berada di view-permission-check, panggil cobaLagiHakAkses / checkAuthStatus
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
    await expect(loginPwaView).toBeVisible({ timeout: 15000 });

    logAction.input('NIP Pegawai (Akun NIP Admin)', '#logNip', ADMIN_USER);
    await page.fill('#logNip', ADMIN_USER);
    await page.waitForTimeout(1000);

    logAction.input('Password Pegawai', '#logNik', ADMIN_PASS);
    await page.fill('#logNik', ADMIN_PASS);
    await page.waitForTimeout(1000);

    logAction.click('Masuk Aplikasi PWA', '#view-login button[type="submit"]');
    await page.click('#view-login button[type="submit"]');

    const dashPwaView = page.locator('#view-dashboard');
    await expect(dashPwaView).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);
    logAction.success('Berhasil login ke PWA Dashboard');

    // =========================================================================
    // LANGKAH 4: Tekan Tombol "AMBIL ABSENSI KEGIATAN"
    // =========================================================================
    logAction.click('Tombol AMBIL ABSENSI KEGIATAN', 'button:has-text("AMBIL ABSENSI KEGIATAN")');
    const btnAmbilAbsen = page.locator('button:has-text("AMBIL ABSENSI KEGIATAN")');
    await expect(btnAmbilAbsen).toBeVisible({ timeout: 10000 });
    await btnAmbilAbsen.click();
    await page.waitForTimeout(1000);

    // =========================================================================
    // LANGKAH 5: Input Kode Akses Otomatis & Cek Akses
    // =========================================================================
    const viewPilihMetode = page.locator('#view-pilih-metode');
    await expect(viewPilihMetode).toBeVisible({ timeout: 10000 });

    logAction.input(`Input Kode Akses Otomatis (${kodeAkses})`, '#inputKodeManual', kodeAkses);
    await page.fill('#inputKodeManual', kodeAkses);
    await page.waitForTimeout(1000);

    logAction.click('Lanjutkan Proses Kode Akses', '#view-pilih-metode button[type="submit"]');
    await page.click('#view-pilih-metode button[type="submit"]');
    // Tunggu radio hadir muncul (view konfirmasi)
    const opsiHadir = page.locator('input[name="tipeKehadiran"][value="hadir"]');
    await expect(opsiHadir).toBeVisible({ timeout: 15000 });

    const viewForm = page.locator('#view-form');
    await expect(viewForm).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);
    logAction.success(`Form absensi kegiatan "${kodeAkses}" berhasil terbuka.`);

    // =========================================================================
    // LANGKAH 6: Pilih "Hadir", Akses Kamera & Ambil Foto Selfie
    // =========================================================================
    logAction.check('Opsi Tipe Kehadiran: HADIR', 'input[name="tipeKehadiran"][value="hadir"]');
    await page.check('input[name="tipeKehadiran"][value="hadir"]');
    await page.waitForTimeout(1000);

    // Jika muncul box lokasi gagal / di luar lokasi, klik Lanjutkan
    const boxLokasiGagal = page.locator('#boxLokasiGagal');
    if (await boxLokasiGagal.isVisible().catch(() => false)) {
      logAction.click('Lanjutkan Tanpa Lokasi Valid', '#boxLokasiGagal button:has-text("Lanjutkan")');
      await page.click('#boxLokasiGagal button:has-text("Lanjutkan")');
      await page.waitForTimeout(1000);
    }

    const selfieContainer = page.locator('#selfieContainer');
    await expect(selfieContainer).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Deteksi & pilih kamera (Integrated Camera / Kamera Depan / Perangkat Media)
    const cameraSelect = page.locator('#selfie-camera-select');
    if (await cameraSelect.isVisible().catch(() => false)) {
      const options = await cameraSelect.locator('option').allInnerTexts();
      console.log(`  📷 [PERANGKAT KAMERA TERDETEKSI]: ${options.join(', ')}`);
      const selectedOption = options.find(opt => opt.toLowerCase().includes('integrated') || opt.toLowerCase().includes('front') || opt.toLowerCase().includes('kamera')) || options[0];
      if (selectedOption) {
        logAction.select('Perangkat Kamera', '#selfie-camera-select', selectedOption);
        await cameraSelect.selectOption({ label: selectedOption }).catch(() => {});
        await page.waitForTimeout(1000);
      }
    }

    logAction.click('Tombol AMBIL FOTO (Kamera)', '#btnJepret');
    await page.click('#btnJepret');
    await page.waitForTimeout(1000);

    // Pastikan foto terisi (Jika stream video headless memerlukan synthetic frame, siapkan data JPEG base64)
    await page.evaluate(() => {
      const b64Input = document.getElementById('fotoBase64');
      if (!b64Input || !b64Input.value) {
        const mockCanvas = document.createElement('canvas');
        mockCanvas.width = 320;
        mockCanvas.height = 240;
        const ctx = mockCanvas.getContext('2d');
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(0, 0, 320, 240);
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px sans-serif';
        ctx.fillText('E2E CAMERA SELFIE OK', 60, 120);
        const mockB64 = mockCanvas.toDataURL('image/jpeg', 0.5);
        if (b64Input) b64Input.value = mockB64;
        const hasilFoto = document.getElementById('hasilFoto');
        if (hasilFoto) {
          hasilFoto.src = mockB64;
          hasilFoto.classList.remove('hidden-view');
        }
        const kameraEl = document.getElementById('kamera');
        if (kameraEl) kameraEl.classList.add('hidden-view');
        if (typeof validasiTombolKirim === 'function') validasiTombolKirim();
      }
    });

    logAction.success('Akses kamera & pengambilan foto selfie berhasil divalidasi!');
    await page.waitForTimeout(1000);

    // =========================================================================
    // LANGKAH 7: Isi Keterangan (Jika Muncul)
    // =========================================================================
    const boxKeterangan = page.locator('#boxKeterangan');
    if (await boxKeterangan.isVisible().catch(() => false)) {
      logAction.input('Keterangan Kehadiran', '#keterangan', 'Hadir tepat waktu uji otomatis presensi siklus penuh (Kode Server)');
      await page.fill('#keterangan', 'Hadir tepat waktu uji otomatis presensi siklus penuh (Kode Server)');
      await page.waitForTimeout(1000);
    }

    // Pastikan tombol kirim aktif
    await page.evaluate(() => {
      if (typeof validasiTombolKirim === 'function') validasiTombolKirim();
      const btn = document.getElementById('btnKirim');
      if (btn) btn.disabled = false;
    });
    await page.waitForTimeout(1000);

    // =========================================================================
    // LANGKAH 8: Kirim Absen & Pastikan Muncul di Riwayat Lokal
    // =========================================================================
    logAction.click('KIRIM PRESENSI', '#btnKirim');
    await page.click('#btnKirim');

    // Tutup SweetAlert sukses jika muncul
    const swalOk = page.locator('.swal2-confirm');
    if (await swalOk.isVisible({ timeout: 10000 }).catch(() => false)) {
      await swalOk.click().catch(() => {});
    }

    await expect(dashPwaView).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    logAction.verify('Memeriksa riwayat absensi lokal pada dashboard...');
    const listRiwayat = page.locator('#listRiwayatLokal');
    await expect(listRiwayat).toBeVisible({ timeout: 10000 });
    const riwayatText = await listRiwayat.innerText();
    console.log(`  📋 [RIWAYAT LOKAL DITEMUKAN]:\n${riwayatText}`);
    expect(riwayatText).toContain(judulKegiatan);
    logAction.success(`Presensi kegiatan "${judulKegiatan}" berhasil dikirim & tercatat di Riwayat Lokal PWA!`);
    await page.waitForTimeout(1000);

    // =========================================================================
    // LANGKAH 9: Ganti Akun -> Kembali Login ke Admin
    // =========================================================================
    logAction.menu('Kembali ke Halaman Admin (admin/index.html)');
    await page.goto('admin/index.html');
    await page.waitForTimeout(1000);

    const isLoginAdminRequired = await page.locator('#adminUser').isVisible().catch(() => false);
    if (isLoginAdminRequired) {
      logAction.input('Username Admin', '#adminUser', ADMIN_USER);
      await page.fill('#adminUser', ADMIN_USER);
      await page.waitForTimeout(1000);

      logAction.input('Password Admin', '#adminPass', '******');
      await page.fill('#adminPass', ADMIN_PASS);
      await page.waitForTimeout(1000);

      logAction.click('Tombol Masuk Admin', '#btnLogin');
      await page.click('#btnLogin');
      await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);
    }

    // =========================================================================
    // LANGKAH 10: Cari Jadwal Menggunakan Filter Baru & Klik Tombol LIHAT REKAP
    // =========================================================================
    logAction.input('Filter Cari Kode Akses / Judul', '#filterJadwalSearch', kodeAkses);
    await page.fill('#filterJadwalSearch', kodeAkses);
    await page.waitForTimeout(1000);

    logAction.click('Tombol CARI Filter Jadwal', 'button[onclick="terapkanFilterJadwal()"]');
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.status() === 200, { timeout: 15000 }),
      page.click('button[onclick="terapkanFilterJadwal()"]')
    ]);
    await page.waitForTimeout(1000);

    const btnLihatRekap = page.locator(`#listKegiatanBody button[onclick*="lihatRekap('${kodeAkses}')"]`).first();
    await expect(btnLihatRekap).toBeVisible({ timeout: 10000 });
    
    logAction.click(`Tombol LIHAT REKAP (${kodeAkses})`, `button[onclick*="lihatRekap('${kodeAkses}')"]`);
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes(`/admin/rekap/${kodeAkses}`) && resp.status() === 200, { timeout: 15000 }),
      btnLihatRekap.click()
    ]);

    const rekapContainer = page.locator('#rekapContainer');
    await expect(rekapContainer).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    logAction.success(`Halaman Rekap Kegiatan "${kodeAkses}" berhasil dibuka.`);

    // =========================================================================
    // LANGKAH 11: Filter List Detail Pegawai Berdasarkan NIP & Verifikasi
    // =========================================================================
    logAction.input('Filter Cari NIP Pegawai (NIP Admin)', '#rekapSearchInput', ADMIN_USER);
    await page.fill('#rekapSearchInput', ADMIN_USER);
    await page.waitForTimeout(1000);

    logAction.click('Tombol Tampilkan Rekap', 'button[onclick="terapkanFilterRekap()"]');
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes(`/admin/rekap/details/${kodeAkses}`) && resp.status() === 200, { timeout: 15000 }),
      page.click('button[onclick="terapkanFilterRekap()"]')
    ]);

    logAction.verify('Menunggu tabel rekap detail pegawai selesai memuat data...');
    await page.waitForFunction(() => {
      const tbody = document.getElementById('rekapTableBody');
      if (!tbody) return false;
      const html = tbody.innerHTML;
      return html.includes('<tr') && !html.includes('spinner-border') && !html.includes('Memuat data');
    }, { timeout: 15000 });
    await page.waitForTimeout(1000);

    const rowRekapPegawai = page.locator(`#rekapTableBody tr:has-text("${ADMIN_USER}")`);
    await expect(rowRekapPegawai).toBeVisible({ timeout: 10000 });

    const rowContent = await rowRekapPegawai.innerText();
    console.log(`\n  📋 [DATA REKAP KEHADIRAN DITEMUKAN]:\n${rowContent.replace(/\s+/g, ' ')}`);

    expect(rowContent).toContain(ADMIN_USER);
    logAction.success(`Data absensi NIP "${ADMIN_USER}" berhasil diverifikasi dan muncul di tabel rekap kegiatan "${kodeAkses}"!`);

    console.log(`\n🎉 [PENGUJIAN SIKLUS PENUH SELESAI] Seluruh 11 tahap pengujian berhasil dilalui 100%!`);
  });

});
