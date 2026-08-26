const { test, expect } = require('@playwright/test');
const { attachLogger, logAction } = require('./test-logger');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

test.describe('Admin Rekap Verifikasi -> Audit Log Absensi Flow (Juli 2026)', () => {

  test.beforeEach(async ({ page }) => {
    attachLogger(page, 'Verifikasi & Log Absensi');

    test.skip(!ADMIN_USER || !ADMIN_PASS,
      'Set ADMIN_USER dan ADMIN_PASS di environment variable untuk menjalankan pengujian Verifikasi & Log Absensi.');

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
  });

  test('Uji Verifikasi 5 Sampel Rekap Kehadiran (Juli 2026) dan Validasi JSON Payload di Log Absensi', async ({ page }) => {
    // =========================================================================
    // LANGKAH 1 & 2: Buka Menu Rekap Kegiatan (Keseluruhan)
    // =========================================================================
    logAction.menu('Menu Rekap Kehadiran / Kegiatan (bukaHalamanRekapKeseluruhan)');
    await page.evaluate(() => bukaHalamanRekapKeseluruhan());
    await expect(page.locator('#rekapKeseluruhanContainer')).toBeVisible({ timeout: 10000 });

    // =========================================================================
    // LANGKAH 3: Pilih Range Waktu Bulan Juli 2026 (1 Juli 2026 s/d 31 Juli 2026)
    // =========================================================================
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
    
    // Tunggu request API rekap selesai dan respon 200 diterima
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/admin/rekap/keseluruhan') && resp.status() === 200, { timeout: 25000 }),
      page.click('button[onclick="terapkanFilterRekapKeseluruhan()"]')
    ]);

    logAction.verify('Menunggu rendering tabel rekap kehadiran...');
    await page.waitForFunction(() => {
      const tbody = document.getElementById('rekapKeseluruhanTableBody');
      if (!tbody) return false;
      const html = tbody.innerHTML;
      return html.includes('bukaModalVerifikasiKeseluruhan') ||
        html.includes('Tidak ada data') ||
        html.includes('Gagal memuat') ||
        (!html.includes('spinner-border') && !html.includes('Memuat data'));
    }, { timeout: 15000 });

    // Ambil 5 data sampel teratas dari data rekap
    const topSamples = await page.evaluate(() => {
      if (typeof currentRekapKeseluruhanData !== 'undefined' && Array.isArray(currentRekapKeseluruhanData) && currentRekapKeseluruhanData.length > 0) {
        return currentRekapKeseluruhanData.slice(0, 5);
      }
      const buttons = Array.from(document.querySelectorAll('#rekapKeseluruhanTableBody tr button[onclick*="bukaModalVerifikasiKeseluruhan"]'));
      return buttons.slice(0, 5).map(btn => {
        const raw = btn.getAttribute('onclick');
        const match = raw ? raw.match(/bukaModalVerifikasiKeseluruhan\((.*)\)/s) : null;
        if (match) {
          try {
            return JSON.parse(match[1].replace(/&quot;/g, '"'));
          } catch (e) {}
        }
        return null;
      }).filter(Boolean);
    });

    if (topSamples.length === 0) {
      logAction.verify('Tidak ada data absensi untuk rentang Juli 2026.');
      test.skip(true, 'Tidak ada data rekap kehadiran pada bulan Juli 2026 untuk diuji.');
    }

    logAction.verify(`Ditemukan ${topSamples.length} data absensi. Memulai verifikasi...`);

    // =========================================================================
    // LANGKAH 4: Verifikasi 5 Data Teratas (1, 3, 5 = Ditolak; 2, 4 = Diterima)
    // =========================================================================
    const editedSamples = [];

    for (let i = 0; i < topSamples.length; i++) {
      const sampleItem = topSamples[i];
      const index = i + 1; // 1-based index (1..5)
      const isTolak = (index === 1 || index === 3 || index === 5);
      const targetVerifStatus = isTolak ? 'Ditolak Oleh Admin' : 'Terverifikasi Oleh Admin';
      const targetKeterangan = isTolak ? 'INI COBA TOLAK' : 'DATA OK';

      console.log(`\n----------------------------------------------------------------------`);
      console.log(`📝 [VERIFIKASI DATA ${index}/${topSamples.length}] NIP: ${sampleItem.nip} (${sampleItem.nama_pegawai || '-'})`);
      console.log(`   Status Target: "${targetVerifStatus}" | Ket Target: "${targetKeterangan}"`);
      console.log(`----------------------------------------------------------------------`);

      // Buka modal verifikasi untuk sampel ini (tunggu hingga OPD & modal selesai di-load)
      logAction.click(`Buka Modal Verifikasi (${sampleItem.nama_pegawai || sampleItem.nip})`);
      await page.evaluate(async (item) => {
        await bukaModalVerifikasiKeseluruhan(item);
      }, sampleItem);

      const modalVerif = page.locator('#modalVerifikasi');
      await expect(modalVerif).toBeVisible({ timeout: 10000 });

      // Pastikan target NIP di modal sesuai
      const nipTarget = await page.inputValue('#verifNip');
      const namaTarget = await page.inputValue('#verifNama');
      const kodeAksesTarget = await page.inputValue('#verifKodeAkses');
      expect(nipTarget).toBe(sampleItem.nip);

      console.log(`  📋 [TERHUBUNG KE MODAL] NIP: "${nipTarget}", Kode Akses: "${kodeAksesTarget}"`);

      // Set Status Verifikasi & Keterangan Admin
      logAction.select('Tindakan Verifikasi', '#verifStatus', targetVerifStatus);
      await page.selectOption('#verifStatus', targetVerifStatus);
      expect(await page.inputValue('#verifStatus')).toBe(targetVerifStatus);

      logAction.input('Catatan / Keterangan Admin', '#verifKeterangan', targetKeterangan);
      await page.fill('#verifKeterangan', targetKeterangan);

      // Submit form dan tunggu respon verifikasi dari server
      await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/admin/verifikasi') && resp.status() === 200, { timeout: 15000 }),
        page.click('#btnSimpanVerif')
      ]);

      logAction.verify('Menunggu modal verifikasi tertutup...');
      await expect(modalVerif).toBeHidden({ timeout: 15000 });

      // Tutup alert SweetAlert jika ada
      const swalConfirm = page.locator('.swal2-confirm');
      if (await swalConfirm.isVisible().catch(() => false)) {
        await swalConfirm.click().catch(() => {});
      }

      logAction.success(`Data ke-${index} (NIP: ${nipTarget}) berhasil diverifikasi dengan status "${targetVerifStatus}"`);

      editedSamples.push({
        index,
        kodeAkses: kodeAksesTarget,
        nip: nipTarget,
        nama: namaTarget,
        statusVerifikasi: targetVerifStatus,
        keterangan: targetKeterangan
      });

      await page.waitForTimeout(300);
    }

    console.log(`\n======================================================================`);
    console.log(`✅ Selesai verifikasi ${editedSamples.length} data. Membuka Menu Log Absensi...`);
    console.log(`======================================================================`);

    // =========================================================================
    // LANGKAH 5 & 6: Buka Menu Log Absensi, Cari & Bandingkan Payload JSON
    // =========================================================================
    logAction.menu('Halaman Log Absensi (bukaHalamanLogAbsensi)');
    await page.evaluate(() => bukaHalamanLogAbsensi());
    await expect(page.locator('#logAbsensiContainer')).toBeVisible({ timeout: 10000 });

    for (const sample of editedSamples) {
      console.log(`\n----------------------------------------------------------------------`);
      console.log(`🔍 [AUDIT LOG ${sample.index}/${editedSamples.length}] Memeriksa Log NIP: ${sample.nip} (${sample.nama})`);
      console.log(`   Kode Akses Target: ${sample.kodeAkses} | Verifikasi: ${sample.statusVerifikasi} | Keterangan: ${sample.keterangan}`);
      console.log(`----------------------------------------------------------------------`);

      // 1. Masukkan Kode Akses Kegiatan
      logAction.input('Filter Kode Akses Kegiatan', '#logFilterKegiatan', sample.kodeAkses);
      await page.fill('#logFilterKegiatan', sample.kodeAkses);

      // 2. Masukkan NIP Pegawai
      logAction.input('Filter NIP / Nama Pegawai', '#logFilterPegawai', sample.nip);
      await page.fill('#logFilterPegawai', sample.nip);

      // 3. Klik Cari Log
      logAction.click('Tombol Cari Log', 'button[onclick="terapkanFilterLogAbsensi()"]');
      await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/admin/log-absensi') && resp.status() === 200, { timeout: 15000 }),
        page.click('button[onclick="terapkanFilterLogAbsensi()"]')
      ]);

      logAction.verify('Menunggu tabel log absensi selesai memuat data...');
      await page.waitForFunction(() => {
        const tbody = document.getElementById('logAbsensiTableBody');
        if (!tbody) return false;
        const html = tbody.innerHTML;
        return html.includes('<tr') && !html.includes('spinner-border') && !html.includes('Memuat data');
      }, { timeout: 15000 });

      // Verifikasi box detail kegiatan muncul
      const detailBox = page.locator('#logKegiatanDetailBox');
      await expect(detailBox).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#logDetailKodeAkses')).toContainText(sample.kodeAkses);

      // Ambil teks payload JSON dari baris log teratas (terbaru) yang cocok dengan NIP
      const payloadText = await page.evaluate((nipTarget) => {
        const rows = Array.from(document.querySelectorAll('#logAbsensiTableBody tr'));
        const matchedRow = rows.find(r => r.innerText.includes(nipTarget)) || rows[0];
        if (!matchedRow) return null;
        const textarea = matchedRow.querySelector('textarea');
        return textarea ? textarea.value : matchedRow.innerText;
      }, sample.nip);

      expect(payloadText).not.toBeNull();
      console.log(`  📄 [PAYLOAD JSON LOG DITEMUKAN]:\n${payloadText}`);

      // Validasi struktur dan isi Payload JSON
      let parsedPayload = null;
      try {
        parsedPayload = JSON.parse(payloadText);
      } catch (e) {
        console.warn('  ⚠️ JSON parse warning, mengecek kecocokan string...');
      }

      if (parsedPayload) {
        expect(parsedPayload.kode_akses).toBe(sample.kodeAkses);
        expect(parsedPayload.nip).toBe(sample.nip);
        expect(parsedPayload.status_verifikasi).toBe(sample.statusVerifikasi);
        expect(parsedPayload.keterangan).toBe(sample.keterangan);
      } else {
        expect(payloadText).toContain(sample.kodeAkses);
        expect(payloadText).toContain(sample.nip);
        expect(payloadText).toContain(sample.statusVerifikasi);
        expect(payloadText).toContain(sample.keterangan);
      }

      logAction.success(`Log verifikasi untuk NIP "${sample.nip}" (${sample.statusVerifikasi} - "${sample.keterangan}") VALID dan tercatat di Log Absensi!`);
    }

    console.log(`\n🎉 [PENGUJIAN SELESAI] Seluruh ${editedSamples.length} kegiatan verifikasi berhasil dicatat & dicocokkan dengan payload audit log!`);
  });

});
