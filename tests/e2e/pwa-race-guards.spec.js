const { test, expect } = require('@playwright/test');
const { getSampleAsnUsers } = require('../fixtures/load-credentials');
const { attachLogger, logAction } = require('./test-logger');

test.describe('E2E Suite 5: PWA Race Conditions & Concurrency Guards', () => {

    test.beforeEach(async ({ page, context }) => {
        attachLogger(page, 'PWA Race Guards');
        await context.grantPermissions(['camera', 'geolocation']);
        await context.setGeolocation({ latitude: -0.6276, longitude: 100.1209 });

        logAction.navigate('pwa/index.html');
        await page.goto('pwa/index.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('1. Rapid Double Submit Guard — Tombol submit login kebal terhadap multiple click beruntun', async ({ page }) => {
        logAction.verify('Memverifikasi form login PWA');
        const loginView = page.locator('#view-login');
        await expect(loginView).toBeVisible({ timeout: 10000 });

        const sampleUsers = getSampleAsnUsers(1);
        const testUser = sampleUsers[0] || { nip: '199001012020011001', nik: '1377010101900001' };

        logAction.input('NIP Pegawai', '#logNip', testUser.nip);
        await page.fill('#logNip', testUser.nip);

        logAction.input('NIK / Password', '#logNik', '********');
        await page.fill('#logNik', testUser.nik);

        const submitBtn = page.locator('button[type="submit"]:has-text("MASUK APLIKASI"), #formLogin button[type="submit"]');

        logAction.click('Tombol Submit Login (Multiple Klik Beruntun)', 'button[type="submit"]');
        await submitBtn.click({ clickCount: 2 });

        logAction.verify('Memverifikasi aplikasi mengarah ke Dashboard tanpa crash');
        const dashView = page.locator('#view-dashboard');
        await expect(dashView).toBeVisible({ timeout: 15000 });
        logAction.success('Rapid Double Submit Guard diverifikasi');
    });

    test('2. Rapid View Navigation Guard — Navigasi cepat antara dashboard dan pilih metode', async ({ page }) => {
        const sampleUsers = getSampleAsnUsers(1);
        const testUser = sampleUsers[0] || { nip: '199001012020011001', nik: '1377010101900001' };

        logAction.step('Login ASN PWA');
        logAction.input('NIP Pegawai', '#logNip', testUser.nip);
        await page.fill('#logNip', testUser.nip);

        logAction.input('NIK / Password', '#logNik', '********');
        await page.fill('#logNik', testUser.nik);

        logAction.click('Tombol MASUK APLIKASI', 'button[type="submit"]');
        await page.click('button[type="submit"]:has-text("MASUK APLIKASI"), #formLogin button[type="submit"]');

        logAction.verify('Menunggu Dashboard PWA');
        const dashView = page.locator('#view-dashboard');
        await expect(dashView).toBeVisible({ timeout: 15000 });

        logAction.click('Tombol AMBIL ABSENSI KEGIATAN', 'button:has-text("AMBIL ABSENSI KEGIATAN")');
        const btnAmbilAbsen = page.locator('button:has-text("AMBIL ABSENSI KEGIATAN")');
        await btnAmbilAbsen.click();

        logAction.verify('Memverifikasi view Pilih Metode');
        const viewPilihMetode = page.locator('#view-pilih-metode');
        await expect(viewPilihMetode).toBeVisible({ timeout: 10000 });

        logAction.click('Tombol Kembali di Header Pilih Metode', 'button:has(.bi-arrow-left)');
        const btnBack = page.locator('#view-pilih-metode button:has(.bi-arrow-left)');
        await btnBack.click();

        logAction.verify('Memverifikasi kembali ke Dashboard dengan stabil');
        await expect(dashView).toBeVisible({ timeout: 5000 });
        logAction.success('Rapid View Navigation Guard diverifikasi');
    });

});


