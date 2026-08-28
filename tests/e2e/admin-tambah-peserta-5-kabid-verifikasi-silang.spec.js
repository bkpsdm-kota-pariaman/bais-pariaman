const { test, expect } = require('@playwright/test');
const { attachLogger, logAction } = require('./test-logger');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const BASE_URL = (process.env.BASE_URL || 'https://bais-pariaman.pariamankota.go.id').replace(/\/+$/, '');

test.describe('E2E Tambah 5 Peserta Kepala Bidang & Verifikasi Silang Admin', () => {

  test('Tambah 5 Pegawai (Kepala Bidang) -> Verifikasi Silang (Diterima & Ditolak) -> Cek Log Absensi Audit', async ({ page }) => {
    attachLogger(page, 'E2E 5 Kabid Verifikasi Silang');
    test.skip(!ADMIN_USER || !ADMIN_PASS, 'Set ADMIN_USER dan ADMIN_PASS di environment variables.');
    test.setTimeout(180000); // 3 menit timeout

    const timestamp = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];

    // =========================================================================
    // LANGKAH 1: ADMIN LOGIN & BUAT JADWAL KEGIATAN BARU
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

    logAction.step('Admin membuat Jadwal Uji Tambah 5 Kepala Bidang');
    await page.click('button[onclick="bukaModalBuatKegiatan()"]');
    await expect(page.locator('#modalBuatKegiatan')).toBeVisible({ timeout: 10000 });

    const judulKegiatan = `UJI 5 KABID VERIFIKASI SILANG ${timestamp}`;
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
    logAction.success(`Jadwal Berhasil Dibuat. Kode Akses: ${kodeAkses}`);

    // =========================================================================
    // LANGKAH 2: BUKA REKAP KEGIATAN & MODAL TAMBAH PESERTA
    // =========================================================================
    logAction.step(`Membuka Rekap Kegiatan untuk Kode: ${kodeAkses}`);
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes(`/admin/rekap/${kodeAkses}`) && resp.status() === 200),
      page.evaluate((kode) => {
        if (typeof lihatRekap === 'function') lihatRekap(kode);
      }, kodeAkses)
    ]);
    await expect(page.locator('#rekapContainer')).toBeVisible({ timeout: 15000 });

    logAction.step('Membuka Modal Tambah Peserta Presensi');
    await page.click('button[onclick="bukaModalTambahPeserta()"]');
    const modalTambah = page.locator('#modalTambahPeserta');
    await expect(modalTambah).toBeVisible({ timeout: 10000 });

    // =========================================================================
    // LANGKAH 3: CARI DENGAN KATA KUNCI "Kepala Bidang" & PILIH 5 ORANG
    // =========================================================================
    const searchKeyword = 'Kepala Bidang';
    logAction.input('Cari Pegawai dengan Jabatan', '#tambahPesertaSearch', searchKeyword);
    await page.fill('#tambahPesertaSearch', searchKeyword);

    const [respEligible] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes(`/admin/rekap/eligible-pegawai/${kodeAkses}`) && resp.status() === 200),
      page.evaluate(() => {
        if (typeof cariEligiblePegawai === 'function') cariEligiblePegawai();
      })
    ]);
    const jsonEligible = await respEligible.json();
    expect(jsonEligible.status).toBe(true);
    expect(jsonEligible.data.length).toBeGreaterThanOrEqual(5);

    // Ambil 5 pegawai pertama hasil pencarian
    const list5Pegawai = await page.evaluate(() => {
      const top5 = tambahPesertaState.available.slice(0, 5);
      top5.forEach(p => movePegawai(p.nip, 'select'));
      return top5;
    });

    console.log('\n  👥 [5 PEGAWAI KEPALA BIDANG YANG DIPILIH]:');
    list5Pegawai.forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.nama_pegawai} | NIP: ${p.nip} | Jabatan: ${p.jabatan} | OPD: ${p.perangkat_daerah}`);
    });

    expect(list5Pegawai.length).toBe(5);

    // Set Status Kehadiran Awal: 'Hadir'
    logAction.select('Status Kehadiran Awal', '#bulkStatusKehadiran', 'Hadir');
    await page.selectOption('#bulkStatusKehadiran', 'Hadir');
    await page.evaluate(() => {
      if (typeof toggleBulkVerifikasi === 'function') toggleBulkVerifikasi();
    });
    await page.fill('#bulkKeterangan', `Input massal 5 Kepala Bidang E2E ${timestamp}`);

    // =========================================================================
    // LANGKAH 4: SIMPAN PENAMBAHAN 5 PESERTA SECARA MASSAL
    // =========================================================================
    logAction.step('Menyimpan 5 Peserta Kepala Bidang ke Rekap Kegiatan...');
    const [respBulk] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes(`/admin/rekap/entry/bulk/${kodeAkses}`) && [200, 201].includes(resp.status())),
      page.click('#btnSimpanTambahPeserta')
    ]);
    const jsonBulk = await respBulk.json();
    expect(jsonBulk.status).toBe(true);
    logAction.success(`Berhasil Tambah 5 Peserta! Pesan: ${jsonBulk.message}`);

    // Tutup dialog SweetAlert sukses
    await page.click('.swal2-confirm').catch(() => {});
    await expect(modalTambah).toBeHidden({ timeout: 10000 });

    // =========================================================================
    // LANGKAH 5: VERIFIKASI SILANG 5 PEGAWAI (DITERIMA / DITOLAK BERGANTIAN)
    // =========================================================================
    // Pola Verifikasi Silang:
    // Pegawai 1: Terverifikasi Oleh Admin (Diterima)
    // Pegawai 2: Ditolak Oleh Admin (Ditolak)
    // Pegawai 3: Terverifikasi Oleh Admin (Diterima)
    // Pegawai 4: Ditolak Oleh Admin (Ditolak)
    // Pegawai 5: Terverifikasi Oleh Admin (Diterima)
    const skemaVerifikasi = [
      { status: 'Terverifikasi Oleh Admin', label: 'DITERIMA', alasan: 'Surat tugas valid & hadir tepat waktu' },
      { status: 'Ditolak Oleh Admin', label: 'DITOLAK', alasan: 'Tanpa konfirmasi kehadiran resmi' },
      { status: 'Terverifikasi Oleh Admin', label: 'DITERIMA', alasan: 'Laporan kegiatan dinas lengkap' },
      { status: 'Ditolak Oleh Admin', label: 'DITOLAK', alasan: 'Bukti dukung tidak sesuai ketentuan' },
      { status: 'Terverifikasi Oleh Admin', label: 'DITERIMA', alasan: 'Disahkan hadir apel pagi' }
    ];

    for (let i = 0; i < list5Pegawai.length; i++) {
      const peg = list5Pegawai[i];
      const skema = skemaVerifikasi[i];
      const catatanAdmin = `[${skema.label}] Pegawai NIP ${peg.nip} - ${skema.alasan} (E2E ${timestamp})`;

      logAction.step(`Verifikasi Pegawai ${i + 1}/5: ${peg.nama_pegawai} (NIP: ${peg.nip}) -> ${skema.label}`);

      // Filter tabel rekap berdasarkan NIP
      await page.fill('#rekapSearchInput', peg.nip);
      await Promise.all([
        page.waitForResponse(resp => resp.url().includes(`/admin/rekap/details/${kodeAkses}`) && resp.status() === 200),
        page.click('button[onclick="terapkanFilterRekap()"]')
      ]);

      await page.waitForFunction(() => {
        const tbody = document.getElementById('rekapTableBody');
        return tbody && tbody.querySelector('tr') && !tbody.innerHTML.includes('spinner') && !tbody.innerHTML.includes('Memuat data');
      }, { timeout: 15000 });

      // Klik tombol Edit / Verifikasi Status
      const btnEditStatus = page.locator('#rekapTableBody tr button[onclick*="bukaModalVerifikasi"]').first();
      await expect(btnEditStatus).toBeVisible({ timeout: 10000 });
      await btnEditStatus.click();

      // Modal verifikasi terbuka
      const modalVerif = page.locator('#modalVerifikasi');
      await expect(modalVerif).toBeVisible({ timeout: 10000 });

      // Pilih Status Verifikasi & Keterangan Admin
      logAction.select('Status Verifikasi', '#verifStatus', skema.status);
      await page.selectOption('#verifStatus', skema.status);
      await page.fill('#verifKeterangan', catatanAdmin);

      // Simpan verifikasi
      const [respVerif] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/admin/verifikasi') && resp.status() === 200),
        page.click('#btnSimpanVerif')
      ]);
      const jsonVerif = await respVerif.json();
      expect(jsonVerif.status).toBe(true);

      await expect(modalVerif).toBeHidden({ timeout: 10000 });
      logAction.success(`Verifikasi ${skema.label} untuk NIP ${peg.nip} berhasil disimpan!`);
      await page.waitForTimeout(500);
    }

    // =========================================================================
    // LANGKAH 6: CEK LOG ABSENSI AUDIT
    // =========================================================================
    logAction.step('Membuka Halaman Log Absensi Audit...');
    await page.evaluate(() => {
      if (typeof bukaHalamanLogAbsensi === 'function') bukaHalamanLogAbsensi();
    });
    await expect(page.locator('#logAbsensiContainer')).toBeVisible({ timeout: 15000 });

    logAction.input('Filter Kode Kegiatan Log Absensi', '#logFilterKegiatan', kodeAkses);
    await page.fill('#logFilterKegiatan', kodeAkses);

    const [respLog] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/admin/log-absensi') && resp.status() === 200),
      page.click('button[onclick="terapkanFilterLogAbsensi()"]')
    ]);
    const jsonLog = await respLog.json();
    expect(jsonLog.status).toBe(true);

    await page.waitForFunction(() => {
      const tbody = document.getElementById('logAbsensiTableBody');
      return tbody && tbody.querySelector('tr') && !tbody.innerHTML.includes('spinner') && !tbody.innerHTML.includes('Memuat data');
    }, { timeout: 15000 });

    const logRows = page.locator('#logAbsensiTableBody tr');
    const logRowCount = await logRows.count();
    expect(logRowCount).toBeGreaterThanOrEqual(5);

    console.log(`\n  📜 [LOG ABSENSI AUDIT DITEMUKAN: ${logRowCount} ENTRI]:`);
    for (let r = 0; r < Math.min(logRowCount, 5); r++) {
      const rowText = await logRows.nth(r).innerText();
      console.log(`   [Log ${r + 1}]: ${rowText.replace(/\s+/g, ' ')}`);
    }

    // Pastikan NIP kepala bidang tercatat di dalam response log audit
    const allLogNips = jsonLog.data.data.map(l => l.nip);
    list5Pegawai.forEach(p => {
      const isRecorded = allLogNips.includes(p.nip);
      expect(isRecorded).toBe(true);
      console.log(`  ✅ NIP ${p.nip} (${p.nama_pegawai}) terverifikasi ada di Log Audit.`);
    });

    logAction.success('SELURUH PENGUJIAN 5 KEPALA BIDANG, VERIFIKASI SILANG & LOG AUDIT SUKSES 100%!');
  });
});
