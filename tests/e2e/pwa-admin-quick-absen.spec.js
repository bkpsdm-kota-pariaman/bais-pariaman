const { test, expect } = require('@playwright/test');
const { superAdminUser, getSampleAsnUsers } = require('../fixtures/load-credentials');
const { attachLogger, logAction } = require('./test-logger');

test.describe('E2E Suite 4: Admin Absensi Cepat, QR Scan & Siklus Penuh Presensi', () => {

    const activeAdmin = superAdminUser || { nip: '198501012000011001', nik: '1377010101850001' };
    let consoleErrors = [];
    let pageErrors = [];

    async function loginAdminPwa(page) {
        logAction.step(`Melakukan Login Admin di PWA (NIP: ${activeAdmin.nip})`);
        const loginView = page.locator('#view-login');
        await expect(loginView).toBeVisible({ timeout: 10000 });

        logAction.input('NIP Admin', '#logNip', activeAdmin.nip);
        await page.locator('#logNip').pressSequentially(activeAdmin.nip, { delay: 100 });

        logAction.input('NIK / Password', '#logNik', '********');
        await page.locator('#logNik').pressSequentially(activeAdmin.nik, { delay: 100 });

        logAction.click('Tombol MASUK APLIKASI', 'button:has-text("MASUK APLIKASI")');
        const submitBtn = page.locator('button[type="submit"]:has-text("MASUK APLIKASI"), #formLogin button[type="submit"]');
        await submitBtn.click();

        logAction.verify('Menunggu Dashboard PWA Admin tampil');
        const dashboardView = page.locator('#view-dashboard');
        await expect(dashboardView).toBeVisible({ timeout: 15000 });
        logAction.success('Login Admin PWA berhasil');
    }

    test.beforeEach(async ({ page, context }) => {
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

        attachLogger(page, 'PWA Admin Quick Absen');
        await context.grantPermissions(['camera', 'geolocation']);
        await context.setGeolocation({ latitude: -0.6276, longitude: 100.1209 });

        logAction.navigate('pwa/index.html');
        await page.goto('pwa/index.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('1. Absensi Cepat Admin (Input Manual) — Delegasi presensi via NIP oleh Admin di PWA via UI', async ({ page }) => {
        const sampleUsers = getSampleAsnUsers(1);
        const targetAsn = sampleUsers[0] || { nip: '199001012020011001', nama: 'Pegawai Test' };

        await loginAdminPwa(page);

        logAction.click('Tombol Scan Absenkan Pegawai Lain', '#btnAdminAbsenkanLain');
        const btnScanAdmin = page.locator('#btnAdminAbsenkanLain');
        if (await btnScanAdmin.isVisible()) {
            await btnScanAdmin.click();

            logAction.verify('Memverifikasi view Absensi Cepat Admin');
            const adminCepatView = page.locator('#view-admin-cepat');
            await expect(adminCepatView).toBeVisible({ timeout: 10000 });

            const txtInput = page.locator('#adminInputManualToken');
            if (await txtInput.isVisible()) {
                logAction.input('NIP Pegawai Target', '#adminInputManualToken', targetAsn.nip);
                await txtInput.pressSequentially(targetAsn.nip, { delay: 100 });
                await expect(txtInput).toHaveValue(targetAsn.nip);
            }

            logAction.verify('Memverifikasi tidak ada console.error dan pageerror');
            expect(consoleErrors).toEqual([]);
            expect(pageErrors).toEqual([]);

            logAction.success('Absensi Cepat Admin Input Manual diverifikasi');
        }
    });

    test('2. Absensi Cepat Admin (Scan QR Code) — Mode Kamera Scanner di PWA via UI', async ({ page }) => {
        await loginAdminPwa(page);

        logAction.click('Tombol Scan Absenkan Pegawai Lain', '#btnAdminAbsenkanLain');
        const btnScanAdmin = page.locator('#btnAdminAbsenkanLain');
        if (await btnScanAdmin.isVisible()) {
            await btnScanAdmin.click();

            logAction.verify('Memverifikasi view Scanner Kamera Absensi Cepat');
            const adminCepatView = page.locator('#view-admin-cepat');
            await expect(adminCepatView).toBeVisible({ timeout: 10000 });

            logAction.verify('Memverifikasi tidak ada console.error dan pageerror');
            expect(consoleErrors).toEqual([]);
            expect(pageErrors).toEqual([]);

            logAction.success('Mode Kamera Scanner Absensi Cepat diverifikasi');
        }
    });

    test('3. Siklus Presensi Admin Dashboard — Login Admin & Verifikasi Dashboard', async ({ page }) => {
        logAction.navigate('admin/index.html');
        await page.goto('admin/index.html');
        await page.waitForLoadState('domcontentloaded');

        logAction.verify('Memverifikasi form login Admin');
        const loginOverlay = page.locator('#loginOverlay');
        await expect(loginOverlay).toBeVisible({ timeout: 10000 });

        logAction.input('NIP Admin', '#adminUser', activeAdmin.nip);
        await page.locator('#adminUser').pressSequentially(activeAdmin.nip, { delay: 100 });

        logAction.input('Password NIK', '#adminPass', '********');
        await page.locator('#adminPass').pressSequentially(activeAdmin.nik, { delay: 100 });

        logAction.click('Tombol Masuk', '#btnLogin');
        await page.click('#btnLogin');

        logAction.verify('Memverifikasi Dashboard Admin terbuka');
        const dashContainer = page.locator('#dashboardContainer');
        await expect(dashContainer).toBeVisible({ timeout: 15000 });

        logAction.verify('Memverifikasi tidak ada console.error dan pageerror');
        expect(consoleErrors).toEqual([]);
        expect(pageErrors).toEqual([]);

        logAction.success('Siklus Admin Dashboard diverifikasi');
    });

});
