# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pwa-pegawai-flow.spec.js >> PWA / Browser Pegawai Flow (Non-PWA Mode) >> Tahap 3: Uji Coba Komponen Dashboard, QR Identitas, Edit Profil & Sinkronisasi
- Location: tests\e2e\pwa-pegawai-flow.spec.js:115:3

# Error details

```
Error: expect(locator).toBeHidden() failed

Locator:  locator('#modalEditProfil')
Expected: hidden
Received: visible
Timeout:  10000ms

Call log:
  - Expect "toBeHidden" with timeout 10000ms
  - waiting for locator('#modalEditProfil')
    4 × locator resolved to <div id="modalEditProfil" class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">…</div>
      - unexpected value "visible"
    19 × locator resolved to <div aria-hidden="true" id="modalEditProfil" class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">…</div>
       - unexpected value "visible"

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - text:                         
    - generic [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - heading [level=6] [ref=e6]: Selamat Datang,
          - heading [level=5] [ref=e7]: EGO DAFMA DASA
        - button [ref=e8]: Ganti Akun
      - generic [ref=e9]:
        - generic [ref=e10]:
          - heading [level=6] [ref=e11]: Profil Pegawai
          - generic [ref=e12]:
            - button [ref=e13]:
              - generic [ref=e14]: 
              - generic [ref=e15]: Scan
            - button [ref=e16]:
              - generic [ref=e17]: 
              - generic [ref=e18]: Profil Saya
        - generic [ref=e19]:
          - generic [ref=e20]:
            - generic [ref=e21]: NIP
            - strong [ref=e22]: "199510102020121011"
          - generic [ref=e23]:
            - generic [ref=e24]: Lokasi Kantor
            - strong [ref=e25]: BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA
          - generic [ref=e26]:
            - generic [ref=e27]: Jenis ASN
            - strong [ref=e28]: PNS
          - generic [ref=e29]:
            - generic [ref=e30]: Jabatan
            - strong [ref=e31]: Analis SDM Aparatur Ahli Pertama - E2E - E2E
        - generic [ref=e32]:
          - button [ref=e33]:
            - generic [ref=e34]: 
            - generic [ref=e35]: Sinkronkan
          - button [ref=e36]:
            - generic [ref=e37]: 
            - generic [ref=e38]: Edit Profil
      - button [ref=e40]:
        - generic [ref=e41]: 
        - text: AMBIL ABSENSI KEGIATAN
      - generic [ref=e42]:
        - heading [level=6] [ref=e44]:
          - generic [ref=e45]: 
          - text: Riwayat Lokal
        - generic [ref=e46]: Belum ada riwayat absensi lokal.
    - text:                               
    - generic [ref=e48]:
      - text: 
      - paragraph [ref=e49]: BAIS Pariaman Kota Pariaman © 2026
      - paragraph [ref=e50]: "Versi: v6.1.169"
  - generic [ref=e52]:
    - generic [ref=e53]:
      - heading [level=5] [ref=e54]:
        - generic [ref=e55]: 
        - text: Update Profil
      - button [ref=e56]:
        - generic [ref=e57]: 
    - generic [ref=e58]:
      - generic [ref=e59]:
        - generic [ref=e60]: 
        - text: "Perhatian: Perubahan profil mandiri dibatasi"
        - strong [ref=e61]: 1x dalam 30 hari
        - text: . Perubahan lebih lanjut hubungi BKPSDM.
      - generic [ref=e62]:
        - generic [ref=e63]:
          - generic [ref=e64]: Unit Kerja (OPD)
          - generic [ref=e65] [cursor=pointer]:
            - generic [ref=e66]: BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA
            - generic [ref=e67]: 
        - generic [ref=e68]:
          - generic [ref=e69]: Jabatan
          - textbox [ref=e70]: Analis SDM Aparatur Ahli Pertama - E2E
        - button [ref=e71]: SIMPAN PROFIL
  - dialog [ref=e73]:
    - heading "Gagal" [level=2] [ref=e78]
    - generic [ref=e79]: Anda hanya dapat mengubah profil sekali dalam sebulan. Perubahan berikutnya dapat dilakukan setelah 25 September 2026. Hubungi BKPSDM Kota Pariaman jika perlu perubahan mendesak.
    - text: "!"
    - button "OK" [active] [ref=e81] [cursor=pointer]
```

# Test source

```ts
  139 | 
  140 |     await expect(btnAmbilAbsen).toBeVisible({ timeout: 10000 });
  141 |     await expect(btnSinkronkan).toBeVisible({ timeout: 10000 });
  142 |     await expect(btnEditProfil).toBeVisible({ timeout: 10000 });
  143 |     logAction.success('Seluruh komponen utama Dashboard (Ambil Absen, Sinkronkan, Edit Profil) ditemukan.');
  144 | 
  145 |     logAction.verify('--- MENGUJI TOMBOL PROFIL / QR IDENTITAS (POJOK KANAN ATAS) ---');
  146 |     const btnProfilSaya = page.locator('button:has-text("Profil Saya")');
  147 |     await expect(btnProfilSaya).toBeVisible({ timeout: 10000 });
  148 |     logAction.click('Profil Saya', 'button:has-text("Profil Saya")');
  149 |     await btnProfilSaya.click();
  150 | 
  151 |     const modalUserQr = page.locator('#modalUserQr');
  152 |     await expect(modalUserQr).toBeVisible({ timeout: 10000 });
  153 |     logAction.verify('Modal QR Identitas (#modalUserQr) berhasil terbuka.');
  154 | 
  155 |     const qrContainer = page.locator('#userQrContainer');
  156 |     await expect(qrContainer).toBeVisible({ timeout: 10000 });
  157 |     const hasQrCanvasOrImg = await qrContainer.locator('canvas, img, svg').count() > 0;
  158 |     console.log(`  📷 [VERIFIKASI QR CODE] Elemen QR Code ter-render: ${hasQrCanvasOrImg ? 'YA' : 'TIDAK'}`);
  159 |     expect(hasQrCanvasOrImg).toBe(true);
  160 | 
  161 |     logAction.click('TUTUP Modal QR', '#modalUserQr button:has-text("TUTUP")');
  162 |     await page.click('#modalUserQr button:has-text("TUTUP")');
  163 |     await expect(modalUserQr).toBeHidden({ timeout: 5000 });
  164 |     logAction.success('Modal QR Identitas berhasil diuji dan ditutup.');
  165 | 
  166 |     logAction.verify('--- MENGUJI EDIT PROFIL & SINKRONISASI DATA PEGAWAI ---');
  167 |     const origJabatan = await page.locator('#dashJabatan').innerText();
  168 |     const origOpd = await page.locator('#dashPerangkatDaerah').innerText();
  169 |     console.log(`  📋 [DATA PROFIL AWAL] Jabatan: "${origJabatan}" | OPD: "${origOpd}"`);
  170 | 
  171 |     logAction.click('Edit Profil', 'button:has-text("Edit Profil")');
  172 |     await btnEditProfil.click();
  173 | 
  174 |     const modalEditProfil = page.locator('#modalEditProfil');
  175 |     await expect(modalEditProfil).toBeVisible({ timeout: 10000 });
  176 | 
  177 |     const tempJabatan = `${origJabatan} - E2E`;
  178 |     logAction.input('Jabatan Baru (Uji Coba)', '#editJabatan', tempJabatan);
  179 |     await page.fill('#editJabatan', tempJabatan);
  180 | 
  181 |     logAction.click('SIMPAN PROFIL', '#modalEditProfil button[type="submit"]');
  182 |     
  183 |     // Dengarkan response /api/profil/update
  184 |     const updateResponsePromise = page.waitForResponse(
  185 |       resp => resp.url().includes('/api/profil/update'),
  186 |       { timeout: 15000 }
  187 |     ).catch(() => null);
  188 | 
  189 |     await page.click('#modalEditProfil button[type="submit"]');
  190 |     const updateResponse = await updateResponsePromise;
  191 | 
  192 |     let isRateLimited = false;
  193 |     if (updateResponse) {
  194 |       const httpStatus = updateResponse.status();
  195 |       let resBody = {};
  196 |       try { resBody = await updateResponse.json(); } catch(e) {}
  197 |       if (httpStatus === 429 || resBody.code === 429 || (resBody.message && resBody.message.toLowerCase().includes('sebulan'))) {
  198 |         isRateLimited = true;
  199 |         console.log(`  ⚠️  [RATE LIMIT 429] Terdeteksi pembatasan update profil: "${resBody.message || 'HTTP 429'}"`);
  200 |       }
  201 |     }
  202 | 
  203 |     if (isRateLimited) {
  204 |       logAction.verify('Batas update profil (HTTP 429) tercapai. Menutup dialog & melewati verifikasi perubahan data profil...');
  205 |       const swalConfirmBtn = page.locator('.swal2-confirm');
  206 |       if (await swalConfirmBtn.isVisible().catch(() => false)) {
  207 |         await swalConfirmBtn.click();
  208 |       }
  209 |       const closeBtn = page.locator('#modalEditProfil button:has-text("✕"), #modalEditProfil button[onclick*="tutupModalEditProfil"]');
  210 |       if (await closeBtn.isVisible().catch(() => false)) {
  211 |         await closeBtn.click();
  212 |       }
  213 |       await expect(modalEditProfil).toBeHidden({ timeout: 5000 }).catch(() => {});
  214 | 
  215 |       logAction.click('Sinkronkan', 'button:has-text("Sinkronkan")');
  216 |       await btnSinkronkan.click();
  217 |       await page.waitForTimeout(2000);
  218 | 
  219 |       logAction.success('Uji Coba Profil selesai (melewati edit nilai karena limit 429 sebulan) & Tombol Sinkronkan berhasil diuji.');
  220 |     } else {
  221 |       // Menunggu modal edit profil tertutup normal
  222 |       await expect(modalEditProfil).toBeHidden({ timeout: 10000 });
  223 | 
  224 |       logAction.click('Sinkronkan', 'button:has-text("Sinkronkan")');
  225 |       await btnSinkronkan.click();
  226 | 
  227 |       await page.waitForTimeout(2000); // Tunggu sinkronisasi selesai
  228 |       const updatedJabatan = await page.locator('#dashJabatan').innerText();
  229 |       console.log(`  🔄 [DATA PROFIL TERUPDATE] Jabatan setelah sinkron: "${updatedJabatan}"`);
  230 |       expect(updatedJabatan).toBe(tempJabatan);
  231 | 
  232 |       logAction.verify('Mengembalikan data profil ke nilai semula...');
  233 |       await btnEditProfil.click();
  234 |       await expect(modalEditProfil).toBeVisible({ timeout: 10000 });
  235 | 
  236 |       logAction.input('Jabatan Semula', '#editJabatan', origJabatan);
  237 |       await page.fill('#editJabatan', origJabatan);
  238 |       await page.click('#modalEditProfil button[type="submit"]');
> 239 |       await expect(modalEditProfil).toBeHidden({ timeout: 10000 });
      |                                     ^ Error: expect(locator).toBeHidden() failed
  240 | 
  241 |       await btnSinkronkan.click();
  242 |       await page.waitForTimeout(2000);
  243 | 
  244 |       const restoredJabatan = await page.locator('#dashJabatan').innerText();
  245 |       console.log(`  ↩️  [DATA PROFIL RESTORED] Jabatan semula: "${restoredJabatan}"`);
  246 |       expect(restoredJabatan).toBe(origJabatan);
  247 | 
  248 |       logAction.success('Uji Coba Edit Profil & Sinkronkan Data Pegawai SELURUHNYA BERHASIL.');
  249 |     }
  250 |   });
  251 | });
  252 | 
```