const { test, expect } = require('@playwright/test');
const { attachLogger, logAction } = require('./test-logger');

test.describe('E2E Suite 6: PWA Absensi Cadangan Internal Mandiri', () => {

    let consoleErrors = [];
    let pageErrors = [];

    test.beforeEach(async ({ page, context }) => {
        test.setTimeout(120000);
        consoleErrors = [];
        pageErrors = [];

        // HENTIKAN DAN GAGALKAN TEST PROSES SECARA LANGSUNG JIKA TERJADI ERROR CONSOLE ATAU PAGE ERROR
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                consoleErrors.push(text);
                console.error(`🚨 [STOP PROSES TEST] Console error dideteksi pada browser: ${text}`);
                throw new Error(`[CRITICAL - TEST STOPPED] Console error dideteksi pada browser: ${text}`);
            }
        });

        page.on('pageerror', error => {
            pageErrors.push(error.message);
            console.error(`🚨 [STOP PROSES TEST] Page uncaught error dideteksi: ${error.message}`);
            throw new Error(`[CRITICAL - TEST STOPPED] Page uncaught error dideteksi pada browser: ${error.message}`);
        });

        attachLogger(page, 'PWA Absensi Cadangan');
        await context.grantPermissions(['camera', 'geolocation']);
        await context.setGeolocation({ latitude: -0.6276, longitude: 100.1209 });
    });

    test('1. Absensi Cadangan Manual Internal — Pengisian biodata, upload foto, preview & verifikasi receipt', async ({ page }) => {
        const targetUrl = 'absensi-cadangan/cadangan.html';

        logAction.step('1. Mengakses URL Halaman Absensi Cadangan Internal');
        logAction.navigate(targetUrl);
        await page.goto(targetUrl);
        await page.waitForLoadState('domcontentloaded');

        logAction.verify('Memverifikasi tampilan formulir Absensi Cadangan');
        const formView = page.locator('#viewForm');
        await expect(formView).toBeVisible({ timeout: 15000 });

        logAction.step('2. Mengisi Biodata Diri & Alasan Absensi Cadangan (Awal)');
        
        const testData = {
            kode: '1F0442',
            namaKegiatan: 'Apel Gabungan ASN Pemko Pariaman',
            nip: '199510102020121011',
            nama: 'EGO DAFMA DASA',
            jabatan: 'Analis SDM Aparatur Ahli Pertama',
            opd: 'BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA',
            alasanValue: 'Aplikasi tidak bisa terbuka (force close)'
        };

        logAction.input('Kode Akses Kegiatan', '#inpKode', testData.kode);
        await page.locator('#inpKode').pressSequentially(testData.kode, { delay: 100 });

        logAction.input('Nama Kegiatan', '#inpNamaKegiatan', testData.namaKegiatan);
        await page.locator('#inpNamaKegiatan').pressSequentially(testData.namaKegiatan, { delay: 100 });

        logAction.input('NIP Pegawai', '#inpNip', testData.nip);
        await page.locator('#inpNip').pressSequentially(testData.nip, { delay: 100 });

        logAction.input('Nama Pegawai (Tanpa Gelar)', '#inpNama', testData.nama);
        await page.locator('#inpNama').pressSequentially(testData.nama, { delay: 100 });

        logAction.input('Jabatan', '#inpJabatan', testData.jabatan);
        await page.locator('#inpJabatan').pressSequentially(testData.jabatan, { delay: 100 });

        logAction.select('Perangkat Daerah (OPD)', '#inpOpd', testData.opd);
        await page.selectOption('#inpOpd', testData.opd);

        logAction.check('Alasan Memakai Absensi Cadangan', `input[value="${testData.alasanValue}"]`);
        await page.check(`input[value="${testData.alasanValue}"]`);

        logAction.step('3. Mengunggah File Foto & Memverifikasi Tombol "PAKAI FOTO INI" (Awal)');

        const dummyJpegBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
        const dummyJpegBuffer = Buffer.from(dummyJpegBase64, 'base64');

        logAction.click('Input Upload File Foto Selfie', '#inpFotoFile');
        await page.setInputFiles('#inpFotoFile', {
            name: 'foto-selfie-test.jpg',
            mimeType: 'image/jpeg',
            buffer: dummyJpegBuffer
        });

        logAction.verify('Memverifikasi kotak preview foto selfie tampil');
        const boxPreview = page.locator('#boxPreviewFoto');
        await expect(boxPreview).toBeVisible({ timeout: 10000 });

        logAction.verify('Memverifikasi elemen gambar preview #imgPreview');
        const imgPreview = page.locator('#imgPreview');
        await expect(imgPreview).toBeVisible();

        logAction.click('Tombol PAKAI FOTO INI', '#btnPakaiFoto');
        const btnPakai = page.locator('#btnPakaiFoto');
        await expect(btnPakai).toBeVisible();
        await btnPakai.click();

        logAction.verify('Memverifikasi indikator Foto Siap Digunakan muncul (warna hijau)');
        const statusTerkonfirmasi = page.locator('#statusFotoTerkonfirmasi');
        await expect(statusTerkonfirmasi).toBeVisible({ timeout: 8000 });

        logAction.step('4. Mengosongkan & Reset Seluruh Data Form & Foto');

        logAction.info('Mengosongkan input teks menggunakan Control+A + Backspace');
        const textInputIds = ['#inpKode', '#inpNamaKegiatan', '#inpNip', '#inpNama', '#inpJabatan'];
        for (const id of textInputIds) {
            const loc = page.locator(id);
            await loc.click();
            await loc.press('Control+A');
            await loc.press('Backspace');
            await expect(loc).toHaveValue('');
        }

        logAction.info('Melakukan reset input file foto dan preview foto selfie');
        await page.setInputFiles('#inpFotoFile', []);
        await page.evaluate(() => {
            const elFoto = document.getElementById('fotoBase64');
            if (elFoto) elFoto.value = '';
            const elBoxPrev = document.getElementById('boxPreviewFoto');
            if (elBoxPrev) elBoxPrev.classList.add('hidden-view');
            const elBoxPilih = document.getElementById('boxPilihFoto');
            if (elBoxPilih) elBoxPilih.classList.remove('hidden-view');
            const elStatus = document.getElementById('statusFotoTerkonfirmasi');
            if (elStatus) elStatus.classList.add('hidden-view');
            if (typeof fotoTerkonfirmasi !== 'undefined') {
                fotoTerkonfirmasi = false;
            }
        });

        logAction.verify('Memverifikasi kotak pilih foto awal tampil kembali');
        await expect(page.locator('#boxPilihFoto')).toBeVisible();
        await expect(boxPreview).toBeHidden();

        logAction.step('5. Mengisi Ulang Biodata Diri & Foto dari Awal (Pengetikan 100ms/char)');

        logAction.input('Kode Akses Kegiatan', '#inpKode', testData.kode);
        await page.locator('#inpKode').pressSequentially(testData.kode, { delay: 100 });

        logAction.input('Nama Kegiatan', '#inpNamaKegiatan', testData.namaKegiatan);
        await page.locator('#inpNamaKegiatan').pressSequentially(testData.namaKegiatan, { delay: 100 });

        logAction.input('NIP Pegawai', '#inpNip', testData.nip);
        await page.locator('#inpNip').pressSequentially(testData.nip, { delay: 100 });

        logAction.input('Nama Pegawai (Tanpa Gelar)', '#inpNama', testData.nama);
        await page.locator('#inpNama').pressSequentially(testData.nama, { delay: 100 });

        logAction.input('Jabatan', '#inpJabatan', testData.jabatan);
        await page.locator('#inpJabatan').pressSequentially(testData.jabatan, { delay: 100 });

        logAction.select('Perangkat Daerah (OPD)', '#inpOpd', testData.opd);
        await page.selectOption('#inpOpd', testData.opd);

        logAction.check('Alasan Memakai Absensi Cadangan', `input[value="${testData.alasanValue}"]`);
        await page.check(`input[value="${testData.alasanValue}"]`);

        logAction.click('Input Upload File Foto Selfie (Pengulangan)', '#inpFotoFile');
        await page.setInputFiles('#inpFotoFile', {
            name: 'foto-selfie-test.jpg',
            mimeType: 'image/jpeg',
            buffer: dummyJpegBuffer
        });

        await expect(boxPreview).toBeVisible({ timeout: 10000 });
        await btnPakai.click();
        await expect(statusTerkonfirmasi).toBeVisible({ timeout: 8000 });

        logAction.step('6. Mengirimkan Formulir Absensi Cadangan');
        logAction.click('Tombol SIMPAN ABSENSI CADANGAN', '#btnSubmit');
        const btnSubmit = page.locator('#btnSubmit');
        await btnSubmit.click();

        logAction.step('7. Memverifikasi Tampilan Receipt Bukti Absensi & Data Diri');
        logAction.verify('Menunggu tampilan Struk Bukti Absensi (#receiptView)');
        const receiptView = page.locator('#receiptView');
        await expect(receiptView).toBeVisible({ timeout: 60000 });

        logAction.verify('Memverifikasi Waktu Presensi di Receipt');
        await expect(page.locator('#rcpWaktu')).not.toBeEmpty();

        logAction.verify('Memverifikasi Kode Akses di Receipt');
        await expect(page.locator('#rcpKode')).toContainText(testData.kode);

        logAction.verify('Memverifikasi Nama Kegiatan di Receipt');
        await expect(page.locator('#rcpNamaKegiatan')).toContainText(testData.namaKegiatan);

        logAction.verify('Memverifikasi Nama Pegawai di Receipt');
        await expect(page.locator('#rcpNama')).toContainText(testData.nama);

        logAction.verify('Memverifikasi NIP Pegawai di Receipt');
        await expect(page.locator('#rcpNip')).toContainText(testData.nip);

        logAction.verify('Memverifikasi Jabatan di Receipt');
        await expect(page.locator('#rcpJabatan')).toContainText(testData.jabatan);

        logAction.verify('Memverifikasi Perangkat Daerah (OPD) di Receipt');
        await expect(page.locator('#rcpOpd')).toContainText(testData.opd);

        logAction.verify('Memverifikasi Alasan Kendala di Receipt');
        await expect(page.locator('#rcpKeterangan')).toContainText(testData.alasanValue);

        logAction.verify('Memverifikasi kontainer QR Code Bukti Kehadiran');
        const qrContainer = page.locator('#receiptQrContainer');
        await expect(qrContainer).toBeVisible();

        logAction.step('8. Memverifikasi Kebersihan Console & Uncaught Error Browser');
        logAction.verify('Memverifikasi tidak ada console.error dan pageerror');
        expect(consoleErrors).toEqual([]);
        expect(pageErrors).toEqual([]);

        logAction.success('Pengujian E2E Absensi Cadangan Internal BERHASIL 100%!');
    });

});
