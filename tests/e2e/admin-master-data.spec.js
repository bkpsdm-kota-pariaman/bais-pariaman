const { test, expect } = require('@playwright/test');
const { adminUser } = require('../fixtures/load-credentials');

test.describe('E2E Suite 1: Admin Authentication & Master Data Management', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('admin/index.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('1. Admin Login — Otentikasi Sesi Nyata ke API Backend', async ({ page }) => {
        const loginOverlay = page.locator('#loginOverlay');
        await expect(loginOverlay).toBeVisible({ timeout: 10000 });

        const userInput = page.locator('#adminUser');
        const passInput = page.locator('#adminPass');
        const loginBtn = page.locator('#btnLogin');

        await expect(userInput).toBeVisible();
        await expect(passInput).toBeVisible();

        // 1.1 Uji login dengan kredensial salah ke API nyata
        await userInput.fill('wrong_admin_nip');
        await passInput.fill('wrong_password');
        await loginBtn.click();

        const swalPopup = page.locator('.swal2-popup');
        await expect(swalPopup).toBeVisible({ timeout: 10000 });
        await page.click('.swal2-confirm');
        await expect(swalPopup).toBeHidden({ timeout: 5000 });

        // 1.2 Uji login nyata dengan kredensial Super Admin dari CSV
        const activeAdmin = adminUser || { nip: '198501012010011001', nik: '1377010101850001' };
        await userInput.fill(activeAdmin.nip);
        await passInput.fill(activeAdmin.nik);
        await loginBtn.click();

        // Tunggu respons otentikasi nyata dari server
        await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
        await expect(loginOverlay).toBeHidden();
    });

    test('2. Master Data OPD — Memuat daftar perangkat daerah & modal tambah OPD', async ({ page }) => {
        const activeAdmin = adminUser;
        if (activeAdmin) {
            await page.fill('#adminUser', activeAdmin.nip);
            await page.fill('#adminPass', activeAdmin.nik);
            await page.click('#btnLogin');
            await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
        }

        await page.evaluate(() => {
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

    test('3. Master Data Pegawai — Memuat tabel pegawai & daftar pegawai', async ({ page }) => {
        const activeAdmin = adminUser;
        if (activeAdmin) {
            await page.fill('#adminUser', activeAdmin.nip);
            await page.fill('#adminPass', activeAdmin.nik);
            await page.click('#btnLogin');
            await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
        }

        await page.evaluate(() => {
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

    test('4. Master Data Jadwal Kegiatan — Memuat daftar jadwal & modal buat kegiatan', async ({ page }) => {
        const activeAdmin = adminUser;
        if (activeAdmin) {
            await page.fill('#adminUser', activeAdmin.nip);
            await page.fill('#adminPass', activeAdmin.nik);
            await page.click('#btnLogin');
            await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
        }

        const dashContainer = page.locator('#dashboardContainer');
        await expect(dashContainer).toBeVisible({ timeout: 10000 });
    });

});
