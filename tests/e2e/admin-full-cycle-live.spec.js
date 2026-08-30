const { test, expect } = require('@playwright/test');
const { superAdminUser, getSampleAsnUsers } = require('../fixtures/load-credentials');
const { attachLogger, logAction } = require('./test-logger');

test.describe('E2E Live Full Cycle: Realtime Activity Schedule, Cloudflare Worker Queue & Admin Rekap', () => {

    test.beforeEach(async ({ page, context }) => {
        attachLogger(page, 'Full Cycle E2E');
        await context.grantPermissions(['camera', 'geolocation']);
        await context.setGeolocation({ latitude: -0.6276, longitude: 100.1209 });
    });

    test('1. Live Schedule Creation — Login Admin Nyata & Buat Jadwal Aktif via UI Modal Form', async ({ page }) => {
        const activeAdmin = superAdminUser || { nip: '198501012010011001', nik: '1377010101850001' };

        logAction.navigate('admin/index.html');
        await page.goto('admin/index.html');
        await page.waitForLoadState('domcontentloaded');

        logAction.step('1. Login Admin Nyata via Form');
        const userInput = page.locator('#adminUser');
        const passInput = page.locator('#adminPass');
        const loginBtn = page.locator('#btnLogin');

        logAction.input('NIP Admin', '#adminUser', activeAdmin.nip);
        await userInput.fill(activeAdmin.nip);

        logAction.input('Password NIK', '#adminPass', '********');
        await passInput.fill(activeAdmin.nik);

        logAction.click('Tombol Masuk', '#btnLogin');
        await loginBtn.click();

        logAction.verify('Menunggu Dashboard Admin terbuka');
        await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });

        logAction.step('2. Buka modal buat kegiatan via tombol UI');
        const btnBuatJadwal = page.locator('button:has-text("Buat Jadwal Baru")');
        await expect(btnBuatJadwal).toBeVisible();
        await btnBuatJadwal.click();

        logAction.verify('Memverifikasi modal form Buat Jadwal');
        const modal = page.locator('#modalBuatKegiatan');
        await expect(modal).toBeVisible({ timeout: 10000 });

        logAction.step('3. Isi judul kegiatan dan simpan');
        const judul = `Apel Live Test ${Date.now()}`;
        const todayStr = new Date().toISOString().split('T')[0];
        
        logAction.input('Judul Kegiatan', '#newJudul', judul);
        await page.fill('#newJudul', judul);
        await page.evaluate((valDate) => {
            const elTgl = document.getElementById('newTanggal');
            if (elTgl) {
                if (elTgl._flatpickr) {
                    elTgl._flatpickr.setDate(valDate, true);
                } else {
                    elTgl.value = valDate;
                }
            }
            const elMulai = document.getElementById('newJamMulai');
            if (elMulai) { elMulai.value = '00:00'; elMulai.dispatchEvent(new Event('input', { bubbles: true })); }
            const elSelesai = document.getElementById('newJamSelesai');
            if (elSelesai) { elSelesai.value = '23:59'; elSelesai.dispatchEvent(new Event('input', { bubbles: true })); }
        }, todayStr);

        logAction.click('Pilih Semua OPD', '#modalBuatKegiatan button:has-text("Pilih Semua")');
        await page.waitForFunction(() => typeof selectAllOpd === 'function' && (opdState.add.available.length > 0 || opdState.add.selected.length > 0), { timeout: 10000 }).catch(() => {});
        await page.evaluate(() => selectAllOpd('add'));

        logAction.click('Tombol Simpan Kegiatan', '#btnSimpanKegiatan');
        const btnSimpan = page.locator('#btnSimpanKegiatan');
        await btnSimpan.click();

        logAction.verify('Memverifikasi modal tertutup setelah simpan');
        await expect(modal).toBeHidden({ timeout: 15000 });
        logAction.success('Jadwal Kegiatan baru berhasil dibuat via UI');
    });








    test('2. Live ASN Attendance Flow — Presensi ASN Nyata via PWA Form', async ({ page }) => {
        const sampleUsers = getSampleAsnUsers(1);
        const targetAsn = sampleUsers[0] || { nip: '199001012020011001', nik: '1377010101900001' };

        logAction.navigate('pwa/index.html');
        await page.goto('pwa/index.html');
        await page.waitForLoadState('domcontentloaded');

        logAction.step(`Login ASN di PWA (NIP: ${targetAsn.nip})`);
        logAction.input('NIP Pegawai', '#logNip', targetAsn.nip);
        await page.fill('#logNip', targetAsn.nip);

        logAction.input('NIK / Password', '#logNik', '********');
        await page.fill('#logNik', targetAsn.nik);

        logAction.click('Tombol MASUK APLIKASI', 'button:has-text("MASUK APLIKASI")');
        const submitLogin = page.locator('button[type="submit"]:has-text("MASUK APLIKASI"), #formLogin button[type="submit"]');
        await submitLogin.click();

        logAction.verify('Menunggu Dashboard PWA ASN tampil');
        const dashView = page.locator('#view-dashboard');
        await expect(dashView).toBeVisible({ timeout: 15000 });

        logAction.click('Tombol AMBIL ABSENSI KEGIATAN', 'button:has-text("AMBIL ABSENSI KEGIATAN")');
        const btnAmbilAbsen = page.locator('button:has-text("AMBIL ABSENSI KEGIATAN")');
        await btnAmbilAbsen.click();

        logAction.verify('Memverifikasi tampilan Pilih Metode Absensi');
        const viewPilihMetode = page.locator('#view-pilih-metode');
        await expect(viewPilihMetode).toBeVisible({ timeout: 10000 });
        logAction.success('Alur presensi PWA ASN diverifikasi');
    });

});


