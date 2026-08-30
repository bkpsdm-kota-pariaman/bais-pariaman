const { test, expect } = require('@playwright/test');
const { adminUser } = require('../fixtures/load-credentials');
const { attachLogger, logAction } = require('./test-logger');

test.describe('E2E Suite: Admin CRUD Data OPD (Perangkat Daerah)', () => {

    const activeAdmin = adminUser || { nip: '198501012010011001', nik: '1377010101850001' };
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

        // HENTIKAN PROSES TEST JIKA TERJADI ERROR CONSOLE ATAU PAGE ERROR
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

        attachLogger(page, 'Admin CRUD OPD');
        logAction.navigate('admin/index.html');
        await page.goto('admin/index.html');
        await page.waitForLoadState('domcontentloaded');
        await doAdminLogin(page);
    });

    test('Full CRUD Lifecycle: Data Perangkat Daerah / OPD (Create, Read, Update, Delete)', async ({ page }) => {
        logAction.step('1. Buka Menu Data -> Perangkat Daerah (OPD)');
        logAction.click('Dropdown Menu Data', '#navbarDropdownData');
        await page.click('#navbarDropdownData');

        logAction.click('Menu Perangkat Daerah (OPD)', 'a.dropdown-item:has-text("Perangkat Daerah (OPD)")');
        await page.click('a.dropdown-item:has-text("Perangkat Daerah (OPD)")');

        logAction.verify('Memverifikasi kontainer OPD terbuka');
        const opdContainer = page.locator('#opdContainer');
        await expect(opdContainer).toBeVisible({ timeout: 10000 });

        logAction.step('2. CREATE: Buka Modal & Tambah OPD Baru');
        const btnTambahOpd = page.locator('button:has-text("Tambah OPD Baru")');
        await expect(btnTambahOpd).toBeVisible();
        logAction.click('Tombol Tambah OPD Baru', 'button:has-text("Tambah OPD Baru")');
        await btnTambahOpd.click();

        const modalOpd = page.locator('#modalOpd');
        await expect(modalOpd).toBeVisible({ timeout: 10000 });

        const randSuffix = (Math.floor(10000 + Math.random() * 90000)).toString();
        const namaOpdBaru = `OPD Test E2E ${randSuffix}`;

        const inputOpdNama = page.locator('#opdNama');
        await inputOpdNama.click();
        logAction.input('Nama OPD Baru', '#opdNama', namaOpdBaru);
        await inputOpdNama.pressSequentially(namaOpdBaru, { delay: 100 });

        logAction.click('Tombol Simpan OPD', '#btnSimpanOpd');
        await page.click('#btnSimpanOpd');

        logAction.verify('Memverifikasi modal OPD tertutup setelah disimpan');
        await expect(modalOpd).toBeHidden({ timeout: 15000 });

        logAction.step('3. READ: Verifikasi OPD Baru Tampil di Tabel #opdTableBody');
        const tableRow = page.locator('#opdTableBody tr').filter({ hasText: namaOpdBaru }).first();
        await expect(tableRow).toBeVisible({ timeout: 20000 });
        logAction.success(`OPD "${namaOpdBaru}" berhasil ditemukan di tabel opdTableBody`);

        logAction.step('4. UPDATE: Edit Nama OPD');
        const btnEdit = tableRow.locator('button.btn-outline-warning, button[onclick*="bukaModalEditOpd"]').first();
        await expect(btnEdit).toBeVisible();
        logAction.click('Tombol Edit OPD', 'Edit');
        await btnEdit.click();

        await expect(modalOpd).toBeVisible({ timeout: 10000 });

        const namaRevisi = `OPD Rev E2E ${randSuffix}`;
        logAction.input('Nama OPD Revisi', '#opdNama', namaRevisi);
        await inputOpdNama.click();
        await inputOpdNama.press('Control+A');
        await inputOpdNama.press('Backspace');
        await inputOpdNama.pressSequentially(namaRevisi, { delay: 100 });

        logAction.click('Tombol Simpan Perubahan OPD', '#btnSimpanOpd');
        await page.click('#btnSimpanOpd');

        await expect(modalOpd).toBeHidden({ timeout: 15000 });
        logAction.success('Update data OPD berhasil');

        logAction.step('5. DELETE: Hapus Data OPD');
        const targetRow = page.locator('#opdTableBody tr').filter({ hasText: namaRevisi }).first();
        await expect(targetRow).toBeVisible({ timeout: 20000 });

        const btnDelete = targetRow.locator('button.btn-outline-danger, button[onclick*="hapusOpd"]').first();
        await expect(btnDelete).toBeVisible();
        logAction.click('Tombol Hapus OPD', 'Hapus');
        await btnDelete.click();

        const swalDeleteConfirm = page.locator('.swal2-confirm');
        await expect(swalDeleteConfirm).toBeVisible({ timeout: 10000 });
        logAction.click('Konfirmasi Hapus (Ya, Hapus!)', '.swal2-confirm');
        await swalDeleteConfirm.click();

        const swalOk = page.locator('.swal2-confirm');
        if (await swalOk.isVisible({ timeout: 5000 }).catch(() => false)) {
            await swalOk.click();
        }
        logAction.success('Hapus Data OPD berhasil!');

        logAction.verify('Memverifikasi tidak ada console.error dan pageerror');
        expect(consoleErrors).toEqual([]);
        expect(pageErrors).toEqual([]);
        logAction.success('CRUD Data OPD BERHASIL SELESAI TANPA ERROR!');
    });

});
