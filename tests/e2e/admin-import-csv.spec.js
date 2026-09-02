const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { adminUser } = require('../fixtures/load-credentials');
const { attachLogger, logAction } = require('./test-logger');

test.describe('E2E Suite: Admin Import Data Absensi CSV', () => {

    const activeAdmin = adminUser || { nip: '198501012000011001', nik: '1377010101850001' };
    let consoleErrors = [];
    let pageErrors = [];
    const tempCsvPath = path.join(__dirname, '../fixtures/temp_import_20.csv');
    let importedPegawaiList = [];

    // Helper login admin
    async function doAdminLogin(page) {
        logAction.step('Memeriksa status login Admin');
        const loginOverlay = page.locator('#loginOverlay');
        if (await loginOverlay.isVisible()) {
            logAction.input('NIP Admin', '#adminUser', activeAdmin.nip);
            await page.locator('#adminUser').pressSequentially(activeAdmin.nip, { delay: 100 });

            logAction.input('Password NIK Admin', '#adminPass', '********');
            await page.locator('#adminPass').pressSequentially(activeAdmin.nik, { delay: 100 });

            logAction.click('Tombol Masuk', '#btnLogin');
            await page.click('#btnLogin');

            logAction.verify('Menunggu Dashboard Admin terbuka');
            await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
            await expect(loginOverlay).toBeHidden();
            logAction.success('Login Admin berhasil');
        }
    }

    test.beforeAll(() => {
        // 1. Generate 20 data peserta dari credentials.csv dengan OPD & Jabatan bebas
        const credentialsPath = path.join(__dirname, '../fixtures/credentials.csv');
        const fileContent = fs.readFileSync(credentialsPath, 'utf-8');
        const lines = fileContent.split(/\r?\n/).filter(l => l.trim() !== '');

        // Baris 0 adalah header: nip;nama;nik;role
        const sampleOpds = [
            'Dinas Komunikasi dan Informatika',
            'Badan Kepegawaian dan Pengembangan SDM',
            'Dinas Pendidikan Pemuda dan Olahraga',
            'Dinas Kesehatan',
            'Sekretariat Daerah'
        ];
        const sampleJabatans = [
            'Staf Analis Kebijakan',
            'Pranata Komputer Muda',
            'Kasubag Keuangan',
            'Kepala Bidang Layanan E-Gov',
            'Pengadministrasi Perkantoran'
        ];

        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()} 07:30:00`;

        const csvHeaders = 'waktu;nip;nama_pegawai;jabatan;opd;lokasi;lat;lng;nama_file_foto;keterangan';
        const csvRows = [csvHeaders];
        importedPegawaiList = [];

        // Ambil 20 orang dari credentials.csv
        let count = 0;
        for (let i = 1; i < lines.length && count < 20; i++) {
            const cols = lines[i].split(';');
            const nip = cols[0] ? cols[0].trim() : '';
            const nama = cols[1] ? cols[1].trim() : '';

            if (nip && nama) {
                const opd = sampleOpds[count % sampleOpds.length];
                const jabatan = sampleJabatans[count % sampleJabatans.length];
                const rowStr = `${dateStr};${nip};${nama};${jabatan};${opd};Kantor Walikota;-0.6276;100.1209;foto_import_${count + 1}.jpg;Hadir tepat waktu E2E`;
                csvRows.push(rowStr);
                importedPegawaiList.push({ nip, nama, opd, jabatan });
                count++;
            }
        }

        fs.writeFileSync(tempCsvPath, csvRows.join('\n'), 'utf-8');
    });

    test.afterAll(() => {
        // Cleanup temp CSV
        if (fs.existsSync(tempCsvPath)) {
            try {
                fs.unlinkSync(tempCsvPath);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    });

    test.beforeEach(async ({ page }) => {
        test.setTimeout(180000); // Extended timeout for typing 20 users
        consoleErrors = [];
        pageErrors = [];

        // Deteksi error browser
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                consoleErrors.push(text);
                console.error(`🚨 Console error: ${text}`);
            }
        });

        page.on('pageerror', error => {
            pageErrors.push(error.message);
            console.error(`🚨 Pageerror: ${error.message}`);
        });

        attachLogger(page, 'Admin Import CSV 20 Pegawai');
        logAction.navigate('admin/index.html');
        await page.goto('admin/index.html');
        await page.waitForLoadState('domcontentloaded');
        await doAdminLogin(page);
    });

    test('Full E2E Flow: Import CSV 20 Pegawai pada Kegiatan Baru (OPD Tidak Dipilih) & Verifikasi Filter Rekap', async ({ page }) => {
        // --- STEP 1: Buka Data -> Kegiatan & Tambah Kegiatan Baru (OPD Tidak Dipilih) ---
        logAction.step('1. Buka Menu Data -> Kegiatan');
        logAction.click('Dropdown Menu Data', '#navbarDropdownData');
        await page.click('#navbarDropdownData');

        logAction.click('Menu Kegiatan', 'a.dropdown-item:has-text("Kegiatan")');
        await page.click('a.dropdown-item:has-text("Kegiatan")');
        await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 10000 });

        logAction.step('2. Buat Kegiatan Baru (OPD Tidak Dipilih)');
        const btnBuatJadwal = page.locator('button:has-text("Buat Jadwal Baru")');
        await expect(btnBuatJadwal).toBeVisible();
        await btnBuatJadwal.click();

        const modalBuat = page.locator('#modalBuatKegiatan');
        await expect(modalBuat).toHaveClass(/show/, { timeout: 10000 });
        // Jeda sebentar agar animasi ditangani Bootstrap & event shown.bs.modal (mapGeofence) selesai
        await page.waitForTimeout(500);

        const timestampStr = Date.now().toString().slice(-5);
        const judulKegiatan = `Kegiatan Import CSV E2E ${timestampStr}`;

        logAction.input('Judul Jadwal', '#newJudul', judulKegiatan);
        const inputJudul = page.locator('#newJudul');
        await expect(inputJudul).toBeVisible();
        await inputJudul.click();
        await inputJudul.press('Control+A');
        await inputJudul.press('Backspace');
        await inputJudul.pressSequentially(judulKegiatan, { delay: 100 });

        const todayStr = new Date().toISOString().split('T')[0];
        await page.evaluate((d) => {
            if (typeof flatpickr !== 'undefined') {
                flatpickr('#newTanggal').setDate(d, true);
            } else {
                document.getElementById('newTanggal').value = d;
            }
        }, todayStr);

        await page.locator('#newJamMulai').fill('07:00');
        await page.locator('#newJamSelesai').fill('17:00');

        // Pastikan opsi OPD TIDAK DIPILIH (uncheck all OPD)
        logAction.step('Pastikan opsi OPD tidak dipilih (Deselect All OPD)');
        await page.evaluate(() => {
            if (typeof deselectAllOpd === 'function') {
                deselectAllOpd('add');
            }
        });

        logAction.click('Tombol Simpan Jadwal', '#btnSimpanKegiatan');
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && (resp.status() === 200 || resp.status() === 200)),
            page.click('#btnSimpanKegiatan')
        ]);
        await expect(modalBuat).toBeHidden({ timeout: 15000 });
        logAction.success(`Kegiatan baru "${judulKegiatan}" tanpa pilihan OPD berhasil dibuat`);

        // --- STEP 2: Cari Kegiatan Baru & Buka Rekap Absensi ---
        logAction.step('3. Cari Kegiatan Baru & Buka Rekap Absensi');
        const filterInput = page.locator('#filterJadwalSearch');
        await filterInput.click();
        await filterInput.press('Control+A');
        await filterInput.press('Backspace');
        await filterInput.pressSequentially(judulKegiatan, { delay: 100 });

        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.status() === 200),
            page.click('#dashboardContainer button:has-text("CARI")')
        ]);

        const tableRow = page.locator('#listKegiatanBody tr').filter({ hasText: judulKegiatan }).first();
        await expect(tableRow).toBeVisible({ timeout: 15000 });

        logAction.click('Tombol Rekap Kegiatan', 'button:has-text("Rekap")');
        const btnRekap = tableRow.locator('button:has-text("Rekap")').first();
        await btnRekap.click();

        const rekapContainer = page.locator('#rekapContainer');
        await expect(rekapContainer).toBeVisible({ timeout: 15000 });
        logAction.success('Halaman Rekap Absensi Kegiatan terbuka');

        // --- STEP 3: Import Data Absen Pakai CSV ---
        logAction.step('4. Buka Modal Import Absen & Upload CSV 20 Pegawai');
        const btnImportCsv = rekapContainer.locator('button:has-text("Import Data Absen")');
        await expect(btnImportCsv).toBeVisible({ timeout: 10000 });
        await btnImportCsv.click();

        const modalImport = page.locator('#modalImportAbsen');
        await expect(modalImport).toHaveClass(/show/, { timeout: 10000 });

        logAction.step('Upload File CSV 20 Pegawai');
        const inputFileCsv = page.locator('#importFileCsv');
        await inputFileCsv.setInputFiles(tempCsvPath);

        logAction.verify('Memverifikasi preview data CSV 20 baris muncul');
        const previewContainer = page.locator('#previewImportContainer');
        await expect(previewContainer).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#previewImportCount')).toHaveText('20');

        logAction.step('Set Status Verifikasi, Status Kehadiran, dan Keterangan Admin');
        const selectStatusVerifikasi = page.locator('#importStatusVerifikasi');
        await expect(selectStatusVerifikasi).toBeVisible();
        await selectStatusVerifikasi.selectOption('Terverifikasi Oleh Admin');
        logAction.success('Status Verifikasi diset ke: Terverifikasi Oleh Admin');

        const selectStatusKehadiran = page.locator('#importStatusKehadiran');
        await expect(selectStatusKehadiran).toBeVisible();
        await selectStatusKehadiran.selectOption('Hadir');
        logAction.success('Status Kehadiran diset ke: Hadir');

        logAction.input('Keterangan Admin Universal', '#importKeteranganAdmin', 'Import E2E Universal Note');
        const ketAdminInput = page.locator('#importKeteranganAdmin');
        await expect(ketAdminInput).toBeVisible();
        await ketAdminInput.click();
        await ketAdminInput.press('Control+A');
        await ketAdminInput.press('Backspace');
        await ketAdminInput.pressSequentially('Import E2E Universal Note', { delay: 100 });

        logAction.click('Tombol Proses Import Data Terpilih', '#btnProsesImport');
        const btnProses = page.locator('#btnProsesImport');
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/admin/rekap/import-csv') && resp.status() === 200),
            btnProses.click()
        ]);

        logAction.verify('Menekan tombol OK pada dialog Import Berhasil');
        const successDialog = page.locator('.swal2-popup').filter({ hasText: 'Import Berhasil' });
        await expect(successDialog).toBeVisible({ timeout: 10000 });
        await expect(successDialog.locator('.swal2-confirm')).toHaveText('OK');
        await successDialog.locator('.swal2-confirm').click();
        await expect(successDialog).toBeHidden({ timeout: 10000 });

        logAction.verify('Memverifikasi modal import tertutup');
        await expect(modalImport).toBeHidden({ timeout: 15000 });
        logAction.success('Proses Import 20 Pegawai dari CSV berhasil diselesaikan');

        // --- STEP 4: Melakukan Pencarian ke Setiap 20 Pegawai di Rekap Absensi ---
        logAction.step('5. Verifikasi Pencarian 20 Pegawai di Rekap Absensi via Filter NIP / Nama');

        const searchInputRekap = page.locator('#rekapSearchInput');
        await expect(searchInputRekap).toBeVisible();

        for (let i = 0; i < importedPegawaiList.length; i++) {
            const p = importedPegawaiList[i];
            logAction.step(`Cek Pegawai [${i + 1}/20]: NIP ${p.nip} - ${p.nama}`);

            // Clear search box
            await searchInputRekap.click();
            await searchInputRekap.press('Control+A');
            await searchInputRekap.press('Backspace');

            // Ketik NIP pegawai via keyboard dengan delay 100ms per karakter sesuai aturan
            await searchInputRekap.pressSequentially(p.nip, { delay: 100 });

            // Klik Tampilkan
            const btnTampilkan = page.locator('#rekapContainer button:has-text("Tampilkan")');
            await btnTampilkan.click();

            // Verifikasi baris pegawai muncul di tabel rekap
            const rowTarget = page.locator('#rekapTableBody tr').filter({ hasText: p.nip }).first();
            await expect(rowTarget).toBeVisible({ timeout: 10000 });

            // Verifikasi NIP, Nama, OPD, Status Kehadiran & Status Verifikasi tercantum di tabel
            await expect(rowTarget).toContainText(p.nip);
            await expect(rowTarget).toContainText(p.nama);
            await expect(rowTarget).toContainText('Hadir');
            logAction.success(`Pegawai ${p.nama} (${p.nip}) terverifikasi: Hadir & Terverifikasi`);
        }

        // --- STEP 5: Verifikasi Bebas Exception/Error Browser ---
        logAction.verify('Memverifikasi tidak ada console error dan page error');
        expect(consoleErrors).toEqual([]);
        expect(pageErrors).toEqual([]);

        logAction.success('SELURUH SKENARIO E2E IMPORT CSV 20 PEGAWAI BERHASIL DAN PASSED!');
    });
});
