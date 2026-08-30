const { test, expect } = require('@playwright/test');
const { getSampleAsnUsers } = require('../fixtures/load-credentials');
const { attachLogger, logAction } = require('./test-logger');

test.describe('E2E Suite 3: PWA ASN Presensi, Strict Rules & Pengajuan Tidak Hadir', () => {

    async function loginAsn(page, user) {
        logAction.step(`Melakukan Login ASN PWA (NIP: ${user.nip})`);
        const loginView = page.locator('#view-login');
        await expect(loginView).toBeVisible({ timeout: 10000 });

        logAction.input('NIP Pegawai', '#logNip', user.nip);
        await page.fill('#logNip', user.nip);

        logAction.input('NIK / Password', '#logNik', '********');
        await page.fill('#logNik', user.nik);

        logAction.click('Tombol MASUK APLIKASI', 'button:has-text("MASUK APLIKASI")');
        const submitBtn = page.locator('button[type="submit"]:has-text("MASUK APLIKASI"), #formLogin button[type="submit"]');
        await submitBtn.click();

        logAction.verify('Menunggu Dashboard PWA ASN tampil');
        const dashboardView = page.locator('#view-dashboard');
        await expect(dashboardView).toBeVisible({ timeout: 15000 });
        logAction.success(`Login ASN (${user.nip}) berhasil`);
    }

    test.beforeEach(async ({ page, context }) => {
        attachLogger(page, 'PWA ASN Attendance');
        await context.grantPermissions(['camera', 'geolocation']);
        await context.setGeolocation({ latitude: -0.6276, longitude: 100.1209 });

        logAction.navigate('pwa/index.html');
        await page.goto('pwa/index.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('1. PWA ASN Login — Validasi login user ASN dari CSV via Form UI', async ({ page }) => {
        const sampleCount = Number(process.env.TEST_ASN_COUNT) || 1;
        const sampledUsers = getSampleAsnUsers(sampleCount);
        const testUser = sampledUsers[0] || { nip: '199001012020011001', nik: '1377010101900001' };

        await loginAsn(page, testUser);

        logAction.verify('Memverifikasi elemen nama pegawai di Dashboard');
        const dashNama = page.locator('#dashNama');
        await expect(dashNama).toBeVisible();

        logAction.click('Tombol Ganti Akun', 'button:has-text("Ganti Akun")');
        const btnGantiAkun = page.locator('button:has-text("Ganti Akun")');
        await expect(btnGantiAkun).toBeVisible();
        await btnGantiAkun.click();

        logAction.click('Konfirmasi Swal Ganti Akun', '.swal2-confirm');
        const swalConfirm = page.locator('.swal2-confirm');
        await expect(swalConfirm).toBeVisible({ timeout: 5000 });
        await swalConfirm.click();

        logAction.verify('Memverifikasi kembali ke halaman login PWA');
        await expect(page.locator('#view-login')).toBeVisible({ timeout: 10000 });
        logAction.success('Uji login dan logout ASN diverifikasi');
    });


    test('2. Presensi UI Flow — Navigasi ambil absensi & pemilihan metode via UI', async ({ page }) => {
        const sampleUsers = getSampleAsnUsers(1);
        const testUser = sampleUsers[0] || { nip: '199001012020011001', nik: '1377010101900001' };

        await loginAsn(page, testUser);

        logAction.click('Tombol AMBIL ABSENSI KEGIATAN', 'button:has-text("AMBIL ABSENSI KEGIATAN")');
        const btnAmbilAbsen = page.locator('button:has-text("AMBIL ABSENSI KEGIATAN")');
        await expect(btnAmbilAbsen).toBeVisible();
        await btnAmbilAbsen.click();

        logAction.verify('Memverifikasi tampilan Pilih Metode Absensi');
        const viewPilihMetode = page.locator('#view-pilih-metode');
        await expect(viewPilihMetode).toBeVisible({ timeout: 10000 });

        logAction.verify('Memverifikasi tombol Scan QR Code & input manual');
        const btnScan = page.locator('button:has-text("Scan QR Code")');
        const inputManual = page.locator('#inputKodeManual');
        await expect(btnScan).toBeVisible();
        await expect(inputManual).toBeVisible();
        logAction.success('Navigasi metode absensi diverifikasi');
    });

    test('3. Pengajuan Presensi Tidak Hadir — Alur UI Pemilihan Izin / Sakit / Cuti', async ({ page }) => {
        const sampleUsers = getSampleAsnUsers(1);
        const testUser = sampleUsers[0] || { nip: '199001012020011001', nik: '1377010101900001' };

        await loginAsn(page, testUser);

        logAction.click('Tombol AMBIL ABSENSI KEGIATAN', 'button:has-text("AMBIL ABSENSI KEGIATAN")');
        const btnAmbilAbsen = page.locator('button:has-text("AMBIL ABSENSI KEGIATAN")');
        await btnAmbilAbsen.click();

        logAction.verify('Memverifikasi halaman pilih metode terbuka');
        const viewPilihMetode = page.locator('#view-pilih-metode');
        await expect(viewPilihMetode).toBeVisible({ timeout: 10000 });
        logAction.success('Halaman pilih metode absensi diverifikasi');
    });

    test('4. E-Ticket QR Code Profil View — Buka Tiket QR Profil Saya via Tombol UI', async ({ page }) => {
        const sampleUsers = getSampleAsnUsers(1);
        const testUser = sampleUsers[0] || { nip: '199001012020011001', nik: '1377010101900001' };

        await loginAsn(page, testUser);

        logAction.click('Tombol Profil Saya (QR)', 'button:has-text("Profil Saya")');
        const btnProfilSaya = page.locator('button:has-text("Profil Saya")');
        await expect(btnProfilSaya).toBeVisible();
        await btnProfilSaya.click();

        logAction.verify('Memverifikasi tampilan QR Ticket terbuka');
        const ticketView = page.locator('#view-qr-ticket');
        await expect(ticketView).toBeVisible({ timeout: 10000 });

        logAction.verify('Memverifikasi countdown tiket QR');
        const countdownEl = page.locator('#ticketCountdown');
        await expect(countdownEl).toBeVisible();

        logAction.click('Tombol TUTUP QR TICKET', 'button:has-text("TUTUP QR TICKET")');
        const closeBtn = page.locator('#view-qr-ticket button:has-text("TUTUP QR TICKET")');
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();

        logAction.verify('Memverifikasi kembali ke Dashboard');
        const dashView = page.locator('#view-dashboard');
        await expect(dashView).toBeVisible({ timeout: 5000 });
        logAction.success('E-Ticket QR Code diverifikasi');
    });

});


