const { test, expect } = require('@playwright/test');
const { adminUser } = require('../fixtures/load-credentials');
const { attachLogger, logAction } = require('./test-logger');

test.describe('E2E Suite 2: Admin Rekap, Verifikasi & Audit Log Absensi', () => {

    const activeAdmin = adminUser || { nip: '198501012010011001', nik: '1377010101850001' };

    async function doAdminLogin(page) {
        logAction.step('Memeriksa status login Admin');
        const loginOverlay = page.locator('#loginOverlay');
        if (await loginOverlay.isVisible()) {
            logAction.input('NIP Admin', '#adminUser', activeAdmin.nip);
            await page.fill('#adminUser', activeAdmin.nip);

            logAction.input('Password NIK', '#adminPass', '********');
            await page.fill('#adminPass', activeAdmin.nik);

            logAction.click('Tombol Masuk', '#btnLogin');
            await page.click('#btnLogin');

            logAction.verify('Menunggu Dashboard Admin');
            await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
            await expect(loginOverlay).toBeHidden();
        }
    }

    test.beforeEach(async ({ page }) => {
        attachLogger(page, 'Admin Rekap');
        logAction.navigate('admin/index.html');
        await page.goto('admin/index.html');
        await page.waitForLoadState('domcontentloaded');
        await doAdminLogin(page);
    });

    test('1. Log Absensi — Membuka halaman log absensi realtime & audit filter via UI Navbar', async ({ page }) => {
        logAction.menu('Rekap -> Log Absensi');
        logAction.click('Dropdown Menu Rekap', '#navbarDropdownRekap');
        await page.click('#navbarDropdownRekap');

        logAction.click('Item Log Absensi', 'Log Absensi');
        const menuItemLog = page.locator('#menuItemLogAbsensi a, a.dropdown-item:has-text("Log Absensi")');
        if (await menuItemLog.isVisible()) {
            await menuItemLog.click();

            logAction.verify('Memverifikasi kontainer Log Absensi');
            const logContainer = page.locator('#logAbsensiContainer');
            await expect(logContainer).toBeVisible({ timeout: 10000 });

            logAction.verify('Memverifikasi input filter kode akses kegiatan log absensi');
            const filterKegiatan = page.locator('#logFilterKegiatan');
            await expect(filterKegiatan).toBeVisible();
            logAction.success('Halaman Log Absensi diverifikasi');
        }
    });

    test('2. Rekapitulasi Keseluruhan — Membuka filter tanggal & filter OPD rekap via UI Navbar', async ({ page }) => {
        logAction.menu('Rekap -> Kehadiran (Keseluruhan)');
        logAction.click('Dropdown Menu Rekap', '#navbarDropdownRekap');
        await page.click('#navbarDropdownRekap');

        logAction.click('Item Menu Kehadiran', 'a:has-text("Kehadiran")');
        await page.click('a.dropdown-item:has-text("Kehadiran")');

        logAction.verify('Memverifikasi kontainer Rekap Keseluruhan');
        const rekapContainer = page.locator('#rekapKeseluruhanContainer');
        await expect(rekapContainer).toBeVisible({ timeout: 10000 });

        logAction.verify('Memverifikasi input tanggal mulai & selesai');
        const tglMulai = page.locator('#rekapKeseluruhanStartDate');
        const tglSelesai = page.locator('#rekapKeseluruhanEndDate');
        await expect(tglMulai).toBeVisible();
        await expect(tglSelesai).toBeVisible();
        logAction.success('Halaman Rekap Keseluruhan diverifikasi');
    });

    test('3. Rekapitulasi Statistik — Memuat grafik/tabel statistik kehadiran per OPD via UI Navbar', async ({ page }) => {
        logAction.menu('Rekap -> Statistik');
        logAction.click('Dropdown Menu Rekap', '#navbarDropdownRekap');
        await page.click('#navbarDropdownRekap');

        logAction.click('Item Menu Statistik', 'a:has-text("Statistik")');
        await page.click('a.dropdown-item:has-text("Statistik")');

        logAction.verify('Memverifikasi kontainer Statistik Kehadiran');
        const statistikContainer = page.locator('#statistikKehadiranContainer');
        await expect(statistikContainer).toBeVisible({ timeout: 10000 });

        logAction.verify('Memverifikasi tombol Tampilkan Statistik');
        const btnFilter = page.locator('button:has-text("Tampilkan Statistik")');
        await expect(btnFilter).toBeVisible();
        logAction.success('Halaman Statistik Kehadiran diverifikasi');
    });

    test('4. Rekapitulasi Kegiatan — Pemeriksaan tampilan daftar kegiatan dan tabel rekap', async ({ page }) => {
        logAction.verify('Memverifikasi kontainer Dashboard Kegiatan');
        const dashContainer = page.locator('#dashboardContainer');
        await expect(dashContainer).toBeVisible({ timeout: 10000 });

        logAction.verify('Memverifikasi input pencarian jadwal kegiatan');
        const searchInput = page.locator('#filterJadwalSearch');
        await expect(searchInput).toBeVisible();
        logAction.success('Tampilan Rekap Kegiatan diverifikasi');
    });

});


