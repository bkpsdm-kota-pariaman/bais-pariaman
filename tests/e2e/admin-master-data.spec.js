const { test, expect } = require('@playwright/test');
const { adminUser } = require('../fixtures/load-credentials');
const { attachLogger, logAction } = require('./test-logger');

test.describe('E2E Suite 1: Admin Authentication & Master Data Management', () => {

    const activeAdmin = adminUser || { nip: '198501012000011001', nik: '1377010101850001' };
    let consoleErrors = [];
    let pageErrors = [];

    async function doAdminLogin(page) {
        logAction.step('Memeriksa status login Admin');
        const loginOverlay = page.locator('#loginOverlay');
        if (await loginOverlay.isVisible()) {
            logAction.input('Username/NIP Admin', '#adminUser', activeAdmin.nip);
            await page.locator('#adminUser').pressSequentially(activeAdmin.nip, { delay: 100 });

            logAction.input('Password/NIK Admin', '#adminPass', '********');
            await page.locator('#adminPass').pressSequentially(activeAdmin.nik, { delay: 100 });

            logAction.click('Tombol Masuk', '#btnLogin');
            await page.click('#btnLogin');

            logAction.verify('Menunggu Dashboard Admin terbuka');
            await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
            await expect(loginOverlay).toBeHidden();
            logAction.success('Login Admin berhasil, Dashboard terbuka');
        }
    }

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

        attachLogger(page, 'Admin Master Data');
        logAction.navigate('admin/index.html');
        await page.goto('admin/index.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('1. Admin Login — Otentikasi Sesi Nyata ke API Backend', async ({ page }) => {
        logAction.step('Uji Coba 1.1: Login Kredensial Salah');
        const loginOverlay = page.locator('#loginOverlay');
        await expect(loginOverlay).toBeVisible({ timeout: 10000 });

        const userInput = page.locator('#adminUser');
        const passInput = page.locator('#adminPass');
        const loginBtn = page.locator('#btnLogin');

        await expect(userInput).toBeVisible();
        await expect(passInput).toBeVisible();

        logAction.input('NIP Salah', '#adminUser', 'wrong_admin_nip');
        await userInput.pressSequentially('wrong_admin_nip', { delay: 100 });

        logAction.input('Password Salah', '#adminPass', 'wrong_password');
        await passInput.pressSequentially('wrong_password', { delay: 100 });

        logAction.click('Tombol Masuk', '#btnLogin');
        await loginBtn.click();

        logAction.verify('Memverifikasi popup pesan error otentikasi muncul');
        const swalPopup = page.locator('.swal2-popup');
        await expect(swalPopup).toBeVisible({ timeout: 10000 });

        logAction.click('Tombol OK Dialog', '.swal2-confirm');
        await page.click('.swal2-confirm');
        await expect(swalPopup).toBeHidden({ timeout: 5000 });

        logAction.step('Uji Coba 1.2: Login Nyata Kredensial Super Admin dari CSV');
        logAction.input('NIP Admin Nyata', '#adminUser', activeAdmin.nip);
        await userInput.click();
        await userInput.press('Control+A');
        await userInput.press('Backspace');
        await userInput.pressSequentially(activeAdmin.nip, { delay: 100 });

        logAction.input('Password NIK Nyata', '#adminPass', '********');
        await passInput.click();
        await passInput.press('Control+A');
        await passInput.press('Backspace');
        await passInput.pressSequentially(activeAdmin.nik, { delay: 100 });

        logAction.click('Tombol Masuk', '#btnLogin');
        await loginBtn.click();

        logAction.verify('Menunggu respons server backend & Dashboard ditampilkan');
        await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
        await expect(loginOverlay).toBeHidden();

        logAction.verify('Memverifikasi tidak ada console.error dan pageerror');
        expect(consoleErrors).toEqual([]);
        expect(pageErrors).toEqual([]);

        logAction.success('Login Admin berhasil diverifikasi');
    });

    test('2. Master Data OPD — Memuat daftar perangkat daerah & modal tambah OPD via UI Navbar', async ({ page }) => {
        await doAdminLogin(page);

        logAction.menu('Data -> Perangkat Daerah (OPD)');
        logAction.click('Dropdown Menu Data', '#navbarDropdownData');
        await page.click('#navbarDropdownData');

        logAction.click('Menu Perangkat Daerah (OPD)', 'a:has-text("Perangkat Daerah (OPD)")');
        await page.click('a.dropdown-item:has-text("Perangkat Daerah (OPD)")');

        logAction.verify('Memverifikasi kontainer OPD tampil');
        const opdContainer = page.locator('#opdContainer');
        await expect(opdContainer).toBeVisible({ timeout: 10000 });

        logAction.click('Tombol Tambah OPD Baru', 'button:has-text("Tambah OPD Baru")');
        const btnTambahOpd = page.locator('button:has-text("Tambah OPD Baru")');
        await expect(btnTambahOpd).toBeVisible();
        await btnTambahOpd.click();

        logAction.verify('Memverifikasi modal form Tambah OPD terbuka');
        const modalOpd = page.locator('#modalOpd');
        await expect(modalOpd).toBeVisible({ timeout: 5000 });

        logAction.click('Tutup Modal Tambah OPD', '#modalOpd .btn-close');
        await page.click('#modalOpd button[data-bs-dismiss="modal"], #modalOpd .btn-close');
        await expect(modalOpd).toBeHidden({ timeout: 5000 });

        logAction.verify('Memverifikasi tidak ada console.error dan pageerror');
        expect(consoleErrors).toEqual([]);
        expect(pageErrors).toEqual([]);

        logAction.success('Master Data OPD berhasil diverifikasi');
    });

    test('3. Master Data Pegawai — Memuat tabel pegawai & modal tambah pegawai via UI Navbar', async ({ page }) => {
        await doAdminLogin(page);

        logAction.menu('Data -> Pegawai');
        logAction.click('Dropdown Menu Data', '#navbarDropdownData');
        await page.click('#navbarDropdownData');

        logAction.click('Menu Pegawai', 'a:has-text("Pegawai")');
        await page.click('a.dropdown-item:has-text("Pegawai")');

        logAction.verify('Memverifikasi kontainer Manajemen Pegawai tampil');
        const pegawaiContainer = page.locator('#pegawaiContainer');
        await expect(pegawaiContainer).toBeVisible({ timeout: 10000 });

        logAction.click('Tombol Tambah Pegawai', 'button:has-text("Tambah Pegawai")');
        const btnTambahPegawai = page.locator('button:has-text("Tambah Pegawai")');
        await expect(btnTambahPegawai).toBeVisible();
        await btnTambahPegawai.click();

        logAction.verify('Memverifikasi modal form Tambah Pegawai terbuka');
        const modalPegawai = page.locator('#modalPegawai');
        await expect(modalPegawai).toBeVisible({ timeout: 5000 });

        logAction.click('Tutup Modal Tambah Pegawai', '#modalPegawai .btn-close');
        await page.click('#modalPegawai button[data-bs-dismiss="modal"], #modalPegawai .btn-close');
        await expect(modalPegawai).toBeHidden({ timeout: 5000 });

        logAction.verify('Memverifikasi tidak ada console.error dan pageerror');
        expect(consoleErrors).toEqual([]);
        expect(pageErrors).toEqual([]);

        logAction.success('Master Data Pegawai berhasil diverifikasi');
    });

    test('4. Master Data Jadwal Kegiatan — Memuat daftar jadwal & modal buat kegiatan via UI Navbar', async ({ page }) => {
        await doAdminLogin(page);

        logAction.menu('Data -> Kegiatan');
        logAction.click('Dropdown Menu Data', '#navbarDropdownData');
        await page.click('#navbarDropdownData');

        logAction.click('Menu Kegiatan', 'a:has-text("Kegiatan")');
        await page.click('a.dropdown-item:has-text("Kegiatan")');

        logAction.verify('Memverifikasi kontainer Daftar Jadwal tampil');
        const dashContainer = page.locator('#dashboardContainer');
        await expect(dashContainer).toBeVisible({ timeout: 10000 });

        logAction.click('Tombol Buat Jadwal Baru', 'button:has-text("Buat Jadwal Baru")');
        const btnBuatJadwal = page.locator('button:has-text("Buat Jadwal Baru")');
        await expect(btnBuatJadwal).toBeVisible();
        await btnBuatJadwal.click();

        logAction.verify('Memverifikasi modal form Buat Jadwal terbuka');
        const modalBuatKegiatan = page.locator('#modalBuatKegiatan');
        await expect(modalBuatKegiatan).toHaveClass(/show/, { timeout: 10000 });

        logAction.click('Tutup Modal Buat Jadwal', '#modalBuatKegiatan .btn-close');
        await page.locator('#modalBuatKegiatan .btn-close').click();
        await expect(modalBuatKegiatan).toBeHidden({ timeout: 10000 });

        logAction.verify('Memverifikasi tidak ada console.error dan pageerror');
        expect(consoleErrors).toEqual([]);
        expect(pageErrors).toEqual([]);

        logAction.success('Master Data Jadwal Kegiatan berhasil diverifikasi');
    });

});
