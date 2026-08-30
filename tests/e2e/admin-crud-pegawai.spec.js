const { test, expect } = require('@playwright/test');
const { adminUser } = require('../fixtures/load-credentials');
const { attachLogger, logAction } = require('./test-logger');

test.describe('E2E Suite: Admin CRUD Data Pegawai Master', () => {

    const activeAdmin = adminUser || { nip: '198501012010011001', nik: '1377010101850001' };
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

        attachLogger(page, 'Admin CRUD Pegawai');
        logAction.navigate('admin/index.html');
        await page.goto('admin/index.html');
        await page.waitForLoadState('domcontentloaded');
        await doAdminLogin(page);
    });

    test('Full CRUD Lifecycle: Data Pegawai (Create, Read, Update All Fields Except NIP, Delete)', async ({ page }) => {
        logAction.step('1. Buka Menu Data -> Pegawai');
        logAction.click('Dropdown Menu Data', '#navbarDropdownData');
        await page.click('#navbarDropdownData');

        logAction.click('Menu Pegawai', 'a.dropdown-item:has-text("Pegawai")');
        await page.click('a.dropdown-item:has-text("Pegawai")');

        logAction.verify('Memverifikasi kontainer Manajemen Pegawai terbuka');
        const pegawaiContainer = page.locator('#pegawaiContainer');
        await expect(pegawaiContainer).toBeVisible({ timeout: 10000 });

        logAction.step('2. CREATE: Buka Modal & Tambah Pegawai Baru');
        const btnTambah = page.locator('button:has-text("Tambah Pegawai")');
        await expect(btnTambah).toBeVisible();
        logAction.click('Tombol Tambah Pegawai', 'button:has-text("Tambah Pegawai")');
        await btnTambah.click();

        const modalPegawai = page.locator('#modalPegawai');
        await expect(modalPegawai).toBeVisible({ timeout: 10000 });

        // NIP harus pas 18 digit angka, NIK pas 16 digit angka
        const rand3Digits = (Math.floor(100 + Math.random() * 900)).toString();
        const nipBaru = `199801012022011${rand3Digits}`; // 18 digit (4+4+6+1+3)
        const nikBaru = `1371061001980${rand3Digits}`;  // 16 digit (8+4+1+3)
        const namaBaru = `Pegawai Test ${rand3Digits}`;

        logAction.input('NIP Pegawai Baru (18 Digit)', '#pegawaiNip', nipBaru);
        await page.locator('#pegawaiNip').pressSequentially(nipBaru, { delay: 100 });

        logAction.input('Nama Pegawai Baru', '#pegawaiNama', namaBaru);
        await page.locator('#pegawaiNama').pressSequentially(namaBaru, { delay: 100 });

        logAction.input('NIK Pegawai Baru (16 Digit)', '#pegawaiNik', nikBaru);
        await page.locator('#pegawaiNik').pressSequentially(nikBaru, { delay: 100 });

        logAction.input('Jabatan Pegawai', '#pegawaiJabatan', 'Staf Analis E2E');
        await page.locator('#pegawaiJabatan').pressSequentially('Staf Analis E2E', { delay: 100 });

        logAction.step('Pilih Jenis ASN PNS');
        await page.locator('#pegawaiJenisAsn').selectOption('PNS');

        const selectOpd = page.locator('#pegawaiOpd');
        await page.waitForFunction(() => document.querySelectorAll('#pegawaiOpd option').length > 1);
        const opdOptions = await selectOpd.locator('option').all();
        if (opdOptions.length > 1) {
            const val = await opdOptions[1].getAttribute('value');
            await selectOpd.selectOption(val);
        }

        logAction.click('Tombol Simpan Pegawai', '#btnSimpanPegawai');
        await page.click('#btnSimpanPegawai');

        logAction.verify('Memverifikasi respons sukses & modal tertutup');
        const swalConfirm = page.locator('.swal2-confirm');
        if (await swalConfirm.isVisible({ timeout: 5000 }).catch(() => false)) {
            await swalConfirm.click();
        }
        await expect(modalPegawai).toBeHidden({ timeout: 10000 });

        logAction.step('3. READ: Cari NIP Pegawai Baru & Klik Tombol Cari');
        const searchInput = page.locator('#pegawaiSearchInput');
        await expect(searchInput).toBeVisible();

        logAction.input('Cari NIP Pegawai', '#pegawaiSearchInput', nipBaru);
        await searchInput.click();
        await searchInput.press('Control+A');
        await searchInput.press('Backspace');
        await searchInput.pressSequentially(nipBaru, { delay: 100 });

        const btnCariPegawai = page.locator('#pegawaiContainer button[onclick="loadPegawai()"]');
        await expect(btnCariPegawai).toBeVisible();
        logAction.click('Tombol Cari Pegawai', '#pegawaiContainer button[onclick="loadPegawai()"]');
        await btnCariPegawai.click();
        await page.waitForTimeout(1000);

        const tableRow = page.locator(`tr:has-text("${nipBaru}")`).first();
        await expect(tableRow).toBeVisible({ timeout: 15000 });
        logAction.success(`Pegawai "${namaBaru}" (NIP: ${nipBaru}) berhasil ditemukan di tabel`);

        logAction.step('4. UPDATE ALL FIELDS EXCEPT NIP: Edit Nama, NIK, OPD, Jabatan, Jenis ASN, & Role');
        const btnEdit = tableRow.locator('button.btn-warning, button:has-text("Edit"), button[onclick*="bukaModalEditPegawai"]').first();
        await expect(btnEdit).toBeVisible();
        logAction.click('Tombol Edit Pegawai', 'Edit');
        await btnEdit.click();

        await expect(modalPegawai).toBeVisible({ timeout: 10000 });

        // Verifikasi NIP bersifat Readonly (tidak bisa diedit)
        const nipInput = page.locator('#pegawaiNip');
        await expect(nipInput).toHaveAttribute('readonly', '');

        // 4a. Edit Nama Pegawai
        const namaRevisi = `${namaBaru} REVISI`;
        logAction.input('Nama Pegawai Revisi', '#pegawaiNama', namaRevisi);
        const inputNama = page.locator('#pegawaiNama');
        await inputNama.click();
        await inputNama.press('Control+A');
        await inputNama.press('Backspace');
        await inputNama.pressSequentially(namaRevisi, { delay: 100 });

        // 4b. Edit NIK Password Baru
        const rand3New = (Math.floor(100 + Math.random() * 900)).toString();
        const nikRevisi = `1371062002990${rand3New}`;
        logAction.input('NIK Password Revisi (16 Digit)', '#pegawaiNik', nikRevisi);
        const inputNik = page.locator('#pegawaiNik');
        await inputNik.click();
        await inputNik.press('Control+A');
        await inputNik.press('Backspace');
        await inputNik.pressSequentially(nikRevisi, { delay: 100 });

        // 4c. Edit Jabatan
        const inputJabatan = page.locator('#pegawaiJabatan');
        logAction.input('Jabatan Pegawai Revisi', '#pegawaiJabatan', 'Pranata Komputer Utama REVISI');
        await inputJabatan.click();
        await inputJabatan.press('Control+A');
        await inputJabatan.press('Backspace');
        await inputJabatan.pressSequentially('Pranata Komputer Utama REVISI', { delay: 100 });

        // 4d. Edit Jenis ASN -> PPPK
        logAction.step('Ubah Jenis ASN ke PPPK');
        await page.locator('#pegawaiJenisAsn').selectOption('PPPK');

        // 4e. Edit OPD (Pilih opsi OPD lain jika tersedia)
        const allOpdOpts = await selectOpd.locator('option').all();
        if (allOpdOpts.length > 2) {
            const newVal = await allOpdOpts[2].getAttribute('value');
            await selectOpd.selectOption(newVal);
        }

        // 4f. Edit Role -> Aktifkan Admin
        const chkRoleAdmin = page.locator('#roleAdmin');
        if (await chkRoleAdmin.isEnabled() && !(await chkRoleAdmin.isChecked())) {
            logAction.click('Centang Role Admin', '#roleAdmin');
            await chkRoleAdmin.check();
        }

        logAction.click('Tombol Simpan Perubahan Pegawai', '#btnSimpanPegawai');
        await page.click('#btnSimpanPegawai');

        const swalOk = page.locator('.swal2-confirm');
        if (await swalOk.isVisible({ timeout: 5000 }).catch(() => false)) {
            await swalOk.click();
        }
        await expect(modalPegawai).toBeHidden({ timeout: 10000 });
        logAction.success('Update SELURUH data Pegawai (Nama, NIK, Jabatan, Jenis ASN, OPD, Role) berhasil');

        logAction.step('5. DELETE: Hapus Data Pegawai');
        await searchInput.click();
        await searchInput.press('Control+A');
        await searchInput.press('Backspace');
        await searchInput.pressSequentially(nipBaru, { delay: 100 });
        await btnCariPegawai.click();
        await page.waitForTimeout(1000);

        const targetRow = page.locator(`tr:has-text("${nipBaru}")`).first();
        await expect(targetRow).toBeVisible({ timeout: 15000 });

        const btnDelete = targetRow.locator('button.btn-danger, button:has-text("Hapus"), button[onclick*="hapusPegawai"]').first();
        await expect(btnDelete).toBeVisible();
        logAction.click('Tombol Hapus Pegawai', 'Hapus');
        await btnDelete.click();

        const swalDeleteConfirm = page.locator('.swal2-confirm');
        await expect(swalDeleteConfirm).toBeVisible({ timeout: 10000 });
        logAction.click('Konfirmasi Hapus (Ya, Hapus!)', '.swal2-confirm');
        await swalDeleteConfirm.click();

        const swalOkDel = page.locator('.swal2-confirm');
        if (await swalOkDel.isVisible({ timeout: 5000 }).catch(() => false)) {
            await swalOkDel.click();
        }
        logAction.success('Hapus Data Pegawai berhasil!');

        logAction.verify('Memverifikasi tidak ada console.error dan pageerror');
        expect(consoleErrors).toEqual([]);
        expect(pageErrors).toEqual([]);
        logAction.success('CRUD Data Pegawai BERHASIL SELESAI TANPA ERROR!');
    });

});
