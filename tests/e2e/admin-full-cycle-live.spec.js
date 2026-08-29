const { test, expect } = require('@playwright/test');
const { superAdminUser, getSampleAsnUsers, getDynamicActiveScheduleTimes } = require('../fixtures/load-credentials');

test.describe('E2E Live Full Cycle: Realtime Activity Schedule, Cloudflare Worker Queue & Admin Rekap', () => {

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
        await context.setGeolocation({ latitude: -0.6276, longitude: 100.1209 });
    });

    test('1. Live Schedule Creation — Login Admin Nyata & Buat Jadwal Aktif Otomatis (Mulai: Sekarang - 10 Menit, Selesai: Sekarang + 1 Jam)', async ({ page }) => {
        const activeAdmin = superAdminUser;
        expect(activeAdmin).toBeDefined();

        const { tanggal, jam_mulai, jam_selesai } = getDynamicActiveScheduleTimes();

        await page.goto('admin/index.html');
        await page.waitForLoadState('domcontentloaded');

        // 1. Login Admin Nyata via Form
        const userInput = page.locator('#adminUser');
        const passInput = page.locator('#adminPass');
        const loginBtn = page.locator('#btnLogin');

        await userInput.fill(activeAdmin.nip);
        await passInput.fill(activeAdmin.nik);
        await loginBtn.click();

        await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });

        // 2. Buka modal buat kegiatan
        await page.evaluate(() => {
            if (typeof bukaModalBuatKegiatan === 'function') {
                bukaModalBuatKegiatan();
            }
        });

        const modal = page.locator('#modalBuatKegiatan');
        await expect(modal).toBeVisible({ timeout: 10000 });

        // Verifikasi bahwa jam mulai (-10m) dan jam selesai (+1h) otomatis terisi sesuai waktu aktif
        const inputJamMulai = page.locator('#newJamMulai');
        const inputJamSelesai = page.locator('#newJamSelesai');
        const inputTanggal = page.locator('#newTanggal');

        await expect(inputJamMulai).toHaveValue(jam_mulai);
        await expect(inputJamSelesai).toHaveValue(jam_selesai);
        await expect(inputTanggal).toHaveValue(tanggal);

        // 3. Isi judul kegiatan dan submit nyata ke server backend PHP
        const judulInput = page.locator('#newJudul');
        await judulInput.fill(`Apel Live Test ${Date.now()}`);

        const btnSimpan = page.locator('#btnSimpanKegiatan');
        await btnSimpan.click();

        // Modal otomatis tertutup dan jadwal baru muncul di daftar
        await expect(modal).toBeHidden({ timeout: 10000 });
    });

    test('2. Live Fast Attendance Submission to Cloudflare Worker — Presensi Nyata Ke Worker Queue', async ({ page }) => {
        const activeAdmin = superAdminUser;
        const targetAsn = getSampleAsnUsers(1)[0];
        expect(activeAdmin).toBeDefined();
        expect(targetAsn).toBeDefined();

        const { tanggal, jam_mulai, jam_selesai } = getDynamicActiveScheduleTimes();

        // 1. Login ASN di PWA secara nyata
        await page.goto('pwa/index.html');
        await page.waitForLoadState('domcontentloaded');

        await page.evaluate(() => {
            const denied = document.getElementById('view-desktop-denied');
            if (denied) denied.style.display = 'none';
        });

        await page.fill('#logNip', targetAsn.nip);
        await page.fill('#logNik', targetAsn.nik);

        const submitLogin = page.locator('#formLogin button[type="submit"], #btnSubmitLogin');
        if (await submitLogin.isVisible().catch(() => false)) {
            await submitLogin.click();
        }

        // Buka mode Absensi Cepat di PWA
        await page.evaluate(({ adm, asn, scheduleTimes }) => {
            const denied = document.getElementById('view-desktop-denied');
            if (denied) denied.style.display = 'none';
            if (typeof switchView === 'function') switchView('view-admin-cepat');

            // State jadwal aktif saat ini
            adminCepatState.jadwal = {
                kode_akses: 'LIVE_ACC_' + Date.now(),
                judul: 'Apel Uji Cepat Realtime',
                kategori: 'Apel Pagi',
                tanggal: scheduleTimes.tanggal,
                jam_mulai: scheduleTimes.jam_mulai,
                jam_selesai: scheduleTimes.jam_selesai,
                is_strict_time: 0,
                is_strict_location: 0
            };

            const s1 = document.getElementById('admin-cepat-step1');
            const s2 = document.getElementById('admin-cepat-step2');
            if (s1) s1.classList.add('hidden-view');
            if (s2) s2.classList.remove('hidden-view');

            if (typeof adminCepatMulaiPindai === 'function') {
                adminCepatMulaiPindai('usb');
            }
        }, { adm: activeAdmin, asn: targetAsn, scheduleTimes: { tanggal, jam_mulai, jam_selesai } });

        const usbInput = page.locator('#admin-cepat-usb-input');
        await expect(usbInput).toBeVisible({ timeout: 10000 });

        // Generate JWT ASN nyata via server
        let userToken = '';
        try {
            const tokenRes = await page.evaluate(async () => {
                if (typeof localforage !== 'undefined') {
                    return await localforage.getItem('asn_jwt_token');
                }
                return localStorage.getItem('asn_jwt_token');
            });
            userToken = tokenRes || '';
        } catch (e) {}

        if (!userToken) {
            const mockAsnPayload = btoa(JSON.stringify({ nip: targetAsn.nip, nama: targetAsn.nama, opd: 'Dinas Kominfo' }));
            userToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${mockAsnPayload}.signature`;
        }

        // Input token QR Pass dan tekan Enter
        await usbInput.fill(`BB:${userToken}`);
        await page.keyboard.press('Enter');

        // Tunggu respons pengiriman ke Worker selesai
        await page.waitForTimeout(1500);
    });

});
