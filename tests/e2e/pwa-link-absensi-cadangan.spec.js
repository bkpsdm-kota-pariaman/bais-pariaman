const { test, expect } = require('@playwright/test');
const { attachLogger, logAction } = require('./test-logger');

test.describe('E2E Suite: Simulasi User Link Absensi Cadangan saat Kamera / GPS Gagal', () => {

    let consoleErrors = [];
    let pageErrors = [];

    test.beforeEach(async ({ page, context }) => {
        test.setTimeout(90000);
        consoleErrors = [];
        pageErrors = [];

        // Hentikan proses test jika terjadi console error atau pageerror
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

        attachLogger(page, 'Link Absensi Cadangan');

        // Simulasi otomatis penolakan izin kamera & GPS di browser tanpa memicu dialog prompt native
        await page.addInitScript(() => {
            if (navigator.permissions && navigator.permissions.query) {
                const origQuery = navigator.permissions.query.bind(navigator.permissions);
                navigator.permissions.query = function(param) {
                    if (param && param.name === 'geolocation') {
                        return Promise.resolve({ state: 'denied', onchange: null });
                    }
                    return origQuery(param);
                };
            }
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition = function(success, error) {
                    if (typeof error === 'function') {
                        error({ code: 1, message: 'User denied Geolocation', PERMISSION_DENIED: 1 });
                    }
                };
            }
            if (navigator.mediaDevices) {
                navigator.mediaDevices.getUserMedia = function() {
                    return Promise.reject(new DOMException('Permission denied by test', 'NotAllowedError'));
                };
                navigator.mediaDevices.enumerateDevices = function() {
                    return Promise.resolve([
                        { kind: 'videoinput', label: '', deviceId: 'test_cam', groupId: 'test_grp' }
                    ]);
                };
            }
        });
    });

    test('Skenario 1: Link Absensi Cadangan Tidak Ditemukan — Uji Tombol Muat Ulang 2 Kali', async ({ page }) => {
        logAction.step('1. Mengakses URL Root Halaman Utama (Landing Page)');
        logAction.navigate('index.html');
        await page.goto('index.html');
        await page.waitForLoadState('domcontentloaded');

        logAction.step('2. Klik Tombol "BUKA APLIKASI"');
        const btnBuka = page.locator('a:has-text("BUKA APLIKASI")');
        await expect(btnBuka).toBeVisible({ timeout: 10000 });
        logAction.click('Tombol BUKA APLIKASI', 'a:has-text("BUKA APLIKASI")');
        await btnBuka.click();

        logAction.step('3. Verifikasi Halaman Pengecekan Hak Akses Perangkat & Status Belum Aktif');
        const viewPermCheck = page.locator('#view-permission-check');
        await expect(viewPermCheck).toBeVisible({ timeout: 15000 });

        const statusCamera = page.locator('#perm-camera-status');
        const statusGps = page.locator('#perm-gps-status');

        logAction.verify('Memverifikasi minimal salah satu status Kamera atau Lokasi belum aktif');
        const cameraText = await statusCamera.textContent();
        const gpsText = await statusGps.textContent();
        expect(cameraText.includes('Belum Aktif') || gpsText.includes('Belum Aktif')).toBeTruthy();

        const btnAktifkan = page.locator('#btn-perm-retry');
        await expect(btnAktifkan).toBeVisible();

        logAction.click('Tombol Aktifkan Kamera & Lokasi (Penekanan Ke-1)', '#btn-perm-retry');
        await btnAktifkan.click();

        logAction.click('Tombol Aktifkan Kamera & Lokasi (Penekanan Ke-2)', '#btn-perm-retry');
        await btnAktifkan.click();

        logAction.step('4. Memverifikasi Tampilan Tombol Fallback ke BAIS Pariaman & Absensi Cadangan');
        const permFallback = page.locator('#perm-state-fallback');
        await expect(permFallback).toBeVisible({ timeout: 15000 });

        const btnAbsensiCadangan = page.locator('#btn-absensi-cadangan');
        await expect(btnAbsensiCadangan).toBeVisible();

        // Mocking API endpoint link absensi cadangan untuk mengembalikan status kosong (link tidak ditemukan)
        await page.route('**/pengaturan/link-absensi-cadangan**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ status: false, data: null, message: 'Link absensi cadangan belum diatur.' })
            });
        });

        logAction.click('Tombol ABSENSI CADANGAN', '#btn-absensi-cadangan');
        await btnAbsensiCadangan.click();

        logAction.step('5. Verifikasi Pesan "Link Tidak Ditemukan" & Uji Tekan Tombol "Muat Ulang" 2 Kali');
        logAction.verify('Menunggu tampilan State Error Link Tidak Ditemukan (#stateError)');
        const stateError = page.locator('#stateError');
        await expect(stateError).toBeVisible({ timeout: 15000 });
        await expect(page.locator('#stateError h4')).toContainText('Link Tidak Ditemukan');

        const btnMuatUlang = stateError.locator('button:has-text("Muat Ulang")');
        await expect(btnMuatUlang).toBeVisible();

        logAction.click('Tombol Muat Ulang (Penekanan Ke-1)', '#stateError button:has-text("Muat Ulang")');
        await btnMuatUlang.click();
        await expect(stateError).toBeVisible({ timeout: 10000 });

        logAction.click('Tombol Muat Ulang (Penekanan Ke-2)', '#stateError button:has-text("Muat Ulang")');
        await btnMuatUlang.click();
        await expect(stateError).toBeVisible({ timeout: 10000 });

        logAction.verify('Memverifikasi tidak ada console.error dan pageerror');
        expect(consoleErrors).toEqual([]);
        expect(pageErrors).toEqual([]);
        logAction.success('Skenario 1: Penarikan link gagal & uji muat ulang 2 kali BERHASIL!');
    });

    test('Skenario 2: Data Link Berhasil Diambil & Halaman Dialihkan (Redirect)', async ({ page }) => {
        logAction.step('1. Mengakses URL Root Halaman Utama (Landing Page)');
        logAction.navigate('index.html');
        await page.goto('index.html');
        await page.waitForLoadState('domcontentloaded');

        logAction.step('2. Klik Tombol "BUKA APLIKASI"');
        const btnBuka = page.locator('a:has-text("BUKA APLIKASI")');
        await expect(btnBuka).toBeVisible({ timeout: 10000 });
        logAction.click('Tombol BUKA APLIKASI', 'a:has-text("BUKA APLIKASI")');
        await btnBuka.click();

        logAction.step('3. Pengecekan Hak Akses & Klik Tombol Aktifkan 2 Kali');
        const viewPermCheck = page.locator('#view-permission-check');
        await expect(viewPermCheck).toBeVisible({ timeout: 15000 });

        const btnAktifkan = page.locator('#btn-perm-retry');
        await expect(btnAktifkan).toBeVisible();

        logAction.click('Tombol Aktifkan Kamera & Lokasi (Penekanan Ke-1)', '#btn-perm-retry');
        await btnAktifkan.click();

        logAction.click('Tombol Aktifkan Kamera & Lokasi (Penekanan Ke-2)', '#btn-perm-retry');
        await btnAktifkan.click();

        logAction.step('4. Membuka Menu Absensi Cadangan');
        const permFallback = page.locator('#perm-state-fallback');
        await expect(permFallback).toBeVisible({ timeout: 15000 });

        const targetRedirectUrl = 'absensi-cadangan/cadangan.html';

        // Mocking API endpoint link absensi cadangan untuk mengembalikan link yang valid
        await page.route('**/pengaturan/link-absensi-cadangan**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    status: true,
                    data: { link_absensi_cadangan: targetRedirectUrl }
                })
            });
        });

        const btnAbsensiCadangan = page.locator('#btn-absensi-cadangan');
        logAction.click('Tombol ABSENSI CADANGAN', '#btn-absensi-cadangan');
        await btnAbsensiCadangan.click();

        logAction.step('6. Verifikasi Data Link Berhasil Diambil & Halaman Dialihkan ke Tujuan');
        logAction.verify('Menunggu alur pengalihan (Redirect) selesai');
        await page.waitForURL(`**/${targetRedirectUrl}**`, { timeout: 20000 });

        logAction.verify('Memverifikasi tampilan formulir Absensi Cadangan Internal di halaman tujuan');
        const formViewTarget = page.locator('#viewForm');
        await expect(formViewTarget).toBeVisible({ timeout: 15000 });

        logAction.verify('Memverifikasi tidak ada console.error dan pageerror');
        expect(consoleErrors).toEqual([]);
        expect(pageErrors).toEqual([]);
        logAction.success('Skenario 2: Data link berhasil diambil & redirect BERHASIL!');
    });

});
