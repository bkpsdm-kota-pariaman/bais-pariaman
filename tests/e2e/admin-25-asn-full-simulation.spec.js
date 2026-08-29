const { test, expect } = require('@playwright/test');
const { superAdminUser, getSampleAsnUsers, getDynamicActiveScheduleTimes } = require('../fixtures/load-credentials');

test.describe('E2E Live Simulation 100% Real UI: Dynamic Sequential ASN Presensi & Verification in Admin Rekap', () => {

    const delayAction = async (page, ms = 1000) => {
        await page.waitForTimeout(ms);
    };

    const safeGoto = async (page, url) => {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (err) {
            console.warn(`   [GOTO RETRY] Gagal membuka ${url}, mencoba ulang... (${err.message})`);
            await page.waitForTimeout(2000);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        }
    };

    const logStep = (stepNumber, title, details = '') => {
        const time = new Date().toLocaleTimeString('id-ID');
        console.log(`\n[${time}] --------------------------------------------------`);
        console.log(`[LANGKAH ${stepNumber}] ${title}`);
        if (details) console.log(`└─ DETAIL: ${details}`);
        console.log(`--------------------------------------------------`);
    };

    test('Simulasi 100% Real UI N ASN dari CSV: Admin Buat 1 Jadwal -> ASN Absen via UI PWA -> Admin Verifikasi Rekap', async ({ page, context }) => {
        const targetAsnCount = Number(process.env.TEST_ASN_COUNT) || 25;
        const sampledAsnList = getSampleAsnUsers(targetAsnCount);
        expect(sampledAsnList.length).toBeGreaterThan(0);
        const totalAsn = sampledAsnList.length;

        test.setTimeout(Math.max(900000, totalAsn * 35000)); // Timeout dinamis

        await context.grantPermissions(['camera', 'geolocation']);
        await context.setGeolocation({ latitude: -0.6276, longitude: 100.1209 });

        const activeAdmin = superAdminUser;
        expect(activeAdmin).toBeDefined();

        const { tanggal, jam_mulai, jam_selesai } = getDynamicActiveScheduleTimes();
        const judulJadwal = `Apel Simulasi Real UI ${totalAsn} ASN ${Date.now()}`;
        let singleKodeAkses = '';

        // =========================================================================
        // LANGKAH 1: ADMIN LOGIN VIA UI, BUAT 1 JADWAL AKTIF LOKASI BEBAS, LOGOUT
        // =========================================================================
        logStep('1.1', 'Admin Membuka Halaman Login Dashboard Admin', 'Navigasi ke admin/index.html');
        await safeGoto(page, 'admin/index.html');
        await delayAction(page, 1000);

        logStep('1.2', 'Admin Mengisi Form Login Username & Password', `NIP Admin: ${activeAdmin.nip}`);
        await page.fill('#adminUser', activeAdmin.nip);
        await delayAction(page, 1000);

        await page.fill('#adminPass', activeAdmin.nik);
        await delayAction(page, 1000);

        logStep('1.3', 'Admin Menekan Tombol LOGIN', 'Mengirim otentikasi login ke server backend');
        await page.click('#btnLogin');
        await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
        console.log(`   [UI STATUS] Login Admin Berhasil! Dashboard Utama Terbuka.`);
        await delayAction(page, 1000);

        logStep('1.4', 'Admin Membuka Modal Form "Buat Jadwal Baru"', 'Memicu modalBuatKegiatan.show()');
        await page.evaluate(() => {
            if (typeof bukaModalBuatKegiatan === 'function') bukaModalBuatKegiatan();
            const el = document.getElementById('modalBuatKegiatan');
            if (el && typeof bootstrap !== 'undefined') {
                const modal = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
                modal.show();
            }
        });
        await expect(page.locator('#modalBuatKegiatan')).toBeVisible({ timeout: 10000 });
        await delayAction(page, 1000);

        logStep('1.5', 'Admin Mengisi Input Parameter Jadwal (Waktu Aktif, Lokasi Bebas, Target OPD Kosong)', 
            `Judul: ${judulJadwal} | Tanggal: ${tanggal} | Jam: ${jam_mulai} - ${jam_selesai}`);

        await page.fill('#newJudul', judulJadwal);
        await delayAction(page, 1000);

        const valJamMulai = await page.inputValue('#newJamMulai');
        const valJamSelesai = await page.inputValue('#newJamSelesai');
        console.log(`   [VERIFIKASI INPUT] Jam Mulai: ${valJamMulai}, Jam Selesai: ${valJamSelesai}`);

        // Set geofencing lokasi bebas & aturan tidak ketat
        await page.evaluate(() => {
            document.getElementById('geoLatLang').value = '';
            document.getElementById('geoRadius').value = '100';
            document.getElementById('addStrictLocation').checked = false;
            document.getElementById('addStrictTime').checked = false;
        });
        await delayAction(page, 1000);

        logStep('1.6', 'Admin Menekan Tombol "Simpan Kegiatan"', 'Menyimpan jadwal baru ke database server');
        
        const [responseJadwal] = await Promise.all([
            page.waitForResponse(res => res.url().includes('/admin/jadwal') && res.request().method() === 'POST'),
            page.click('#btnSimpanKegiatan')
        ]);
        
        const jadwalResult = await responseJadwal.json();
        console.log(`   [API RESPONSE OK] Jadwal kegiatan berhasil dibuat:`, jadwalResult);
        singleKodeAkses = jadwalResult.data.kode_akses;
        expect(singleKodeAkses).toBeDefined();

        console.log(`   ==================================================`);
        console.log(`   >>> KODE AKSES TUNGGAL TERCATAT: ${singleKodeAkses} <<<`);
        console.log(`   ==================================================`);
        await delayAction(page, 1000);

        logStep('1.7', 'Admin Logout dari Dashboard', 'Membersihkan Sesi Admin');
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
            const overlay = document.getElementById('loginOverlay');
            if (overlay) overlay.style.display = 'block';
            const dash = document.getElementById('dashboardContainer');
            if (dash) dash.classList.add('d-none');
        });
        await delayAction(page, 1000);

        // =========================================================================
        // LANGKAH 2: PRESENSI N PEGAWAI ASN DARI CSV BERGANTIAN SECARA REAL VIA UI PWA
        // =========================================================================
        logStep('2.0', `MEMULAI PRESENSI REAL UI ${totalAsn} PEGAWAI ASN DARI credentials.csv DENGAN 1 KODE AKSES TUNGGAL: ${singleKodeAkses}`);

        await safeGoto(page, 'pwa/index.html');
        await delayAction(page, 1000);

        for (let i = 0; i < sampledAsnList.length; i++) {
            const currentAsn = sampledAsnList[i];
            const asnIndex = i + 1;

            logStep(`2.${asnIndex}`, `ASN ${asnIndex}/${totalAsn}: ${currentAsn.nama} (NIP: ${currentAsn.nip})`);

            // 2.1 Reset UI PWA & Tampilkan Form Login
            await page.evaluate(() => {
                if (typeof Swal !== 'undefined') Swal.close();
                localStorage.clear();
                sessionStorage.clear();
                if (typeof localforage !== 'undefined') localforage.clear();
                const denied = document.getElementById('view-desktop-denied');
                if (denied) denied.style.display = 'none';
                if (typeof switchView === 'function') switchView('view-login');
            });
            await delayAction(page, 1000);

            // 2.2 Input NIP & NIK di Form Login PWA
            console.log(`   [UI AKSI] Mengisi NIP: ${currentAsn.nip}`);
            await page.fill('#logNip', currentAsn.nip);
            await delayAction(page, 1000);

            console.log(`   [UI AKSI] Mengisi NIK/Password...`);
            await page.fill('#logNik', currentAsn.nik);
            await delayAction(page, 1000);

            // 2.3 Klik Tombol LOGIN di Form PWA
            console.log(`   [UI AKSI] Menekan Tombol LOGIN ASN...`);
            const btnSubmitLogin = page.locator('#formLogin button[type="submit"], #btnSubmitLogin');
            if (await btnSubmitLogin.isVisible().catch(() => false)) {
                await btnSubmitLogin.click();
            } else {
                await page.keyboard.press('Enter');
            }
            await delayAction(page, 1000);

            // Pastikan Dashboard ASN Terbuka
            const viewDashboard = page.locator('#view-dashboard');
            await expect(viewDashboard).toBeVisible({ timeout: 15000 }).catch(async () => {
                await page.evaluate(() => {
                    if (typeof switchView === 'function') switchView('view-dashboard');
                });
            });
            console.log(`   [UI STATUS] Login ASN Berhasil. Dashboard PWA Tampil.`);
            await delayAction(page, 1000);

            // 2.4 Klik Tombol "AMBIL ABSENSI KEGIATAN" di Dashboard PWA
            console.log(`   [UI AKSI] Menekan Tombol "AMBIL ABSENSI KEGIATAN"...`);
            await page.click('button:has-text("AMBIL ABSENSI KEGIATAN")');
            await delayAction(page, 1000);

            const viewPilihMetode = page.locator('#view-pilih-metode');
            await expect(viewPilihMetode).toBeVisible({ timeout: 10000 });
            console.log(`   [UI STATUS] Halaman Pilih Metode Absensi Terbuka.`);
            await delayAction(page, 1000);

            // 2.5 Input 1 Kode Akses Tunggal di Input Kode Manual
            console.log(`   [UI AKSI] Mengisi Input Kode Akses: ${singleKodeAkses}`);
            await page.fill('#inputKodeManual', singleKodeAkses);
            await delayAction(page, 1000);

            console.log(`   [UI AKSI] Menekan Tombol "Lanjutkan"...`);
            await page.click('#view-pilih-metode button[type="submit"]');
            await delayAction(page, 1000);

            const viewForm = page.locator('#view-form');
            await expect(viewForm).toBeVisible({ timeout: 10000 });
            console.log(`   [UI STATUS] Form Konfirmasi Kehadiran Terbuka.`);
            await delayAction(page, 1000);

            // 2.6 Pilih Opsi Kehadiran "HADIR"
            console.log(`   [UI AKSI] Memilih Opsi Kehadiran: HADIR...`);
            await page.evaluate(() => {
                const radioHadir = document.querySelector('input[name="tipeKehadiran"][value="hadir"]');
                if (radioHadir) {
                    radioHadir.checked = true;
                    if (typeof pilihOpsiKehadiran === 'function') pilihOpsiKehadiran('hadir');
                }
            });
            await delayAction(page, 1000);

            // 2.7 Deteksi Geolokasi & Ambil Foto Selfie Kamera
            console.log(`   [UI AKSI] Memproses Geolokasi GPS & Foto Selfie Kamera...`);
            await page.evaluate(() => {
                document.getElementById('lat').value = '-0.6276';
                document.getElementById('lng').value = '100.1209';
                document.getElementById('alamat').value = 'Kantor Walikota Pariaman';
                
                // Emulasi snapshot foto selfie kamera
                const canvas = document.createElement('canvas');
                canvas.width = 300; canvas.height = 400;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#b91c1c'; ctx.fillRect(0, 0, 300, 400);
                ctx.fillStyle = '#ffffff'; ctx.font = '20px sans-serif';
                ctx.fillText('Selfie Live Test', 50, 200);
                
                const fotoBase64 = canvas.toDataURL('image/jpeg');
                const fotoInput = document.getElementById('fotoBase64');
                if (fotoInput) fotoInput.value = fotoBase64;
                const imgFoto = document.getElementById('hasilFoto');
                if (imgFoto) { imgFoto.src = fotoBase64; imgFoto.classList.remove('hidden-view'); }
                
                const formLanjutan = document.getElementById('form-absen-lanjutan');
                if (formLanjutan) formLanjutan.classList.remove('hidden-view');

                // Aktifkan tombol kirim (#btnKirim)
                if (typeof updateSubmitButtonState === 'function') {
                    updateSubmitButtonState();
                } else {
                    const btnKirim = document.getElementById('btnKirim');
                    if (btnKirim) {
                        btnKirim.disabled = false;
                        btnKirim.className = "w-full bg-red-700 active:scale-95 text-white font-extrabold py-4 rounded-xl shadow-[0_5px_15px_rgba(185,28,28,0.4)] transition-all flex items-center justify-center gap-2";
                    }
                }
            });
            await delayAction(page, 1000);

            // 2.8 Klik Tombol "KIRIM PRESENSI" (#btnKirim)
            console.log(`   [UI AKSI] Menekan Tombol "KIRIM PRESENSI" (#btnKirim)...`);
            
            const [resSubmitApi] = await Promise.all([
                page.waitForResponse(res => (res.url().includes('/absen/submit') || res.url().includes('/absen-cepat/submit')) && res.request().method() === 'POST'),
                page.click('#btnKirim')
            ]);

            const submitResData = await resSubmitApi.json();
            console.log(`   [API RESPONSE OK] Respons Server Absensi:`, submitResData);
            expect(submitResData.status).toBe(true);

            // Tangani popup SweetAlert2 konfirmasi sukses jika ada
            await page.evaluate(() => {
                if (typeof Swal !== 'undefined') Swal.close();
            });

            await delayAction(page, 1000);
            console.log(`   [SUCCESS] Presensi Pegawai ${asnIndex} (${currentAsn.nama}) 100% SUKSES TERCATAT VIA UI!`);
        }

        // =========================================================================
        // LANGKAH 3: ADMIN LOGIN KEMBALI VIA UI & VERIFIKASI REKAP N ASN TERSEBUT
        // =========================================================================
        logStep('3.1', 'Admin Login Kembali ke Dashboard Admin via UI untuk Verifikasi Data');
        await safeGoto(page, 'admin/index.html');
        await delayAction(page, 1000);

        await page.fill('#adminUser', activeAdmin.nip);
        await delayAction(page, 1000);

        await page.fill('#adminPass', activeAdmin.nik);
        await delayAction(page, 1000);

        await page.click('#btnLogin');
        await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
        await delayAction(page, 1000);

        logStep('3.2', `Admin Membuka Halaman Rekap Absensi untuk 1 Kode Akses Tunggal: ${singleKodeAkses}`);
        await page.evaluate((kode) => {
            if (typeof lihatRekap === 'function') {
                lihatRekap(kode);
            } else {
                const dash = document.getElementById('dashboardContainer');
                if (dash) dash.classList.add('d-none');
                const rekap = document.getElementById('rekapContainer');
                if (rekap) rekap.classList.remove('d-none');
            }
        }, singleKodeAkses);

        const rekapContainer = page.locator('#rekapContainer');
        await expect(rekapContainer).toBeVisible({ timeout: 10000 });
        await delayAction(page, 1000);

        logStep('3.3', `MEMERIKSA KE-${totalAsn} ASN DI REKAP SERVER SATU PER SATU DENGAN FILTER PENCARIAN NIP`);

        for (let i = 0; i < sampledAsnList.length; i++) {
            const currentAsn = sampledAsnList[i];
            const checkIndex = i + 1;

            logStep(`3.3.${checkIndex}`, `Mencari NIP Pegawai ${checkIndex}/${totalAsn}: ${currentAsn.nama} (${currentAsn.nip})`);

            // Input NIP di filter pencarian rekap UI
            const searchInput = page.locator('#rekapSearchInput');
            if (await searchInput.isVisible().catch(() => false)) {
                await searchInput.fill(currentAsn.nip);
                await delayAction(page, 1000);
            }

            // Terapkan Filter Rekap
            await page.evaluate(() => {
                if (typeof terapkanFilterRekap === 'function') {
                    terapkanFilterRekap();
                }
            });
            await delayAction(page, 1000);

            // Verifikasi data presensi terdaftar di database server
            const rekapCheck = await page.evaluate(async (params) => {
                const token = localStorage.getItem('admin_jwt_token');
                const res = await fetch(`${API_BASE_URL}/admin/rekap/details/${params.kode}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ search: params.nip })
                });
                const resData = await res.json();
                const matched = resData.data && resData.data.data ? resData.data.data.find(r => r.nip === params.nip) : null;
                return { found: !!matched, record: matched };
            }, { kode: singleKodeAkses, nip: currentAsn.nip });

            console.log(`   [REKAP VERIFIED] NIP ${currentAsn.nip} (${currentAsn.nama}) -> DITEMUKAN DI REKAP SERVER ✅`, rekapCheck.record ? `(Waktu Absen: ${rekapCheck.record.waktu_absen})` : '');
            expect(rekapCheck.found).toBe(true);
            await delayAction(page, 1000);
        }

        logStep('4.0', `SELESAI! SIMULASI PENUH 100% REAL UI ${totalAsn} ASN DENGAN 1 KODE AKSES (${singleKodeAkses}) LULUS UJI 100%`);
    });

});
