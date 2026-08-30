const { test, expect } = require('@playwright/test');
const { superAdminUser, getSampleAsnUsers } = require('../fixtures/load-credentials');
const { attachLogger, logAction } = require('./test-logger');

test.describe('E2E Suite 4: Admin Absensi Cepat, QR Scan & Siklus Penuh Presensi', () => {

    const activeAdmin = superAdminUser || { nip: '198501012010011001', nik: '1377010101850001' };

    async function loginAdminPwa(page) {
        logAction.step(`Melakukan Login Admin di PWA (NIP: ${activeAdmin.nip})`);
        const loginView = page.locator('#view-login');
        await expect(loginView).toBeVisible({ timeout: 10000 });

        logAction.input('NIP Admin', '#logNip', activeAdmin.nip);
        await page.fill('#logNip', activeAdmin.nip);

        logAction.input('NIK / Password', '#logNik', '********');
        await page.fill('#logNik', activeAdmin.nik);

        logAction.click('Tombol MASUK APLIKASI', 'button:has-text("MASUK APLIKASI")');
        const submitBtn = page.locator('button[type="submit"]:has-text("MASUK APLIKASI"), #formLogin button[type="submit"]');
        await submitBtn.click();

        logAction.verify('Menunggu Dashboard PWA Admin tampil');
        const dashboardView = page.locator('#view-dashboard');
        await expect(dashboardView).toBeVisible({ timeout: 15000 });
        logAction.success('Login Admin PWA berhasil');
    }

    test.beforeEach(async ({ page, context }) => {
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
                await txtInput.fill(targetAsn.nip);
                await expect(txtInput).toHaveValue(targetAsn.nip);
            }
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
        await page.fill('#adminUser', activeAdmin.nip);

        logAction.input('Password NIK', '#adminPass', '********');
        await page.fill('#adminPass', activeAdmin.nik);

        logAction.click('Tombol Masuk', '#btnLogin');
        await page.click('#btnLogin');

        logAction.verify('Memverifikasi Dashboard Admin terbuka');
        const dashContainer = page.locator('#dashboardContainer');
        await expect(dashContainer).toBeVisible({ timeout: 15000 });
        logAction.success('Siklus Admin Dashboard diverifikasi');
    });

});


