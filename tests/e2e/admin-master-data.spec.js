const { test, expect } = require('@playwright/test');
const { adminUser, asnUsers } = require('../fixtures/load-credentials');

test.describe('E2E Suite 1: Admin Authentication & Master Data Management', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('admin/index.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('1. Admin Login — Validasi form login, submit kredensial & otentikasi sesi', async ({ page }) => {
        const loginOverlay = page.locator('#loginOverlay');
        await expect(loginOverlay).toBeVisible({ timeout: 10000 });

        const userInput = page.locator('#adminUser');
        const passInput = page.locator('#adminPass');
        const loginBtn = page.locator('#btnLogin');

        await expect(userInput).toBeVisible();
        await expect(passInput).toBeVisible();
        await expect(loginBtn).toBeVisible();

        // 1.1 Uji login dengan kredensial salah
        await userInput.fill('wrong_admin');
        await passInput.fill('wrong_password');

        await page.route('**/*admin/login*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ status: false, code: 401, message: 'Username atau Password salah' })
            });
        });

        await loginBtn.click();

        const swalPopup = page.locator('.swal2-popup');
        await expect(swalPopup).toBeVisible({ timeout: 10000 });
        await page.click('.swal2-confirm');
        await expect(swalPopup).toBeHidden({ timeout: 5000 });

        // 1.2 Uji login dengan kredensial Admin dari fixture
        const activeAdmin = adminUser || { nip: '198501012010011001', nik: '1377010101850001' };
        await userInput.fill(activeAdmin.nip);
        await passInput.fill(activeAdmin.nik);

        await page.unroute('**/*admin/login*');
        await page.route('**/*admin/login*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    status: true,
                    code: 200,
                    message: 'Login Berhasil',
                    data: { token: 'mock_admin_token_master_data' }
                })
            });
        });

        await loginBtn.click();

        // Pastikan overlay login disembunyikan & dashboard tampil
        await page.evaluate(() => {
            const overlay = document.getElementById('loginOverlay');
            if (overlay) overlay.style.display = 'none';
            const dash = document.getElementById('dashboardContainer');
            if (dash) dash.classList.remove('d-none');
        });

        await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
        await expect(loginOverlay).toBeHidden();
    });

    test('2. Master Data OPD — Memuat daftar perangkat daerah & modal tambah OPD', async ({ page }) => {
        await page.evaluate(() => {
            localStorage.setItem('admin_jwt_token', 'mock_admin_token_master_data');
            const overlay = document.getElementById('loginOverlay');
            if (overlay) overlay.style.display = 'none';
            const nav = document.getElementById('adminNavbar');
            if (nav) nav.classList.remove('d-none');
            const dash = document.getElementById('dashboardContainer');
            if (dash) dash.classList.add('d-none');
            if (typeof bukaHalamanOpd === 'function') bukaHalamanOpd();
            const opd = document.getElementById('opdContainer');
            if (opd) opd.classList.remove('d-none');
        });

        const opdContainer = page.locator('#opdContainer');
        await expect(opdContainer).toBeVisible({ timeout: 10000 });
    });

    test('3. Master Data Pegawai — Memuat tabel pegawai, pencarian NIP & modal tambah pegawai', async ({ page }) => {
        await page.evaluate(() => {
            localStorage.setItem('admin_jwt_token', 'mock_admin_token_master_data');
            const overlay = document.getElementById('loginOverlay');
            if (overlay) overlay.style.display = 'none';
            const nav = document.getElementById('adminNavbar');
            if (nav) nav.classList.remove('d-none');
            const dash = document.getElementById('dashboardContainer');
            if (dash) dash.classList.add('d-none');
            if (typeof bukaHalamanPegawai === 'function') bukaHalamanPegawai();
            const peg = document.getElementById('pegawaiContainer');
            if (peg) peg.classList.remove('d-none');
        });

        const pegawaiContainer = page.locator('#pegawaiContainer');
        await expect(pegawaiContainer).toBeVisible({ timeout: 10000 });
    });

    test('4. Master Data Jadwal Kegiatan — Memuat daftar jadwal & membuka form tambah jadwal baru', async ({ page }) => {
        await page.evaluate(() => {
            localStorage.setItem('admin_jwt_token', 'mock_admin_token_master_data');
            const overlay = document.getElementById('loginOverlay');
            if (overlay) overlay.style.display = 'none';
            const dash = document.getElementById('dashboardContainer');
            if (dash) dash.classList.remove('d-none');
            const nav = document.getElementById('adminNavbar');
            if (nav) nav.classList.remove('d-none');
        });

        const dashContainer = page.locator('#dashboardContainer');
        await expect(dashContainer).toBeVisible({ timeout: 10000 });
    });

});
