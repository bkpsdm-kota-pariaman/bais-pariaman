const { test, expect } = require('@playwright/test');
const { superAdminUser } = require('../fixtures/load-credentials');
const { attachLogger, logAction } = require('./test-logger');

test.describe('E2E Suite: Admin Manajemen Pengaturan Aplikasi (Super Admin)', () => {

    const activeAdmin = superAdminUser || {
        nip: '199510102020021011',
        nik: '1371061010950019',
        nama: 'EGO DAFMA DASA'
    };

    let consoleErrors = [];
    let pageErrors = [];

    test.beforeEach(async ({ page }) => {
        test.setTimeout(90000);
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

        attachLogger(page, 'Admin Pengaturan Aplikasi');
    });

    test('Uji Lengkap Alur Pengaturan Aplikasi — Login Super Admin, Dialog Peringatan (Batal & Lanjutkan), dan CRUD Pengaturan', async ({ page }) => {
        // ---------------------------------------------------------------------
        // 1. Akses Halaman Admin
        // ---------------------------------------------------------------------
        logAction.step('1. Akses Halaman /admin');
        logAction.navigate('admin/index.html');
        await page.goto('admin/index.html');
        await page.waitForLoadState('domcontentloaded');

        // ---------------------------------------------------------------------
        // 2. Login Super Admin Menggunakan Kredensial dari credentials.csv
        // ---------------------------------------------------------------------
        logAction.step('2. Otentikasi Login Super Admin');
        const loginOverlay = page.locator('#loginOverlay');
        await expect(loginOverlay).toBeVisible({ timeout: 15000 });

        const userInput = page.locator('#adminUser');
        const passInput = page.locator('#adminPass');
        const loginBtn = page.locator('#btnLogin');

        logAction.input('NIP Super Admin', '#adminUser', activeAdmin.nip);
        await userInput.click();
        await userInput.press('Control+A');
        await userInput.press('Backspace');
        await userInput.pressSequentially(activeAdmin.nip, { delay: 100 });

        logAction.input('Password/NIK Super Admin', '#adminPass', '********');
        await passInput.click();
        await passInput.press('Control+A');
        await passInput.press('Backspace');
        await passInput.pressSequentially(activeAdmin.nik, { delay: 100 });

        logAction.click('Tombol Masuk', '#btnLogin');
        await loginBtn.click();

        logAction.verify('Menunggu Dashboard Admin terbuka');
        await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 20000 });
        await expect(loginOverlay).toBeHidden();
        logAction.success('Login Super Admin Berhasil');

        // ---------------------------------------------------------------------
        // 3. Pastikan Menu Pengaturan Aplikasi Muncul di Menu Data
        // ---------------------------------------------------------------------
        logAction.step('3. Memeriksa Menu Pengaturan Aplikasi pada Dropdown Data');
        const dropdownData = page.locator('#navbarDropdownData');
        await expect(dropdownData).toBeVisible();

        logAction.click('Dropdown Menu Data', '#navbarDropdownData');
        await dropdownData.click();

        const itemPengaturan = page.locator('#menuItemPengaturanAplikasi');
        await expect(itemPengaturan).toBeVisible({ timeout: 5000 });
        logAction.success('Menu Pengaturan Aplikasi muncul dan dapat diakses Super Admin');

        // ---------------------------------------------------------------------
        // 4. Klik Menu Pengaturan -> Dialog Peringatan Muncul -> Klik "Batal"
        // ---------------------------------------------------------------------
        logAction.step('4. Uji Dialog Peringatan — Klik Menu dan Pilih BATAL');
        const linkPengaturan = itemPengaturan.locator('a');
        logAction.click('Menu Pengaturan Aplikasi', '#menuItemPengaturanAplikasi a');
        await linkPengaturan.click();

        logAction.verify('Memverifikasi dialog modal SweetAlert peringatan muncul');
        const swalPopup = page.locator('.swal2-popup');
        await expect(swalPopup).toBeVisible({ timeout: 10000 });
        await expect(swalPopup).toContainText('Peringatan Pengaturan Aplikasi');
        await expect(swalPopup).toContainText('Silakan konsultasikan dengan programmer');

        const btnBatal = swalPopup.locator('.swal2-cancel');
        await expect(btnBatal).toBeVisible();
        logAction.click('Tombol Batal Dialog', '.swal2-cancel');
        await btnBatal.click();

        await expect(swalPopup).toBeHidden({ timeout: 5000 });
        logAction.verify('Memastikan halaman pengaturan TIDAK terbuka (tetap di Dashboard)');
        await expect(page.locator('#pengaturanContainer')).toBeHidden();
        await expect(page.locator('#dashboardContainer')).toBeVisible();
        logAction.success('Pembatalan berhasil: User tetap berada di Dashboard');

        // ---------------------------------------------------------------------
        // 5. Coba Lagi Klik Menu Pengaturan -> Klik "Lanjutkan"
        // ---------------------------------------------------------------------
        logAction.step('5. Uji Dialog Peringatan — Klik Menu dan Pilih LANJUTKAN');
        logAction.click('Dropdown Menu Data', '#navbarDropdownData');
        await dropdownData.click();

        logAction.click('Menu Pengaturan Aplikasi', '#menuItemPengaturanAplikasi a');
        await linkPengaturan.click();

        await expect(swalPopup).toBeVisible({ timeout: 10000 });
        const btnLanjutkan = swalPopup.locator('.swal2-confirm');
        await expect(btnLanjutkan).toBeVisible();
        logAction.click('Tombol Lanjutkan Dialog', '.swal2-confirm');
        await btnLanjutkan.click();

        await expect(swalPopup).toBeHidden({ timeout: 5000 });

        logAction.verify('Memverifikasi Halaman Penuh Pengaturan Aplikasi terbuka');
        const pengaturanContainer = page.locator('#pengaturanContainer');
        await expect(pengaturanContainer).toBeVisible({ timeout: 15000 });
        await expect(page.locator('#dashboardContainer')).toBeHidden();

        logAction.verify('Memverifikasi Banner Peringatan sangat penting di halaman pengaturan');
        await expect(pengaturanContainer.locator('.alert-warning')).toBeVisible();
        await expect(pengaturanContainer.locator('.alert-warning')).toContainText('PERINGATAN SANGAT PENTING');

        // ---------------------------------------------------------------------
        // 6. Operasi CRUD di Menu Pengaturan
        // ---------------------------------------------------------------------
        const uniqueTestKey = 'test_e2e_' + Date.now();
        const testNama = 'Pengaturan Uji E2E Otomatis';
        const testNilaiAwal = 'https://script.google.com/macros/s/TEST_E2E_AWAL/exec';
        const testNilaiBaru = 'https://script.google.com/macros/s/TEST_E2E_UPDATED/exec';

        // 6.1. CREATE (Tambah Pengaturan)
        logAction.step('6.1. CREATE: Tambah Item Pengaturan Baru');
        const btnTambah = pengaturanContainer.locator('button:has-text("Tambah Pengaturan")');
        await expect(btnTambah).toBeVisible();
        logAction.click('Tombol Tambah Pengaturan', '#pengaturanContainer button');
        await btnTambah.click();

        const modalForm = page.locator('#modalFormPengaturanItem');
        await expect(modalForm).toBeVisible({ timeout: 10000 });
        await expect(modalForm.locator('#modalFormPengaturanTitle')).toContainText('Tambah Pengaturan Baru');

        logAction.input('Nama Pengaturan', '#inpNamaPengaturan', testNama);
        const inpNama = modalForm.locator('#inpNamaPengaturan');
        await inpNama.click();
        await inpNama.pressSequentially(testNama, { delay: 100 });

        logAction.input('Kode Pengaturan', '#inpKodePengaturan', uniqueTestKey);
        const inpKode = modalForm.locator('#inpKodePengaturan');
        await inpKode.click();
        await inpKode.pressSequentially(uniqueTestKey, { delay: 100 });

        logAction.input('Nilai Pengaturan', '#inpNilaiPengaturan', testNilaiAwal);
        const inpNilai = modalForm.locator('#inpNilaiPengaturan');
        await inpNilai.click();
        await inpNilai.pressSequentially(testNilaiAwal, { delay: 100 });

        logAction.click('Tombol Simpan Form Pengaturan', '#btnSimpanFormPengaturan');
        await modalForm.locator('#btnSimpanFormPengaturan').click();

        await expect(modalForm).toBeHidden({ timeout: 15000 });
        logAction.success('Item pengaturan berhasil ditambahkan');

        // Verifikasi item baru muncul di tabel
        const tbodyPage = page.locator('#tbodyPengaturanAplikasiPage');
        const rowCreated = tbodyPage.locator(`tr:has-text("${uniqueTestKey}")`);
        await expect(rowCreated).toBeVisible({ timeout: 15000 });
        await expect(rowCreated).toContainText(testNama);
        await expect(rowCreated).toContainText(testNilaiAwal);
        logAction.success('Verifikasi CREATE: Data baru tampil di tabel pengaturan');

        // 6.2. UPDATE (Edit Pengaturan)
        logAction.step('6.2. UPDATE: Edit Nilai Pengaturan yang Baru Dibuat');
        const btnEdit = rowCreated.locator('button:has-text("Edit")');
        await expect(btnEdit).toBeVisible();
        logAction.click('Tombol Edit pada Baris', 'button:has-text("Edit")');
        await btnEdit.click();

        await expect(modalForm).toBeVisible({ timeout: 10000 });
        await expect(modalForm.locator('#modalFormPengaturanTitle')).toContainText('Edit Pengaturan');

        // Pastikan kode_pengaturan disabled pada mode edit
        await expect(inpKode).toBeDisabled();

        logAction.input('Nilai Pengaturan Diperbarui', '#inpNilaiPengaturan', testNilaiBaru);
        await inpNilai.click();
        await inpNilai.press('Control+A');
        await inpNilai.press('Backspace');
        await inpNilai.pressSequentially(testNilaiBaru, { delay: 100 });

        logAction.click('Tombol Simpan Perubahan Pengaturan', '#btnSimpanFormPengaturan');
        await modalForm.locator('#btnSimpanFormPengaturan').click();

        await expect(modalForm).toBeHidden({ timeout: 15000 });
        logAction.success('Perubahan pengaturan berhasil disimpan');

        // Verifikasi data pada tabel telah terupdate
        await expect(rowCreated).toContainText(testNilaiBaru, { timeout: 15000 });
        logAction.success('Verifikasi UPDATE: Nilai baru tampil di tabel pengaturan');

        // 6.3. DELETE (Hapus Pengaturan)
        logAction.step('6.3. DELETE: Hapus Item Pengaturan');
        const btnHapus = rowCreated.locator('button:has-text("Hapus")');
        await expect(btnHapus).toBeVisible();
        logAction.click('Tombol Hapus pada Baris', 'button:has-text("Hapus")');
        await btnHapus.click();

        // Konfirmasi dialog hapus SweetAlert
        await expect(swalPopup).toBeVisible({ timeout: 10000 });
        await expect(swalPopup).toContainText('Hapus Pengaturan?');
        await expect(swalPopup).toContainText(uniqueTestKey);

        const btnKonfirmHapus = swalPopup.locator('.swal2-confirm');
        logAction.click('Tombol Ya, Hapus!', '.swal2-confirm');
        await btnKonfirmHapus.click();

        await expect(swalPopup).toBeHidden({ timeout: 10000 });

        // Verifikasi baris tersebut sudah terhapus dari tabel
        await expect(tbodyPage.locator(`tr:has-text("${uniqueTestKey}")`)).toBeHidden({ timeout: 15000 });
        logAction.success('Verifikasi DELETE: Data berhasil terhapus dari tabel dan Worker KV');

        // ---------------------------------------------------------------------
        // 7. Verifikasi Kebersihan Console & JavaScript Runtime
        // ---------------------------------------------------------------------
        logAction.step('7. Verifikasi Error Browser Console');
        logAction.verify('Memastikan tidak ada console.error dan pageerror selama seluruh proses');
        expect(consoleErrors).toEqual([]);
        expect(pageErrors).toEqual([]);
        logAction.success('Seluruh alur pengujian selesai dengan bersih tanpa error');
    });

});
