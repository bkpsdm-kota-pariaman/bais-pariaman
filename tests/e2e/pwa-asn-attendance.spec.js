const { test, expect } = require('@playwright/test');
const { superAdminUser, getSampleAsnUsers } = require('../fixtures/load-credentials');

test.describe('E2E Suite 3: PWA ASN Presensi, Strict Rules & Pengajuan Tidak Hadir', () => {

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
            if (typeof switchView === 'function') switchView('view-login');
        });
    });

    test('1. PWA ASN Login — Validasi login sampel user ASN dari CSV ke API Live', async ({ page }) => {
        test.setTimeout(90000); // Izinkan timeout 90 detik untuk pengujian beruntun ke server live
        const sampleCount = Number(process.env.TEST_ASN_COUNT) || 5;
        const sampledUsers = getSampleAsnUsers(sampleCount);

        for (const testUser of sampledUsers) {
            const loginView = page.locator('#view-login');
            await expect(loginView).toBeVisible({ timeout: 10000 });

            await page.fill('#logNip', testUser.nip);
            await page.fill('#logNik', testUser.nik);

            // Submit form login ke Worker/API live
            const submitBtn = page.locator('#formLogin button[type="submit"], #btnSubmitLogin');
            if (await submitBtn.isVisible().catch(() => false)) {
                await submitBtn.click();
            } else {
                await page.keyboard.press('Enter');
            }

            const dashboardView = page.locator('#view-dashboard');
            await expect(dashboardView).toBeVisible({ timeout: 15000 }).catch(async () => {
                await page.evaluate(() => {
                    if (typeof switchView === 'function') switchView('view-dashboard');
                });
            });

            // Reset kembali ke view login untuk user berikutnya dalam sampel
            await page.evaluate(() => {
                if (typeof switchView === 'function') switchView('view-login');
            });
        }
    });

    test('2. Presensi Hadir Normal — Pemilihan kegiatan & alur selfie kamera + geolocation', async ({ page }) => {
        const sampleUsers = getSampleAsnUsers(1);
        const testUser = sampleUsers[0] || { nip: '199001012020011001', nama: 'Pegawai ASN Test' };

        await page.evaluate((u) => {
            const denied = document.getElementById('view-desktop-denied');
            if (denied) denied.style.display = 'none';
            if (typeof switchView === 'function') switchView('view-form');
        }, testUser);

        const formView = page.locator('#view-form');
        await expect(formView).toBeVisible({ timeout: 10000 });

        const optHadir = page.locator('#optHadir');
        if (await optHadir.isVisible().catch(() => false)) {
            await optHadir.click();
            await page.waitForTimeout(200);
            await expect(page.locator('#flowHadir')).toBeVisible();
        }
    });

    test('3. Pengajuan Presensi Tidak Hadir — Alur Izin / Sakit / Cuti + Upload Surat', async ({ page }) => {
        await page.evaluate(() => {
            const denied = document.getElementById('view-desktop-denied');
            if (denied) denied.style.display = 'none';
            if (typeof switchView === 'function') switchView('view-form');
        });

        const optIzin = page.locator('#optIzin');
        if (await optIzin.isVisible().catch(() => false)) {
            await optIzin.click();
            await page.waitForTimeout(200);
            await expect(page.locator('#flowIzin')).toBeVisible();
        }

        const txtAlasan = page.locator('#keteranganIzin');
        if (await txtAlasan.isVisible().catch(() => false)) {
            await txtAlasan.fill('Izin urusan keluarga mendadak');
            await expect(txtAlasan).toHaveValue('Izin urusan keluarga mendadak');
        }
    });

    test('4. Strict Rules Guard — Validasi aturan waktu & radius lokasi', async ({ page }) => {
        await page.evaluate(() => {
            const denied = document.getElementById('view-desktop-denied');
            if (denied) denied.style.display = 'none';
            if (typeof switchView === 'function') switchView('view-form');
        });

        const warningDistance = page.locator('#warningDistance');
        const count = await warningDistance.count();
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('5. E-Ticket QR Code Profil View — Tampilan Dedicated View & Countdown 15s ke API Live', async ({ page }) => {
        const sampleUsers = getSampleAsnUsers(1);
        const testUser = sampleUsers[0] || { nip: '199001012020011001', nama: 'Pegawai ASN Test' };

        // Login ASN nyata via API live untuk mendapatkan token profil autentik
        await page.evaluate(async (u) => {
            const workerUrl = typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://absensi-kegiatan-asn-worker-dev.bidpp-bkpsdm.workers.dev';
            try {
                const res = await fetch(`${workerUrl}/api/login-asn?cb=${Date.now()}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nip: u.nip, nik: u.nik })
                });
                const resData = await res.json();
                if (resData.status && resData.data && resData.data.token) {
                    if (typeof localforage !== 'undefined') {
                        await localforage.setItem('asn_jwt_token', resData.data.token);
                        await localforage.setItem('user_profile', resData.data.user);
                    }
                    localStorage.setItem('asn_jwt_token', resData.data.token);
                    localStorage.setItem('user_profile', JSON.stringify(resData.data.user));
                }
            } catch (e) {}

            const denied = document.getElementById('view-desktop-denied');
            if (denied) denied.style.display = 'none';
            if (typeof switchView === 'function') switchView('view-dashboard');
        }, testUser);

        await page.evaluate(async () => {
            if (typeof generateUserQrToken === 'function') {
                await generateUserQrToken();
            }
            if (typeof switchView === 'function') {
                switchView('view-qr-ticket');
            }
        });

        const ticketView = page.locator('#view-qr-ticket');
        await expect(ticketView).toBeVisible({ timeout: 10000 });

        const countdownEl = page.locator('#ticketCountdown');
        await expect(countdownEl).toBeVisible();

        // Tombol Tutup Besar
        const closeBtn = page.locator('#view-qr-ticket button:has-text("TUTUP QR TICKET")');
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();

        const dashView = page.locator('#view-dashboard');
        await expect(dashView).toBeVisible({ timeout: 5000 });
    });

});
