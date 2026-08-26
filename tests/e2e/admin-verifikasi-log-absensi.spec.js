const { test, expect } = require('@playwright/test');
const { attachLogger, logAction } = require('./test-logger');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

test.describe('Admin Rekap Verifikasi & Hapus Data -> Audit Log Absensi Flow (Juli 2026)', () => {

  test.beforeEach(async ({ page }) => {
    attachLogger(page, 'Verifikasi & Log Absensi');

    test.skip(!ADMIN_USER || !ADMIN_PASS,
      'Set ADMIN_USER dan ADMIN_PASS di environment variable untuk menjalankan pengujian Verifikasi & Log Absensi.');

    logAction.navigate('admin/index.html');
    await page.goto('admin/index.html');
    await page.waitForTimeout(1000); // Jeda natural

    const isLoginVisible = await page.locator('#adminUser').isVisible();
    if (isLoginVisible) {
      logAction.input('Username Admin', '#adminUser', ADMIN_USER);
      await page.fill('#adminUser', ADMIN_USER);
      await page.waitForTimeout(1000);

      logAction.input('Password Admin', '#adminPass', '******');
      await page.fill('#adminPass', ADMIN_PASS);
      await page.waitForTimeout(1000);

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
      await page.waitForTimeout(1000);
      logAction.success('Berhasil login dan masuk ke Dashboard Admin');
    }
  });

  test('Uji Verifikasi Status & Hapus Data Absensi (Juli 2026) dan Validasi JSON Payload di Log Absensi', async ({ page }) => {
    // Timeout 120 detik agar seluruh alur aman dengan jeda 1 detik per aksi
    test.setTimeout(120000);

    // =========================================================================
    // LANGKAH 1 & 2: Buka Menu Rekap Kegiatan (Keseluruhan)
    // =========================================================================
    logAction.menu('Menu Rekap Kehadiran / Kegiatan (bukaHalamanRekapKeseluruhan)');
    await page.evaluate(() => bukaHalamanRekapKeseluruhan());
    await expect(page.locator('#rekapKeseluruhanContainer')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // =========================================================================
    // LANGKAH 3: Pilih Range Waktu Bulan Juli 2026 (1 Juli 2026 s/d 31 Juli 2026)
    // =========================================================================
    logAction.verify('Menunggu instance Flatpickr siap di DOM...');
    await page.waitForFunction(() => {
      const el = document.getElementById('rekapKeseluruhanStartDate');
      return el && el._flatpickr;
    }, { timeout: 10000 });

    logAction.input('Tanggal Mulai', '#rekapKeseluruhanStartDate', '2026-07-01');
    await page.evaluate(() => {
      const startEl = document.getElementById('rekapKeseluruhanStartDate');
      if (startEl && startEl._flatpickr) startEl._flatpickr.setDate('2026-07-01', true);
    });
    await page.waitForTimeout(1000);

    logAction.input('Tanggal Selesai', '#rekapKeseluruhanEndDate', '2026-07-31');
    await page.evaluate(() => {
      const endEl = document.getElementById('rekapKeseluruhanEndDate');
      if (endEl && endEl._flatpickr) endEl._flatpickr.setDate('2026-07-31', true);
    });
    await page.waitForTimeout(1000);

    logAction.click('Tombol Tampilkan Data', 'button[onclick="terapkanFilterRekapKeseluruhan()"]');
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/admin/rekap/keseluruhan') && resp.status() === 200, { timeout: 25000 }),
      page.click('button[onclick="terapkanFilterRekapKeseluruhan()"]')
    ]);
    await page.waitForTimeout(1000);

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

    // Ambil sampel data dari data rekap
    const allSamples = await page.evaluate(() => {
      if (typeof currentRekapKeseluruhanData !== 'undefined' && Array.isArray(currentRekapKeseluruhanData) && currentRekapKeseluruhanData.length > 0) {
        return currentRekapKeseluruhanData;
      }
      return [];
    });

    if (allSamples.length === 0) {
      logAction.verify('Tidak ada data absensi untuk rentang Juli 2026.');
      test.skip(true, 'Tidak ada data rekap kehadiran pada bulan Juli 2026 untuk diuji.');
    }

    // Alokasikan sampel: maks 4 untuk verifikasi edit, 1 untuk hapus (agar tidak bentrok)
    const samplesToVerify = allSamples.slice(0, Math.min(4, allSamples.length > 1 ? allSamples.length - 1 : allSamples.length));
    const sampleToDelete = allSamples.length > 1 ? allSamples[allSamples.length - 1] : null;

    logAction.verify(`Ditemukan ${allSamples.length} total data absensi. Alokasi: ${samplesToVerify.length} untuk Verifikasi, 1 untuk Hapus Data.`);
    await page.waitForTimeout(1000);

    // =========================================================================
    // LANGKAH 4.A: Verifikasi / Edit Status (Ubah Status ke Kebalikannya)
    // =========================================================================
    const editedSamples = [];

    for (let i = 0; i < samplesToVerify.length; i++) {
      const sampleItem = samplesToVerify[i];
      const index = i + 1;

      await page.waitForTimeout(1000);

      // Buka modal verifikasi
      logAction.click(`Buka Modal Verifikasi (${sampleItem.nama_pegawai || sampleItem.nip})`);
      await page.evaluate(async (item) => {
        await bukaModalVerifikasiKeseluruhan(item);
      }, sampleItem);

      const modalVerif = page.locator('#modalVerifikasi');
      await expect(modalVerif).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const nipTarget = await page.inputValue('#verifNip');
      const namaTarget = await page.inputValue('#verifNama');
      const kodeAksesTarget = await page.inputValue('#verifKodeAkses');
      expect(nipTarget).toBe(sampleItem.nip);

      // Cek status verifikasi saat ini
      const statusLamaModal = await page.innerText('#verifStatusLama');
      const currentStatus = (statusLamaModal || sampleItem.status_verifikasi || 'ALPA').trim();
      const isCurrentlyAccepted = currentStatus.includes('Terverifikasi') || currentStatus.includes('Disahkan');

      // Tentukan status kebalikannya:
      const targetVerifStatus = isCurrentlyAccepted ? 'Ditolak Oleh Admin' : 'Terverifikasi Oleh Admin';
      const targetKeterangan = isCurrentlyAccepted ? 'INI COBA TOLAK' : 'DATA OK';

      console.log(`\n----------------------------------------------------------------------`);
      console.log(`📝 [VERIFIKASI DATA ${index}/${samplesToVerify.length}] NIP: ${nipTarget} (${namaTarget})`);
      console.log(`   Status Saat Ini: "${currentStatus}" -> Diubah Menjadi: "${targetVerifStatus}" (Ket: "${targetKeterangan}")`);
      console.log(`----------------------------------------------------------------------`);

      logAction.select('Tindakan Verifikasi', '#verifStatus', targetVerifStatus);
      await page.selectOption('#verifStatus', targetVerifStatus);
      expect(await page.inputValue('#verifStatus')).toBe(targetVerifStatus);
      await page.waitForTimeout(1000);

      logAction.input('Catatan / Keterangan Admin', '#verifKeterangan', targetKeterangan);
      await page.fill('#verifKeterangan', targetKeterangan);
      await page.waitForTimeout(1000);

      logAction.click('Tombol Simpan Status', '#btnSimpanVerif');
      await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/admin/verifikasi') && resp.status() === 200, { timeout: 15000 }),
        page.click('#btnSimpanVerif')
      ]);

      logAction.verify('Menunggu modal verifikasi tertutup...');
      await expect(modalVerif).toBeHidden({ timeout: 15000 });

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

      await page.waitForTimeout(1000);
    }

    // =========================================================================
    // LANGKAH 4.B: Uji Hapus Data Absensi (jika data sampel mencukupi)
    // =========================================================================
    let deletedSampleInfo = null;

    if (sampleToDelete) {
      console.log(`\n======================================================================`);
      console.log(`🗑️ [UJI HAPUS DATA ABSENSI] NIP: ${sampleToDelete.nip} (${sampleToDelete.nama_pegawai || '-'})`);
      console.log(`   Kode Akses Target: "${sampleToDelete.kode_akses}"`);
      console.log(`======================================================================`);

      await page.waitForTimeout(1000);

      logAction.click(`Pemicu Hapus Data Absensi (${sampleToDelete.nama_pegawai || sampleToDelete.nip})`);
      
      // Panggil fungsi hapusDataAbsensiKeseluruhan di browser
      await page.evaluate((item) => {
        hapusDataAbsensiKeseluruhan(item.nip, item.nama_pegawai, item.kode_akses);
      }, sampleToDelete);

      // Tunggu modal konfirmasi SweetAlert "Anda Yakin?" muncul
      const swalConfirmBtn = page.locator('.swal2-confirm');
      await expect(swalConfirmBtn).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      logAction.click('Konfirmasi Hapus di SweetAlert', '.swal2-confirm');
      await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/admin/rekap/entry/') && resp.request().method() === 'DELETE' && resp.status() === 200, { timeout: 15000 }),
        swalConfirmBtn.click()
      ]);

      await page.waitForTimeout(1000);

      // Tutup alert SweetAlert "Terhapus!" jika ada
      if (await swalConfirmBtn.isVisible().catch(() => false)) {
        await swalConfirmBtn.click().catch(() => {});
      }

      logAction.success(`Data NIP: ${sampleToDelete.nip} (${sampleToDelete.kode_akses}) BERHASIL DIHAPUS dari Rekap!`);
      deletedSampleInfo = {
        kodeAkses: sampleToDelete.kode_akses,
        nip: sampleToDelete.nip,
        nama: sampleToDelete.nama_pegawai
      };

      await page.waitForTimeout(1000);
    }

    console.log(`\n======================================================================`);
    console.log(`✅ Selesai verifikasi (${editedSamples.length}) & hapus (${deletedSampleInfo ? 1 : 0}) data. Membuka Menu Log Absensi...`);
    console.log(`======================================================================`);
    await page.waitForTimeout(1000);

    // =========================================================================
    // LANGKAH 5 & 6: Buka Menu Log Absensi, Cari & Bandingkan Payload JSON
    // =========================================================================
    logAction.menu('Halaman Log Absensi (bukaHalamanLogAbsensi)');
    await page.evaluate(() => bukaHalamanLogAbsensi());
    await expect(page.locator('#logAbsensiContainer')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 1. Audit Log untuk Data yang Di-verifikasi / Edit
    for (const sample of editedSamples) {
      console.log(`\n----------------------------------------------------------------------`);
      console.log(`🔍 [AUDIT LOG EDIT ${sample.index}/${editedSamples.length}] Memeriksa Log NIP: ${sample.nip} (${sample.nama})`);
      console.log(`   Kode Akses Target: ${sample.kodeAkses} | Verifikasi: ${sample.statusVerifikasi} | Keterangan: ${sample.keterangan}`);
      console.log(`----------------------------------------------------------------------`);

      logAction.input('Filter Kode Akses Kegiatan', '#logFilterKegiatan', sample.kodeAkses);
      await page.fill('#logFilterKegiatan', sample.kodeAkses);
      await page.waitForTimeout(1000);

      logAction.input('Filter NIP / Nama Pegawai', '#logFilterPegawai', sample.nip);
      await page.fill('#logFilterPegawai', sample.nip);
      await page.waitForTimeout(1000);

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
      await page.waitForTimeout(1000);

      const payloadText = await page.evaluate((nipTarget) => {
        const rows = Array.from(document.querySelectorAll('#logAbsensiTableBody tr'));
        const matchedRow = rows.find(r => r.innerText.includes(nipTarget)) || rows[0];
        if (!matchedRow) return null;
        const textarea = matchedRow.querySelector('textarea');
        return textarea ? textarea.value : matchedRow.innerText;
      }, sample.nip);

      expect(payloadText).not.toBeNull();
      console.log(`  📄 [PAYLOAD JSON LOG EDIT DITEMUKAN]:\n${payloadText}`);

      let parsedPayload = null;
      try {
        parsedPayload = JSON.parse(payloadText);
      } catch (e) {}

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

      logAction.success(`Log verifikasi untuk NIP "${sample.nip}" (${sample.statusVerifikasi} - "${sample.keterangan}") VALID!`);
      await page.waitForTimeout(1000);
    }

    // 2. Audit Log untuk Data yang Di-hapus
    if (deletedSampleInfo) {
      console.log(`\n----------------------------------------------------------------------`);
      console.log(`🔍 [AUDIT LOG HAPUS] Memeriksa Log Hapus NIP: ${deletedSampleInfo.nip} (${deletedSampleInfo.nama})`);
      console.log(`   Kode Akses Target: ${deletedSampleInfo.kodeAkses}`);
      console.log(`----------------------------------------------------------------------`);

      logAction.input('Filter Kode Akses Kegiatan', '#logFilterKegiatan', deletedSampleInfo.kodeAkses);
      await page.fill('#logFilterKegiatan', deletedSampleInfo.kodeAkses);
      await page.waitForTimeout(1000);

      logAction.input('Filter NIP / Nama Pegawai', '#logFilterPegawai', deletedSampleInfo.nip);
      await page.fill('#logFilterPegawai', deletedSampleInfo.nip);
      await page.waitForTimeout(1000);

      logAction.click('Tombol Cari Log', 'button[onclick="terapkanFilterLogAbsensi()"]');
      await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/admin/log-absensi') && resp.status() === 200, { timeout: 15000 }),
        page.click('button[onclick="terapkanFilterLogAbsensi()"]')
      ]);

      logAction.verify('Menunggu tabel log absensi memuat data log hapus...');
      await page.waitForFunction(() => {
        const tbody = document.getElementById('logAbsensiTableBody');
        if (!tbody) return false;
        const html = tbody.innerHTML;
        return html.includes('<tr') && !html.includes('spinner-border') && !html.includes('Memuat data');
      }, { timeout: 15000 });
      await page.waitForTimeout(1000);

      const payloadTextHapus = await page.evaluate((nipTarget) => {
        const rows = Array.from(document.querySelectorAll('#logAbsensiTableBody tr'));
        const matchedRow = rows.find(r => r.innerText.includes('HAPUS') || r.innerText.includes(nipTarget)) || rows[0];
        if (!matchedRow) return null;
        const textarea = matchedRow.querySelector('textarea');
        return textarea ? textarea.value : matchedRow.innerText;
      }, deletedSampleInfo.nip);

      expect(payloadTextHapus).not.toBeNull();
      console.log(`  📄 [PAYLOAD JSON LOG HAPUS DITEMUKAN]:\n${payloadTextHapus}`);

      let parsedPayloadHapus = null;
      try {
        parsedPayloadHapus = JSON.parse(payloadTextHapus);
      } catch (e) {}

      if (parsedPayloadHapus) {
        // Validasi payload hapus hanya berisi kode_akses dan nip
        expect(parsedPayloadHapus.kode_akses).toBe(deletedSampleInfo.kodeAkses);
        expect(parsedPayloadHapus.nip).toBe(deletedSampleInfo.nip);
        expect(parsedPayloadHapus.status_verifikasi).toBeUndefined();
      } else {
        expect(payloadTextHapus).toContain(deletedSampleInfo.kodeAkses);
        expect(payloadTextHapus).toContain(deletedSampleInfo.nip);
      }

      logAction.success(`Log aksi HAPUS untuk NIP "${deletedSampleInfo.nip}" (${deletedSampleInfo.kodeAkses}) VALID dan sesuai format payload hapus!`);
      await page.waitForTimeout(1000);
    }

    console.log(`\n🎉 [PENGUJIAN SELESAI] Seluruh kegiatan verifikasi & hapus data berhasil dicatat & dicocokkan dengan payload audit log!`);
  });

});
