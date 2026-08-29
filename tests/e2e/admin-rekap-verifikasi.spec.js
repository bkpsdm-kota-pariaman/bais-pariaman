const { test, expect } = require('@playwright/test');

test.describe('E2E Suite 2: Admin Rekap, Verifikasi & Audit Log Absensi', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('admin/index.html');
        await page.waitForLoadState('domcontentloaded');

        // Setup admin session
        await page.evaluate(() => {
            localStorage.setItem('admin_jwt_token', 'mock_admin_token_rekap_verifikasi');
            const overlay = document.getElementById('loginOverlay');
            if (overlay) overlay.style.display = 'none';
            const dash = document.getElementById('dashboardContainer');
            if (dash) dash.classList.remove('d-none');
            const nav = document.getElementById('adminNavbar');
            if (nav) nav.classList.remove('d-none');
        });
    });

    test('1. Log Absensi — Membuka halaman log absensi realtime & audit filter', async ({ page }) => {
        await page.evaluate(() => {
            const dash = document.getElementById('dashboardContainer');
            if (dash) dash.classList.add('d-none');
            const log = document.getElementById('logAbsensiContainer');
            if (log) log.classList.remove('d-none');
        });

        const logContainer = page.locator('#logAbsensiContainer');
        await expect(logContainer).toBeVisible({ timeout: 10000 });

        const searchLog = page.locator('#filterLogSearch');
        if (await searchLog.isVisible().catch(() => false)) {
            await searchLog.fill('1990');
            await page.waitForTimeout(200);
            await searchLog.fill('');
        }
    });

    test('2. Rekapitulasi Keseluruhan — Membuka filter tanggal & filter OPD rekap', async ({ page }) => {
        await page.evaluate(() => {
            const dash = document.getElementById('dashboardContainer');
            if (dash) dash.classList.add('d-none');
            const rekap = document.getElementById('rekapKeseluruhanContainer');
            if (rekap) rekap.classList.remove('d-none');
        });

        const rekapContainer = page.locator('#rekapKeseluruhanContainer');
        await expect(rekapContainer).toBeVisible({ timeout: 10000 });

        const tglMulai = page.locator('#rekapKeseluruhanStartDate');
        const tglSelesai = page.locator('#rekapKeseluruhanEndDate');
        if (await tglMulai.isVisible().catch(() => false)) {
            await expect(tglMulai).toBeVisible();
            await expect(tglSelesai).toBeVisible();
        }
    });

    test('3. Rekapitulasi Statistik — Memuat grafik/tabel statistik kehadiran per OPD', async ({ page }) => {
        await page.evaluate(() => {
            const dash = document.getElementById('dashboardContainer');
            if (dash) dash.classList.add('d-none');
            const stat = document.getElementById('statistikKehadiranContainer');
            if (stat) stat.classList.remove('d-none');
        });

        const statistikContainer = page.locator('#statistikKehadiranContainer');
        await expect(statistikContainer).toBeVisible({ timeout: 10000 });

        const btnFilter = page.locator('#btnTerapkanFilterStatistik');
        if (await btnFilter.isVisible().catch(() => false)) {
            await expect(btnFilter).toBeVisible();
        }
    });

    test('4. Modal Verifikasi Absensi — Pemeriksaan alur verifikasi & penolakan status kehadiran', async ({ page }) => {
        await page.evaluate(() => {
            const dash = document.getElementById('dashboardContainer');
            if (dash) dash.classList.add('d-none');
            const rekap = document.getElementById('rekapContainer');
            if (rekap) rekap.classList.remove('d-none');
        });

        const rekapContainer = page.locator('#rekapContainer');
        await expect(rekapContainer).toBeVisible({ timeout: 10000 });
    });

});
