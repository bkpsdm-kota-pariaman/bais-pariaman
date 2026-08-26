# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-verifikasi-log-absensi.spec.js >> Admin Rekap Verifikasi -> Audit Log Absensi Flow (Juli 2026) >> Uji Verifikasi 5 Sampel Rekap Kehadiran (Juli 2026) dan Validasi JSON Payload di Log Absensi
- Location: tests\e2e\admin-verifikasi-log-absensi.spec.js:43:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "Ditolak Oleh Admin"
Received: "Terverifikasi Oleh Admin"
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - text: 
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link "PEMERINTAH KOTA PARIAMAN  BAIS Pariaman" [ref=e4] [cursor=pointer]:
        - /url: "#"
        - generic [ref=e5]: PEMERINTAH KOTA PARIAMAN
        - generic [ref=e6]:
          - generic [ref=e7]: 
          - text: BAIS Pariaman
      - list [ref=e9]:
        - listitem [ref=e10]:
          - button " Data" [ref=e11] [cursor=pointer]:
            - generic [ref=e12]: 
            - text: Data
          - text:   
        - listitem [ref=e13]:
          - button " Rekap" [ref=e14] [cursor=pointer]:
            - generic [ref=e15]: 
            - text: Rekap
          - text:   
        - listitem [ref=e16]:
          - button "Keluar" [ref=e17] [cursor=pointer]
  - generic [ref=e18]:
    - text:                                                                                                                                                  
    - generic [ref=e19]:
      - button " Kembali ke Daftar Jadwal" [ref=e20] [cursor=pointer]:
        - generic [ref=e21]: 
        - text: Kembali ke Daftar Jadwal
      - generic [ref=e22]:
        - generic [ref=e24]:
          - heading " Log Absensi" [level=4] [ref=e25]:
            - generic [ref=e26]: 
            - text: Log Absensi
          - generic [ref=e27]:
            - generic [ref=e28]: 
            - generic [ref=e29]: Disini Anda bisa melihat perubahan data absensi yang dilakukan oleh admin
        - generic [ref=e30]:
          - generic [ref=e31]:
            - generic [ref=e32]: Kode Akses Kegiatan (Wajib) *
            - textbox "Masukkan Kode Akses" [ref=e33]: 20EF37
          - generic [ref=e34]:
            - generic [ref=e35]: NIP/Nama Pegawai
            - textbox "Cari NIP / Nama" [ref=e36]: "199107102025062004"
          - generic [ref=e37]:
            - generic [ref=e38]: Jenis Aksi
            - combobox [ref=e39]:
              - option "Semua Aksi" [selected]
              - option "Tambah"
              - option "Edit"
              - option "Hapus"
          - generic [ref=e40]:
            - generic [ref=e41]: NIP/Nama Pelaku
            - textbox "Cari Pelaku" [ref=e42]
          - generic [ref=e43]:
            - generic [ref=e44]: Waktu Aksi
            - textbox [ref=e45]
          - button " Cari" [active] [ref=e47] [cursor=pointer]:
            - generic [ref=e48]: 
            - text: Cari
        - generic [ref=e49]:
          - generic [ref=e50]:
            - heading " Detail Kegiatan" [level=6] [ref=e51]:
              - generic [ref=e52]: 
              - text: Detail Kegiatan
            - generic [ref=e53]: 20EF37
          - generic [ref=e54]:
            - generic [ref=e55]:
              - generic [ref=e56]: "Judul Kegiatan:"
              - strong [ref=e57]: Senam Mingguan Balaikota
            - generic [ref=e58]:
              - generic [ref=e59]: "Kategori & Tanggal:"
              - generic [ref=e60]: Senam
              - strong [ref=e61]: 24 Juli 2026 pukul 07:00:00
            - generic [ref=e62]:
              - generic [ref=e63]: "Jam Pelaksanaan:"
              - strong [ref=e64]: 08:20:00 - 09:00:00 WIB
            - generic [ref=e65]:
              - generic [ref=e66]: "Radius:"
              - strong [ref=e67]: 75 meter
        - generic [ref=e69]:
          - generic [ref=e70]:
            - generic [ref=e71]: "Total Data: 8"
            - button " Download Excel" [ref=e72] [cursor=pointer]:
              - generic [ref=e73]: 
              - text: Download Excel
          - generic [ref=e74]:
            - generic [ref=e75]: Tampilkan
            - combobox [ref=e76]:
              - option "10" [selected]
              - option "25"
              - option "50"
              - option "100"
              - option "Semua Data"
            - generic [ref=e77]: baris
        - table [ref=e79]:
          - rowgroup [ref=e80]:
            - row [ref=e81]:
              - columnheader "No" [ref=e82]
              - columnheader "Waktu Aksi" [ref=e83]
              - columnheader "Aksi" [ref=e84]
              - columnheader "Pegawai Target" [ref=e85]
              - columnheader "Admin Pelaku" [ref=e86]
              - columnheader "IP & Device" [ref=e87]
              - columnheader "Detail Data (JSON)" [ref=e88]
          - rowgroup [ref=e89]:
            - row [ref=e90]:
              - cell "1" [ref=e91]
              - cell "26 Agustus 2026 pukul 09:01:35" [ref=e92]
              - cell "EDIT" [ref=e93]
              - 'cell "ALVIA AYUDA NIP: 199107102025062004" [ref=e95]':
                - generic [ref=e96]: ALVIA AYUDA
                - text: "NIP: 199107102025062004"
              - 'cell "EGO DAFMA DASA NIP: 199510102020121011" [ref=e97]':
                - generic [ref=e98]: EGO DAFMA DASA
                - text: "NIP: 199510102020121011"
              - cell "36.77.214.67 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36" [ref=e99]:
                - generic [ref=e100]: 36.77.214.67
                - generic "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36" [ref=e101]
              - cell [ref=e102]:
                - textbox [ref=e103]: "{ \"kode_akses\": \"20EF37\", \"nip\": \"199107102025062004\", \"status_verifikasi\": \"Terverifikasi Oleh Admin\", \"status_kehadiran\": \"Hadir\", \"keterangan\": \"DATA OK\" }"
            - row [ref=e104]:
              - cell "2" [ref=e105]
              - cell "26 Agustus 2026 pukul 09:01:34" [ref=e106]
              - cell "EDIT" [ref=e107]
              - 'cell "ALVIA AYUDA NIP: 199107102025062004" [ref=e109]':
                - generic [ref=e110]: ALVIA AYUDA
                - text: "NIP: 199107102025062004"
              - 'cell "EGO DAFMA DASA NIP: 199510102020121011" [ref=e111]':
                - generic [ref=e112]: EGO DAFMA DASA
                - text: "NIP: 199510102020121011"
              - cell "36.77.214.67 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36" [ref=e113]:
                - generic [ref=e114]: 36.77.214.67
                - generic "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36" [ref=e115]
              - cell [ref=e116]:
                - textbox [ref=e117]: "{ \"kode_akses\": \"20EF37\", \"nip\": \"199107102025062004\", \"status_verifikasi\": \"Ditolak Oleh Admin\", \"status_kehadiran\": \"Hadir\", \"keterangan\": \"INI COBA TOLAK\" }"
            - row [ref=e118]:
              - cell "3" [ref=e119]
              - cell "26 Agustus 2026 pukul 09:01:33" [ref=e120]
              - cell "EDIT" [ref=e121]
              - 'cell "ALVIA AYUDA NIP: 199107102025062004" [ref=e123]':
                - generic [ref=e124]: ALVIA AYUDA
                - text: "NIP: 199107102025062004"
              - 'cell "EGO DAFMA DASA NIP: 199510102020121011" [ref=e125]':
                - generic [ref=e126]: EGO DAFMA DASA
                - text: "NIP: 199510102020121011"
              - cell "36.77.214.67 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36" [ref=e127]:
                - generic [ref=e128]: 36.77.214.67
                - generic "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36" [ref=e129]
              - cell [ref=e130]:
                - textbox [ref=e131]: "{ \"kode_akses\": \"20EF37\", \"nip\": \"199107102025062004\", \"status_verifikasi\": \"Terverifikasi Oleh Admin\", \"status_kehadiran\": \"Hadir\", \"keterangan\": \"DATA OK\" }"
            - row [ref=e132]:
              - cell "4" [ref=e133]
              - cell "26 Agustus 2026 pukul 09:01:31" [ref=e134]
              - cell "EDIT" [ref=e135]
              - 'cell "ALVIA AYUDA NIP: 199107102025062004" [ref=e137]':
                - generic [ref=e138]: ALVIA AYUDA
                - text: "NIP: 199107102025062004"
              - 'cell "EGO DAFMA DASA NIP: 199510102020121011" [ref=e139]':
                - generic [ref=e140]: EGO DAFMA DASA
                - text: "NIP: 199510102020121011"
              - cell "36.77.214.67 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36" [ref=e141]:
                - generic [ref=e142]: 36.77.214.67
                - generic "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36" [ref=e143]
              - cell [ref=e144]:
                - textbox [ref=e145]: "{ \"kode_akses\": \"20EF37\", \"nip\": \"199107102025062004\", \"status_verifikasi\": \"Ditolak Oleh Admin\", \"status_kehadiran\": \"Hadir\", \"keterangan\": \"INI COBA TOLAK\" }"
            - row [ref=e146]:
              - cell "5" [ref=e147]
              - cell "26 Agustus 2026 pukul 08:40:33" [ref=e148]
              - cell "EDIT" [ref=e149]
              - 'cell "ALVIA AYUDA NIP: 199107102025062004" [ref=e151]':
                - generic [ref=e152]: ALVIA AYUDA
                - text: "NIP: 199107102025062004"
              - 'cell "EGO DAFMA DASA NIP: 199510102020121011" [ref=e153]':
                - generic [ref=e154]: EGO DAFMA DASA
                - text: "NIP: 199510102020121011"
              - cell "36.77.214.67 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36" [ref=e155]:
                - generic [ref=e156]: 36.77.214.67
                - generic "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36" [ref=e157]
              - cell [ref=e158]:
                - textbox [ref=e159]: "{ \"kode_akses\": \"20EF37\", \"nip\": \"199107102025062004\", \"status_verifikasi\": \"Terverifikasi Oleh Admin\", \"status_kehadiran\": \"Hadir\", \"keterangan\": \"DATA OK\" }"
            - row [ref=e160]:
              - cell "6" [ref=e161]
              - cell "26 Agustus 2026 pukul 08:40:32" [ref=e162]
              - cell "EDIT" [ref=e163]
              - 'cell "ALVIA AYUDA NIP: 199107102025062004" [ref=e165]':
                - generic [ref=e166]: ALVIA AYUDA
                - text: "NIP: 199107102025062004"
              - 'cell "EGO DAFMA DASA NIP: 199510102020121011" [ref=e167]':
                - generic [ref=e168]: EGO DAFMA DASA
                - text: "NIP: 199510102020121011"
              - cell "36.77.214.67 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36" [ref=e169]:
                - generic [ref=e170]: 36.77.214.67
                - generic "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36" [ref=e171]
              - cell [ref=e172]:
                - textbox [ref=e173]: "{ \"kode_akses\": \"20EF37\", \"nip\": \"199107102025062004\", \"status_verifikasi\": \"Ditolak Oleh Admin\", \"status_kehadiran\": \"Hadir\", \"keterangan\": \"INI COBA TOLAK\" }"
            - row [ref=e174]:
              - cell "7" [ref=e175]
              - cell "26 Agustus 2026 pukul 08:40:30" [ref=e176]
              - cell "EDIT" [ref=e177]
              - 'cell "ALVIA AYUDA NIP: 199107102025062004" [ref=e179]':
                - generic [ref=e180]: ALVIA AYUDA
                - text: "NIP: 199107102025062004"
              - 'cell "EGO DAFMA DASA NIP: 199510102020121011" [ref=e181]':
                - generic [ref=e182]: EGO DAFMA DASA
                - text: "NIP: 199510102020121011"
              - cell "36.77.214.67 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36" [ref=e183]:
                - generic [ref=e184]: 36.77.214.67
                - generic "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36" [ref=e185]
              - cell [ref=e186]:
                - textbox [ref=e187]: "{ \"kode_akses\": \"20EF37\", \"nip\": \"199107102025062004\", \"status_verifikasi\": \"Terverifikasi Oleh Admin\", \"status_kehadiran\": \"Hadir\", \"keterangan\": \"DATA OK\" }"
            - row [ref=e188]:
              - cell "8" [ref=e189]
              - cell "26 Agustus 2026 pukul 08:40:29" [ref=e190]
              - cell "EDIT" [ref=e191]
              - 'cell "ALVIA AYUDA NIP: 199107102025062004" [ref=e193]':
                - generic [ref=e194]: ALVIA AYUDA
                - text: "NIP: 199107102025062004"
              - 'cell "EGO DAFMA DASA NIP: 199510102020121011" [ref=e195]':
                - generic [ref=e196]: EGO DAFMA DASA
                - text: "NIP: 199510102020121011"
              - cell "36.77.214.67 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36" [ref=e197]:
                - generic [ref=e198]: 36.77.214.67
                - generic "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36" [ref=e199]
              - cell [ref=e200]:
                - textbox [ref=e201]: "{ \"kode_akses\": \"20EF37\", \"nip\": \"199107102025062004\", \"status_verifikasi\": \"Ditolak Oleh Admin\", \"status_kehadiran\": \"Hadir\", \"keterangan\": \"INI COBA TOLAK\" }"
        - navigation "Page navigation" [ref=e203]:
          - list [ref=e204]:
            - listitem [ref=e205]:
              - button "« Prev"
            - listitem [ref=e206]:
              - button "1" [ref=e207] [cursor=pointer]
            - listitem [ref=e208]:
              - button "Next »"
  - text:                     
  - alert [ref=e209]:
    - heading "Status berhasil diperbarui!" [level=2] [ref=e217]
    - text: "!"
```

# Test source

```ts
  149 |       logAction.input('Catatan / Keterangan Admin', '#verifKeterangan', targetKeterangan);
  150 |       await page.fill('#verifKeterangan', targetKeterangan);
  151 | 
  152 |       // Submit form dan tunggu respon verifikasi dari server
  153 |       await Promise.all([
  154 |         page.waitForResponse(resp => resp.url().includes('/admin/verifikasi') && resp.status() === 200, { timeout: 15000 }),
  155 |         page.click('#btnSimpanVerif')
  156 |       ]);
  157 | 
  158 |       logAction.verify('Menunggu modal verifikasi tertutup...');
  159 |       await expect(modalVerif).toBeHidden({ timeout: 15000 });
  160 | 
  161 |       // Tutup alert SweetAlert jika ada
  162 |       const swalConfirm = page.locator('.swal2-confirm');
  163 |       if (await swalConfirm.isVisible().catch(() => false)) {
  164 |         await swalConfirm.click().catch(() => {});
  165 |       }
  166 | 
  167 |       logAction.success(`Data ke-${index} (NIP: ${nipTarget}) berhasil diverifikasi dengan status "${targetVerifStatus}"`);
  168 | 
  169 |       editedSamples.push({
  170 |         index,
  171 |         kodeAkses: kodeAksesTarget,
  172 |         nip: nipTarget,
  173 |         nama: namaTarget,
  174 |         statusVerifikasi: targetVerifStatus,
  175 |         keterangan: targetKeterangan
  176 |       });
  177 | 
  178 |       await page.waitForTimeout(300);
  179 |     }
  180 | 
  181 |     console.log(`\n======================================================================`);
  182 |     console.log(`✅ Selesai verifikasi ${editedSamples.length} data. Membuka Menu Log Absensi...`);
  183 |     console.log(`======================================================================`);
  184 | 
  185 |     // =========================================================================
  186 |     // LANGKAH 5 & 6: Buka Menu Log Absensi, Cari & Bandingkan Payload JSON
  187 |     // =========================================================================
  188 |     logAction.menu('Halaman Log Absensi (bukaHalamanLogAbsensi)');
  189 |     await page.evaluate(() => bukaHalamanLogAbsensi());
  190 |     await expect(page.locator('#logAbsensiContainer')).toBeVisible({ timeout: 10000 });
  191 | 
  192 |     for (const sample of editedSamples) {
  193 |       console.log(`\n----------------------------------------------------------------------`);
  194 |       console.log(`🔍 [AUDIT LOG ${sample.index}/${editedSamples.length}] Memeriksa Log NIP: ${sample.nip} (${sample.nama})`);
  195 |       console.log(`   Kode Akses Target: ${sample.kodeAkses} | Verifikasi: ${sample.statusVerifikasi} | Keterangan: ${sample.keterangan}`);
  196 |       console.log(`----------------------------------------------------------------------`);
  197 | 
  198 |       // 1. Masukkan Kode Akses Kegiatan
  199 |       logAction.input('Filter Kode Akses Kegiatan', '#logFilterKegiatan', sample.kodeAkses);
  200 |       await page.fill('#logFilterKegiatan', sample.kodeAkses);
  201 | 
  202 |       // 2. Masukkan NIP Pegawai
  203 |       logAction.input('Filter NIP / Nama Pegawai', '#logFilterPegawai', sample.nip);
  204 |       await page.fill('#logFilterPegawai', sample.nip);
  205 | 
  206 |       // 3. Klik Cari Log
  207 |       logAction.click('Tombol Cari Log', 'button[onclick="terapkanFilterLogAbsensi()"]');
  208 |       await Promise.all([
  209 |         page.waitForResponse(resp => resp.url().includes('/admin/log-absensi') && resp.status() === 200, { timeout: 15000 }),
  210 |         page.click('button[onclick="terapkanFilterLogAbsensi()"]')
  211 |       ]);
  212 | 
  213 |       logAction.verify('Menunggu tabel log absensi selesai memuat data...');
  214 |       await page.waitForFunction(() => {
  215 |         const tbody = document.getElementById('logAbsensiTableBody');
  216 |         if (!tbody) return false;
  217 |         const html = tbody.innerHTML;
  218 |         return html.includes('<tr') && !html.includes('spinner-border') && !html.includes('Memuat data');
  219 |       }, { timeout: 15000 });
  220 | 
  221 |       // Verifikasi box detail kegiatan muncul
  222 |       const detailBox = page.locator('#logKegiatanDetailBox');
  223 |       await expect(detailBox).toBeVisible({ timeout: 10000 });
  224 |       await expect(page.locator('#logDetailKodeAkses')).toContainText(sample.kodeAkses);
  225 | 
  226 |       // Ambil teks payload JSON dari baris log teratas (terbaru) yang cocok dengan NIP
  227 |       const payloadText = await page.evaluate((nipTarget) => {
  228 |         const rows = Array.from(document.querySelectorAll('#logAbsensiTableBody tr'));
  229 |         const matchedRow = rows.find(r => r.innerText.includes(nipTarget)) || rows[0];
  230 |         if (!matchedRow) return null;
  231 |         const textarea = matchedRow.querySelector('textarea');
  232 |         return textarea ? textarea.value : matchedRow.innerText;
  233 |       }, sample.nip);
  234 | 
  235 |       expect(payloadText).not.toBeNull();
  236 |       console.log(`  📄 [PAYLOAD JSON LOG DITEMUKAN]:\n${payloadText}`);
  237 | 
  238 |       // Validasi struktur dan isi Payload JSON
  239 |       let parsedPayload = null;
  240 |       try {
  241 |         parsedPayload = JSON.parse(payloadText);
  242 |       } catch (e) {
  243 |         console.warn('  ⚠️ JSON parse warning, mengecek kecocokan string...');
  244 |       }
  245 | 
  246 |       if (parsedPayload) {
  247 |         expect(parsedPayload.kode_akses).toBe(sample.kodeAkses);
  248 |         expect(parsedPayload.nip).toBe(sample.nip);
> 249 |         expect(parsedPayload.status_verifikasi).toBe(sample.statusVerifikasi);
      |                                                 ^ Error: expect(received).toBe(expected) // Object.is equality
  250 |         expect(parsedPayload.keterangan).toBe(sample.keterangan);
  251 |       } else {
  252 |         expect(payloadText).toContain(sample.kodeAkses);
  253 |         expect(payloadText).toContain(sample.nip);
  254 |         expect(payloadText).toContain(sample.statusVerifikasi);
  255 |         expect(payloadText).toContain(sample.keterangan);
  256 |       }
  257 | 
  258 |       logAction.success(`Log verifikasi untuk NIP "${sample.nip}" (${sample.statusVerifikasi} - "${sample.keterangan}") VALID dan tercatat di Log Absensi!`);
  259 |     }
  260 | 
  261 |     console.log(`\n🎉 [PENGUJIAN SELESAI] Seluruh ${editedSamples.length} kegiatan verifikasi berhasil dicatat & dicocokkan dengan payload audit log!`);
  262 |   });
  263 | 
  264 | });
  265 | 
```