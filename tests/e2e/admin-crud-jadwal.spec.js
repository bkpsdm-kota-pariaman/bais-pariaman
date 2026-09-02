const { test, expect } = require('@playwright/test');
const { adminUser } = require('../fixtures/load-credentials');
const { attachLogger, logAction } = require('./test-logger');

test.describe('E2E Suite: Admin CRUD Jadwal Kegiatan', () => {

    const activeAdmin = adminUser || { nip: '198501012000011001', nik: '1377010101850001' };
    let consoleErrors = [];
    let pageErrors = [];

    async function doAdminLogin(page) {
        logAction.step('Memeriksa status login Admin');
        const loginOverlay = page.locator('#loginOverlay');
        if (await loginOverlay.isVisible()) {
            logAction.input('Username/NIP Admin', '#adminUser', activeAdmin.nip);
            await page.locator('#adminUser').pressSequentially(activeAdmin.nip, { delay: 100 });

            logAction.input('Password/NIK Admin', '#adminPass', '********');
            await page.locator('#adminPass').pressSequentially(activeAdmin.nik, { delay: 100 });

            logAction.click('Tombol Masuk', '#btnLogin');
            await page.click('#btnLogin');

            logAction.verify('Menunggu Dashboard Admin terbuka');
            await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
            await expect(loginOverlay).toBeHidden();
            logAction.success('Login Admin berhasil, Dashboard terbuka');
        }
    }

    test.beforeEach(async ({ page }) => {
        test.setTimeout(90000);
        consoleErrors = [];
        pageErrors = [];

        // HENTIKAN PROSES TEST JIKA TERJADI ERROR CONSOLE ATAU PAGE ERROR
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

        attachLogger(page, 'Admin CRUD Jadwal');
        logAction.navigate('admin/index.html');
        await page.goto('admin/index.html');
        await page.waitForLoadState('domcontentloaded');
        await doAdminLogin(page);
    });

    test('Full CRUD Lifecycle: Jadwal Kegiatan (Create, Read, Update All Fields, Delete)', async ({ page }) => {
        logAction.step('1. Buka Menu Data -> Kegiatan');
        logAction.click('Dropdown Menu Data', '#navbarDropdownData');
        await page.click('#navbarDropdownData');

        logAction.click('Menu Kegiatan', 'a.dropdown-item:has-text("Kegiatan")');
        await page.click('a.dropdown-item:has-text("Kegiatan")');

        logAction.verify('Memverifikasi kontainer kegiatan/dashboard terbuka');
        await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 10000 });

        logAction.step('2. CREATE: Buka Modal & Tambah Jadwal Kegiatan Baru');
        const btnBuatJadwal = page.locator('button:has-text("Buat Jadwal Baru")');
        await expect(btnBuatJadwal).toBeVisible();
        logAction.click('Tombol Buat Jadwal Baru', 'button:has-text("Buat Jadwal Baru")');
        await btnBuatJadwal.click();

        const modalBuat = page.locator('#modalBuatKegiatan');
        await expect(modalBuat).toHaveClass(/show/, { timeout: 10000 });

        const rand3Digits = (Math.floor(100 + Math.random() * 900)).toString();
        const judulKegiatan = `Rapat E2E Test ${rand3Digits}`;

        logAction.input('Judul Jadwal', '#newJudul', judulKegiatan);
        await page.locator('#newJudul').pressSequentially(judulKegiatan, { delay: 100 });

        const todayStr = new Date().toISOString().split('T')[0];
        logAction.input('Tanggal Kegiatan via Flatpickr', '#newTanggal', todayStr);
        await page.evaluate((d) => {
            if (typeof flatpickr !== 'undefined') {
                flatpickr('#newTanggal').setDate(d, true);
            } else {
                document.getElementById('newTanggal').value = d;
            }
        }, todayStr);

        logAction.input('Jam Mulai', '#newJamMulai', '07:00');
        await page.locator('#newJamMulai').fill('07:00');

        logAction.input('Jam Selesai', '#newJamSelesai', '09:00');
        await page.locator('#newJamSelesai').fill('09:00');

        logAction.click('Tombol Pilih Semua OPD Target', 'button:has-text("Pilih Semua")');
        await page.evaluate(() => {
            if (typeof selectAllOpd === 'function') {
                selectAllOpd('add');
            }
        });

        logAction.click('Tombol Simpan Jadwal', '#btnSimpanKegiatan');
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.status() === 200 || resp.status() === 200),
            page.click('#btnSimpanKegiatan')
        ]);

        logAction.verify('Memverifikasi modal tertutup dan respons sukses ditampilkan');
        await expect(modalBuat).toBeHidden({ timeout: 15000 });

        logAction.step('3. READ & FILTER: Gunakan Filter Pencarian untuk Menemukan Jadwal');
        const filterInput = page.locator('#filterJadwalSearch');
        await expect(filterInput).toBeVisible();
        logAction.input('Cari Judul Jadwal Kegiatan', '#filterJadwalSearch', judulKegiatan);
        await filterInput.click();
        await filterInput.press('Control+A');
        await filterInput.press('Backspace');
        await filterInput.pressSequentially(judulKegiatan, { delay: 100 });

        logAction.click('Tombol CARI Filter Jadwal', '#dashboardContainer button:has-text("CARI")');
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.status() === 200),
            page.click('#dashboardContainer button:has-text("CARI")')
        ]);

        const tableRow = page.locator('#listKegiatanBody tr').filter({ hasText: judulKegiatan }).first();
        await expect(tableRow).toBeVisible({ timeout: 15000 });
        logAction.success(`Jadwal "${judulKegiatan}" berhasil ditemukan di tabel listKegiatanBody`);

        logAction.step('4. UPDATE ALL FIELDS: Buka Modal Edit & Perbarui SELURUH Kolom Data Jadwal');
        const btnEdit = tableRow.locator('button.btn-outline-warning, button[title="Edit Jadwal"]').first();
        await expect(btnEdit).toBeVisible();
        logAction.click('Tombol Edit Jadwal', 'Edit');
        await btnEdit.click();

        const modalEdit = page.locator('#modalEditKegiatan');
        await expect(modalEdit).toHaveClass(/show/, { timeout: 10000 });

        // 4a. Edit Judul
        const editJudulInput = page.locator('#editJudul');
        await expect(editJudulInput).toBeVisible();
        const judulRevisi = `${judulKegiatan} REVISI`;
        logAction.input('Judul Jadwal Revisi', '#editJudul', judulRevisi);
        await editJudulInput.click();
        await editJudulInput.press('Control+A');
        await editJudulInput.press('Backspace');
        await editJudulInput.pressSequentially(judulRevisi, { delay: 100 });

        // 4b. Edit Kategori
        logAction.step('Perbarui Kategori Kegiatan ke Upacara');
        await page.locator('#editKategori').selectOption('Upacara');

        // 4c. Edit Tanggal (besok)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        logAction.input('Tanggal Kegiatan Revisi via Flatpickr', '#editTanggal', tomorrowStr);
        await page.evaluate((d) => {
            if (typeof flatpickr !== 'undefined') {
                flatpickr('#editTanggal').setDate(d, true);
            } else {
                document.getElementById('editTanggal').value = d;
            }
        }, tomorrowStr);

        // 4d. Edit Jam Mulai & Selesai
        logAction.input('Jam Mulai Revisi', '#editJamMulai', '08:00');
        await page.locator('#editJamMulai').fill('08:00');

        logAction.input('Jam Selesai Revisi', '#editJamSelesai', '11:00');
        await page.locator('#editJamSelesai').fill('11:00');

        // 4e. Edit Radius Geofence
        logAction.input('Radius Meter Revisi', '#editGeoRadius', '150');
        const radiusInput = page.locator('#editGeoRadius');
        await radiusInput.click();
        await radiusInput.press('Control+A');
        await radiusInput.press('Backspace');
        await radiusInput.pressSequentially('150', { delay: 100 });

        // 4f. Edit Target OPD (Select OPD Dinas)
        logAction.step('Perbarui Target Perangkat Daerah');
        await page.evaluate(() => {
            if (typeof selectOpdDinas === 'function') {
                selectOpdDinas('edit');
            }
        });

        // 4g. Toggle Strict Mode Waktu & Lokasi
        logAction.step('Perbarui Pengaturan Strict Mode Waktu & Lokasi');
        const chkStrictTime = page.locator('#editStrictTime');
        if (!(await chkStrictTime.isChecked())) {
            await chkStrictTime.check();
        }

        // 4h. Klik Tombol Perbarui Jadwal (#btnSimpanEditKegiatan)
        logAction.click('Tombol Perbarui Jadwal', '#btnSimpanEditKegiatan');
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.status() === 200),
            page.click('#btnSimpanEditKegiatan')
        ]);

        await expect(modalEdit).toBeHidden({ timeout: 15000 });
        logAction.success('Update SELURUH data Jadwal Kegiatan berhasil');

        logAction.step('5. DELETE: Cari Jadwal Revisi via Filter & Hapus');
        await filterInput.click();
        await filterInput.press('Control+A');
        await filterInput.press('Backspace');
        await filterInput.pressSequentially(judulRevisi, { delay: 100 });

        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.status() === 200),
            page.click('#dashboardContainer button:has-text("CARI")')
        ]);

        const targetRow = page.locator('#listKegiatanBody tr').filter({ hasText: judulRevisi }).first();
        await expect(targetRow).toBeVisible({ timeout: 15000 });

        const btnDelete = targetRow.locator('button.btn-outline-danger, button[title="Hapus Jadwal"]').first();
        await expect(btnDelete).toBeVisible();
        logAction.click('Tombol Hapus Jadwal', 'Hapus');
        await btnDelete.click();

        logAction.verify('Memverifikasi dialog konfirmasi hapus SweetAlert');
        const swalConfirm = page.locator('.swal2-confirm');
        await expect(swalConfirm).toBeVisible({ timeout: 10000 });
        logAction.click('Konfirmasi Hapus (Ya, Hapus!)', '.swal2-confirm');
        await swalConfirm.click();

        const swalOk = page.locator('.swal2-confirm');
        if (await swalOk.isVisible({ timeout: 5000 }).catch(() => false)) {
            await swalOk.click();
        }
        logAction.success('Hapus Jadwal Kegiatan berhasil!');

        logAction.verify('Memverifikasi tidak ada console.error dan pageerror');
        expect(consoleErrors).toEqual([]);
        expect(pageErrors).toEqual([]);
        logAction.success('CRUD Jadwal Kegiatan BERHASIL SELESAI TANPA ERROR!');
    });

});
