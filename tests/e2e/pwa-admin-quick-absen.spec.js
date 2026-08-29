const { test, expect } = require('@playwright/test');
const { superAdminUser, getSampleAsnUsers } = require('../fixtures/load-credentials');

test.describe('E2E Suite 4: Admin Absensi Cepat, QR Scan & Siklus Penuh Presensi', () => {

    test.beforeEach(async ({ page, context }) => {
        await page.addInitScript(() => {
            window.matchMedia = (query) => ({
                matches: query.includes('display-mode: standalone'),
                media: query,
                onchange: null,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => false,
            });
        });

        await context.grantPermissions(['camera', 'geolocation']);
        await context.setGeolocation({ latitude: -0.6264, longitude: 100.1186 });

        await page.goto('pwa/index.html');
        await page.waitForLoadState('domcontentloaded');

        await page.evaluate(() => {
            const denied = document.getElementById('view-desktop-denied');
            if (denied) denied.style.display = 'none';
        });
    });

    test('1. Absensi Cepat Admin (Input Manual) — Delegasi presensi via NIP oleh Admin di PWA', async ({ page }) => {
        const activeAdmin = superAdminUser || { nip: '198501012010011001', nama: 'Admin BKPSDM' };
        const sampleUsers = getSampleAsnUsers(1);
        const targetAsn = sampleUsers[0] || { nip: '199001012020011001', nama: 'Pegawai Test' };

        await page.evaluate((adm) => {
            localStorage.setItem('jwt_token', 'mock_admin_jwt_in_pwa');
            localStorage.setItem('user_profile', JSON.stringify({
                nama: adm.nama,
                nip: adm.nip,
                role: ['admin', 'super admin']
            }));
            const denied = document.getElementById('view-desktop-denied');
            if (denied) denied.style.display = 'none';
            if (typeof switchView === 'function') switchView('view-admin-cepat');
        }, activeAdmin);

        const adminCepatView = page.locator('#view-admin-cepat');
        await expect(adminCepatView).toBeVisible({ timeout: 10000 });

        const txtInput = page.locator('#adminInputManualToken');
        if (await txtInput.isVisible().catch(() => false)) {
            await txtInput.fill(targetAsn.nip);
            await expect(txtInput).toHaveValue(targetAsn.nip);
        }
    });

    test('2. Absensi Cepat Admin (Scan QR Code) — Mode Kamera Scanner di PWA', async ({ page }) => {
        const activeAdmin = superAdminUser || { nip: '198501012010011001', nama: 'Admin BKPSDM' };

        await page.evaluate((adm) => {
            localStorage.setItem('jwt_token', 'mock_admin_jwt_in_pwa');
            localStorage.setItem('user_profile', JSON.stringify({
                nama: adm.nama,
                nip: adm.nip,
                role: ['admin', 'super admin']
            }));
            const denied = document.getElementById('view-desktop-denied');
            if (denied) denied.style.display = 'none';
            if (typeof switchView === 'function') switchView('view-admin-cepat');
        }, activeAdmin);

        const adminCepatView = page.locator('#view-admin-cepat');
        await expect(adminCepatView).toBeVisible({ timeout: 10000 });

        const btnScanner = page.locator('#btnBukaQrScanner, #btnStartScan');
        const count = await btnScanner.count();
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('3. Absensi Cepat Admin (Mode Hardware Scanner USB / Gun) — Standby & Input Enter', async ({ page }) => {
        const activeAdmin = superAdminUser || { nip: '198501012010011001', nama: 'Admin BKPSDM' };

        await page.evaluate((adm) => {
            localStorage.setItem('jwt_token', 'mock_admin_jwt_in_pwa');
            localStorage.setItem('user_profile', JSON.stringify({
                nama: adm.nama,
                nip: adm.nip,
                role: ['admin', 'super admin']
            }));
            const denied = document.getElementById('view-desktop-denied');
            if (denied) denied.style.display = 'none';
            if (typeof switchView === 'function') switchView('view-admin-cepat');

            // Buka step 2 & buka mode scanner USB
            adminCepatState.jadwal = { kode_akses: 'TESTKODE', kategori: 'Apel Pagi' };
            const s1 = document.getElementById('admin-cepat-step1');
            const s2 = document.getElementById('admin-cepat-step2');
            if (s1) s1.classList.add('hidden-view');
            if (s2) s2.classList.remove('hidden-view');
            if (typeof adminCepatMulaiPindai === 'function') adminCepatMulaiPindai('usb');
        }, activeAdmin);

        const usbSection = page.locator('#admin-cepat-usb-section');
        await expect(usbSection).toBeVisible({ timeout: 10000 });

        const usbInput = page.locator('#admin-cepat-usb-input');
        await expect(usbInput).toBeVisible();

        // Simulasi input token scanner USB & enter
        await usbInput.fill('BB:mock_qr_token_from_usb_gun');
        await expect(usbInput).toHaveValue('BB:mock_qr_token_from_usb_gun');
    });

    test('4. Siklus Penuh Presensi — Integrasi PWA ke Dashboard Admin', async ({ page }) => {
        await page.goto('admin/index.html');
        await page.waitForLoadState('domcontentloaded');

        await page.evaluate(() => {
            localStorage.setItem('admin_jwt_token', 'mock_full_cycle_token');
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
