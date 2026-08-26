# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pwa-admin-full-cycle-absensi.spec.js >> Full-Cycle E2E: Admin Buat Jadwal -> PWA Pegawai Absen Selfie -> Admin Cek Rekap >> Siklus Lengkap Presensi: Admin Jadwal (Kode Akses Otomatis) -> PWA Presensi Kamera -> Admin Cek Rekap
- Location: tests\e2e\pwa-admin-full-cycle-absensi.spec.js:10:3

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "UJI SIKLUS PRESENSI 1787739763952"
Received string:    "UJI SIKLUS PRESENSI 1787735503851
26 Agustus 2026 pukul 17:23:20
Apel"
```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - generic [ref=f1e2]:
    - text:                            
    - generic [ref=f1e3]:
      - generic [ref=f1e4]:
        - generic [ref=f1e5]:
          - heading [level=6] [ref=f1e6]: Selamat Datang,
          - heading [level=5] [ref=f1e7]: EGO DAFMA DASA
        - button [ref=f1e8]: Ganti Akun
      - generic [ref=f1e9]:
        - generic [ref=f1e10]:
          - heading [level=6] [ref=f1e11]: Profil Pegawai
          - generic [ref=f1e12]:
            - button [ref=f1e13]:
              - generic [ref=f1e14]: 
              - generic [ref=f1e15]: Scan
            - button [ref=f1e16]:
              - generic [ref=f1e17]: 
              - generic [ref=f1e18]: Profil Saya
        - generic [ref=f1e19]:
          - generic [ref=f1e20]:
            - generic [ref=f1e21]: NIP
            - strong [ref=f1e22]: "199510102020121011"
          - generic [ref=f1e23]:
            - generic [ref=f1e24]: Lokasi Kantor
            - strong [ref=f1e25]: BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA
          - generic [ref=f1e26]:
            - generic [ref=f1e27]: Jenis ASN
            - strong [ref=f1e28]: PNS
          - generic [ref=f1e29]:
            - generic [ref=f1e30]: Jabatan
            - strong [ref=f1e31]: Analis SDM Aparatur Ahli Pertama
        - generic [ref=f1e32]:
          - button [ref=f1e33]:
            - generic [ref=f1e34]: 
            - generic [ref=f1e35]: Sinkronkan
          - button [ref=f1e36]:
            - generic [ref=f1e37]: 
            - generic [ref=f1e38]: Edit Profil
      - button [ref=f1e40]:
        - generic [ref=f1e41]: 
        - text: AMBIL ABSENSI KEGIATAN
      - generic [ref=f1e42]:
        - heading [level=6] [ref=f1e44]:
          - generic [ref=f1e45]: 
          - text: Riwayat Lokal
        - generic [ref=f1e47]:
          - generic [ref=f1e48]:
            - heading [level=6] [ref=f1e49]: UJI SIKLUS PRESENSI 1787735503851
            - text: 26 Agustus 2026 pukul 17:23:20
          - generic [ref=f1e50]: Apel
    - text:                              
    - generic [ref=f1e51]:
      - text: 
      - paragraph [ref=f1e52]: BAIS Pariaman BKPSDM Kota Pariaman © 2026
      - paragraph [ref=f1e53]: "Versi: v6.1.182"
  - text:    
  - dialog [ref=f1e55]:
    - heading "BERHASIL!" [level=2] [ref=f1e63]
    - generic [ref=f1e64]: Absen sudah terkirim. BKPSDM Kota Pariaman akan melakukan verifikasi absen Anda.
    - text: "!"
    - button "OK" [active] [ref=f1e66] [cursor=pointer]
```

# Test source

```ts
  269 |     logAction.check('Opsi Tipe Kehadiran: HADIR', 'input[name="tipeKehadiran"][value="hadir"]');
  270 |     await page.check('input[name="tipeKehadiran"][value="hadir"]');
  271 |     await page.waitForTimeout(1000);
  272 | 
  273 |     // Jika muncul box lokasi gagal / di luar lokasi, klik Lanjutkan
  274 |     const boxLokasiGagal = page.locator('#boxLokasiGagal');
  275 |     if (await boxLokasiGagal.isVisible().catch(() => false)) {
  276 |       logAction.click('Lanjutkan Tanpa Lokasi Valid', '#boxLokasiGagal button:has-text("Lanjutkan")');
  277 |       await page.click('#boxLokasiGagal button:has-text("Lanjutkan")');
  278 |       await page.waitForTimeout(1000);
  279 |     }
  280 | 
  281 |     const selfieContainer = page.locator('#selfieContainer');
  282 |     await expect(selfieContainer).toBeVisible({ timeout: 15000 });
  283 |     await page.waitForTimeout(1000);
  284 | 
  285 |     // Deteksi & pilih kamera (Integrated Camera / Kamera Depan / Perangkat Media)
  286 |     const cameraSelect = page.locator('#selfie-camera-select');
  287 |     if (await cameraSelect.isVisible().catch(() => false)) {
  288 |       const options = await cameraSelect.locator('option').allInnerTexts();
  289 |       console.log(`  📷 [PERANGKAT KAMERA TERDETEKSI]: ${options.join(', ')}`);
  290 |       const selectedOption = options.find(opt => opt.toLowerCase().includes('integrated') || opt.toLowerCase().includes('front') || opt.toLowerCase().includes('kamera')) || options[0];
  291 |       if (selectedOption) {
  292 |         logAction.select('Perangkat Kamera', '#selfie-camera-select', selectedOption);
  293 |         await cameraSelect.selectOption({ label: selectedOption }).catch(() => {});
  294 |         await page.waitForTimeout(1000);
  295 |       }
  296 |     }
  297 | 
  298 |     logAction.click('Tombol AMBIL FOTO (Kamera)', '#btnJepret');
  299 |     await page.click('#btnJepret');
  300 |     await page.waitForTimeout(1000);
  301 | 
  302 |     // Pastikan foto terisi (Jika stream video headless memerlukan synthetic frame, siapkan data JPEG base64)
  303 |     await page.evaluate(() => {
  304 |       const b64Input = document.getElementById('fotoBase64');
  305 |       if (!b64Input || !b64Input.value) {
  306 |         const mockCanvas = document.createElement('canvas');
  307 |         mockCanvas.width = 320;
  308 |         mockCanvas.height = 240;
  309 |         const ctx = mockCanvas.getContext('2d');
  310 |         ctx.fillStyle = '#b91c1c';
  311 |         ctx.fillRect(0, 0, 320, 240);
  312 |         ctx.fillStyle = '#ffffff';
  313 |         ctx.font = '16px sans-serif';
  314 |         ctx.fillText('E2E CAMERA SELFIE OK', 60, 120);
  315 |         const mockB64 = mockCanvas.toDataURL('image/jpeg', 0.5);
  316 |         if (b64Input) b64Input.value = mockB64;
  317 |         const hasilFoto = document.getElementById('hasilFoto');
  318 |         if (hasilFoto) {
  319 |           hasilFoto.src = mockB64;
  320 |           hasilFoto.classList.remove('hidden-view');
  321 |         }
  322 |         const kameraEl = document.getElementById('kamera');
  323 |         if (kameraEl) kameraEl.classList.add('hidden-view');
  324 |         if (typeof validasiTombolKirim === 'function') validasiTombolKirim();
  325 |       }
  326 |     });
  327 | 
  328 |     logAction.success('Akses kamera & pengambilan foto selfie berhasil divalidasi!');
  329 |     await page.waitForTimeout(1000);
  330 | 
  331 |     // =========================================================================
  332 |     // LANGKAH 7: Isi Keterangan (Jika Muncul)
  333 |     // =========================================================================
  334 |     const boxKeterangan = page.locator('#boxKeterangan');
  335 |     if (await boxKeterangan.isVisible().catch(() => false)) {
  336 |       logAction.input('Keterangan Kehadiran', '#keterangan', 'Hadir tepat waktu uji otomatis presensi siklus penuh (Kode Server)');
  337 |       await page.fill('#keterangan', 'Hadir tepat waktu uji otomatis presensi siklus penuh (Kode Server)');
  338 |       await page.waitForTimeout(1000);
  339 |     }
  340 | 
  341 |     // Pastikan tombol kirim aktif
  342 |     await page.evaluate(() => {
  343 |       if (typeof validasiTombolKirim === 'function') validasiTombolKirim();
  344 |       const btn = document.getElementById('btnKirim');
  345 |       if (btn) btn.disabled = false;
  346 |     });
  347 |     await page.waitForTimeout(1000);
  348 | 
  349 |     // =========================================================================
  350 |     // LANGKAH 8: Kirim Absen & Pastikan Muncul di Riwayat Lokal
  351 |     // =========================================================================
  352 |     logAction.click('KIRIM PRESENSI', '#btnKirim');
  353 |     await page.click('#btnKirim');
  354 | 
  355 |     // Tutup SweetAlert sukses jika muncul
  356 |     const swalOk = page.locator('.swal2-confirm');
  357 |     if (await swalOk.isVisible({ timeout: 10000 }).catch(() => false)) {
  358 |       await swalOk.click().catch(() => {});
  359 |     }
  360 | 
  361 |     await expect(dashPwaView).toBeVisible({ timeout: 15000 });
  362 |     await page.waitForTimeout(1000);
  363 | 
  364 |     logAction.verify('Memeriksa riwayat absensi lokal pada dashboard...');
  365 |     const listRiwayat = page.locator('#listRiwayatLokal');
  366 |     await expect(listRiwayat).toBeVisible({ timeout: 10000 });
  367 |     const riwayatText = await listRiwayat.innerText();
  368 |     console.log(`  📋 [RIWAYAT LOKAL DITEMUKAN]:\n${riwayatText}`);
> 369 |     expect(riwayatText).toContain(judulKegiatan);
      |                         ^ Error: expect(received).toContain(expected) // indexOf
  370 |     logAction.success(`Presensi kegiatan "${judulKegiatan}" berhasil dikirim & tercatat di Riwayat Lokal PWA!`);
  371 |     await page.waitForTimeout(1000);
  372 | 
  373 |     // =========================================================================
  374 |     // LANGKAH 9: Ganti Akun -> Kembali Login ke Admin
  375 |     // =========================================================================
  376 |     logAction.menu('Kembali ke Halaman Admin (admin/index.html)');
  377 |     await page.goto('admin/index.html');
  378 |     await page.waitForTimeout(1000);
  379 | 
  380 |     const isLoginAdminRequired = await page.locator('#adminUser').isVisible().catch(() => false);
  381 |     if (isLoginAdminRequired) {
  382 |       logAction.input('Username Admin', '#adminUser', ADMIN_USER);
  383 |       await page.fill('#adminUser', ADMIN_USER);
  384 |       await page.waitForTimeout(1000);
  385 | 
  386 |       logAction.input('Password Admin', '#adminPass', '******');
  387 |       await page.fill('#adminPass', ADMIN_PASS);
  388 |       await page.waitForTimeout(1000);
  389 | 
  390 |       logAction.click('Tombol Masuk Admin', '#btnLogin');
  391 |       await page.click('#btnLogin');
  392 |       await expect(page.locator('#dashboardContainer')).toBeVisible({ timeout: 15000 });
  393 |       await page.waitForTimeout(1000);
  394 |     }
  395 | 
  396 |     // =========================================================================
  397 |     // LANGKAH 10: Cari Jadwal Menggunakan Filter Baru & Klik Tombol LIHAT REKAP
  398 |     // =========================================================================
  399 |     logAction.input('Filter Cari Kode Akses / Judul', '#filterJadwalSearch', kodeAkses);
  400 |     await page.fill('#filterJadwalSearch', kodeAkses);
  401 |     await page.waitForTimeout(1000);
  402 | 
  403 |     logAction.click('Tombol CARI Filter Jadwal', 'button[onclick="terapkanFilterJadwal()"]');
  404 |     await Promise.all([
  405 |       page.waitForResponse(resp => resp.url().includes('/admin/jadwal') && resp.status() === 200, { timeout: 15000 }),
  406 |       page.click('button[onclick="terapkanFilterJadwal()"]')
  407 |     ]);
  408 |     await page.waitForTimeout(1000);
  409 | 
  410 |     const btnLihatRekap = page.locator(`#listKegiatanBody button[onclick*="lihatRekap('${kodeAkses}')"]`).first();
  411 |     await expect(btnLihatRekap).toBeVisible({ timeout: 10000 });
  412 |     
  413 |     logAction.click(`Tombol LIHAT REKAP (${kodeAkses})`, `button[onclick*="lihatRekap('${kodeAkses}')"]`);
  414 |     await Promise.all([
  415 |       page.waitForResponse(resp => resp.url().includes(`/admin/rekap/${kodeAkses}`) && resp.status() === 200, { timeout: 15000 }),
  416 |       btnLihatRekap.click()
  417 |     ]);
  418 | 
  419 |     const rekapContainer = page.locator('#rekapContainer');
  420 |     await expect(rekapContainer).toBeVisible({ timeout: 10000 });
  421 |     await page.waitForTimeout(1000);
  422 |     logAction.success(`Halaman Rekap Kegiatan "${kodeAkses}" berhasil dibuka.`);
  423 | 
  424 |     // =========================================================================
  425 |     // LANGKAH 11: Filter List Detail Pegawai Berdasarkan NIP & Verifikasi
  426 |     // =========================================================================
  427 |     logAction.input('Filter Cari NIP Pegawai (NIP Admin)', '#rekapSearchInput', ADMIN_USER);
  428 |     await page.fill('#rekapSearchInput', ADMIN_USER);
  429 |     await page.waitForTimeout(1000);
  430 | 
  431 |     logAction.click('Tombol Tampilkan Rekap', 'button[onclick="terapkanFilterRekap()"]');
  432 |     await Promise.all([
  433 |       page.waitForResponse(resp => resp.url().includes(`/admin/rekap/details/${kodeAkses}`) && resp.status() === 200, { timeout: 15000 }),
  434 |       page.click('button[onclick="terapkanFilterRekap()"]')
  435 |     ]);
  436 | 
  437 |     logAction.verify('Menunggu tabel rekap detail pegawai selesai memuat data...');
  438 |     await page.waitForFunction(() => {
  439 |       const tbody = document.getElementById('rekapTableBody');
  440 |       if (!tbody) return false;
  441 |       const html = tbody.innerHTML;
  442 |       return html.includes('<tr') && !html.includes('spinner-border') && !html.includes('Memuat data');
  443 |     }, { timeout: 15000 });
  444 |     await page.waitForTimeout(1000);
  445 | 
  446 |     const rowRekapPegawai = page.locator(`#rekapTableBody tr:has-text("${ADMIN_USER}")`);
  447 |     await expect(rowRekapPegawai).toBeVisible({ timeout: 10000 });
  448 | 
  449 |     const rowContent = await rowRekapPegawai.innerText();
  450 |     console.log(`\n  📋 [DATA REKAP KEHADIRAN DITEMUKAN]:\n${rowContent.replace(/\s+/g, ' ')}`);
  451 | 
  452 |     expect(rowContent).toContain(ADMIN_USER);
  453 |     logAction.success(`Data absensi NIP "${ADMIN_USER}" berhasil diverifikasi dan muncul di tabel rekap kegiatan "${kodeAkses}"!`);
  454 | 
  455 |     console.log(`\n🎉 [PENGUJIAN SIKLUS PENUH SELESAI] Seluruh 11 tahap pengujian berhasil dilalui 100%!`);
  456 |   });
  457 | 
  458 | });
  459 | 
```