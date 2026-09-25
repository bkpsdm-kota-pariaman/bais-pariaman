// Helper mocks harus siap sebelum admin.js dimuat.
global.bootstrap = {
  Modal: class {
    constructor() {}
    show() {}
    hide() {}
  }
};

document.body.innerHTML = `
  <div id="modalBuatKegiatan"></div>
  <div id="modalEditKegiatan"></div>
  <div id="modalQrCode"></div>
  <div id="modalVerifikasi"></div>
  <div id="modalRingkasan"></div>
  <div id="modalPegawai"></div>
  <div id="modalTambahPeserta"></div>
  <div id="modalOpd"></div>
  <div id="modalImportAbsen"></div>
`;

const fs = require('fs');
const path = require('path');
const SUMBER = fs.readFileSync(
  path.join(__dirname, '../../src/Views/admin/js/admin.js'),
  'utf8'
);

// admin.js punya deklarasi function duplikat (pre-existing: checkSuperAdminUI),
// yang ditolak Babel/ESM tapi sah di skrip sloppy-mode browser.
// new Function memakai sloppy mode, jadi fungsi helper bisa diambil apa adanya.
const { jsArg, jsObj } = new Function(
  SUMBER + '\nreturn { jsArg, jsObj };'
)();

// Nama yang mengandung karakter pemutus atribut / sintaks JavaScript.
const NAMA_KASUS = [
  ['normal', 'Budi Santoso'],
  ['kutip tunggal', "O'Brien Saputra"],
  ['kutip ganda', 'Siti "Aisyah" Putri'],
  ['backslash akhir', 'Budi \\'],
  ['tag HTML', 'Ahmad <b>Bin</b> & Co'],
  ['kombinasi', `X'\"&<b>Y`],
  ['newline', 'Budi\nSantoso'],
  ['unicode', 'Ānugrah Šari'],
];

/**
 * Rakit atribut onclick seperti di admin.js, sisipkan ke DOM,
 * klik tombolnya, lalu kembalikan argumen yang benar-benar diterima handler.
 */
function klikDanAmbilArgumen(html) {
  const root = document.getElementById('ujiHandler');
  root.innerHTML = html;
  const btn = root.querySelector('button');
  if (!btn) throw new Error('tombol tidak ter-render: ' + html);
  const diterima = [];
  window.__tampung = (...args) => diterima.push(args);
  btn.click();
  return diterima[0];
}

describe('Escape atribut handler inline (bug kutip pada nama pegawai)', () => {
  beforeAll(() => {
    const root = document.createElement('div');
    root.id = 'ujiHandler';
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.getElementById('ujiHandler').innerHTML = '';
  });

  describe('jsArg() untuk argumen string', () => {
    it.each(NAMA_KASUS)('aman untuk %s saat handler dipanggil', (_label, nama) => {
      const argumen = klikDanAmbilArgumen(
        `<button onclick="window.__tampung(${jsArg(nama)}, 'ABC123')">x</button>`
      );
      expect(argumen).toEqual([nama, 'ABC123']);
    });

    it('aman juga pada atribut berkutip tunggal', () => {
      const nama = "O'Brien \"A\" \\";
      const argumen = klikDanAmbilArgumen(
        `<button onclick='window.__tampung(${jsArg(nama)})'>x</button>`
      );
      expect(argumen).toEqual([nama]);
    });

    it('mengubah null/undefined jadi string kosong', () => {
      expect(klikDanAmbilArgumen(`<button onclick="window.__tampung(${jsArg(null)})">x</button>`)).toEqual(['']);
      expect(klikDanAmbilArgumen(`<button onclick="window.__tampung(${jsArg(undefined)})">x</button>`)).toEqual(['']);
      expect(klikDanAmbilArgumen(`<button onclick="window.__tampung(${jsArg(0)})">x</button>`)).toEqual(['0']);
    });
  });

  describe('jsObj() untuk argumen objek', () => {
    it.each(NAMA_KASUS)('aman untuk objek dengan nama %s', (_label, nama) => {
      const pegawai = { nip: '12345678', nama_pegawai: nama, jabatan: "Ka. Sub 'A' & <b>" };
      const argumen = klikDanAmbilArgumen(
        `<button onclick='window.__tampung(${jsObj(pegawai)})'>x</button>`
      );
      expect(argumen).toEqual([pegawai]);
    });

    it('aman pada atribut berkutip ganda', () => {
      const pegawai = { nip: '9', nama_pegawai: `X'"&<b>Y` };
      const argumen = klikDanAmbilArgumen(
        `<button onclick="window.__tampung(${jsObj(pegawai)})">x</button>`
      );
      expect(argumen).toEqual([pegawai]);
    });
  });

  describe('regresi: seluruh situs onclick di admin.js', () => {
    const fs = require('fs');
    const path = require('path');
    const sumber = fs.readFileSync(
      path.join(__dirname, '../../src/Views/admin/js/admin.js'),
      'utf8'
    );

    it('tidak menyisipkan data mentah ke handler inline', () => {
      const baris = sumber.split(/\r?\n/);
      const polaHandler = /on(?:click|change|dblclick)\s*=\s*(["'])([\s\S]*?)\1/;
      const mentah = [];

      baris.forEach((l, i) => {
        const m = l.match(polaHandler);
        if (!m) return;
        const isi = m[2];
        if (!isi.includes('${')) return;
        if (isi.includes('jsArg(') || isi.includes('jsObj(')) return;
        // dikecualikan: nilai yang bukan data pengguna (nama halaman internal,
        // nama fungsi dari map konstanta, atau variabel yang sudah lewat jsArg).
        if (/\$\{onClickAction\}/.test(isi)) return;
        if (/\$\{exportConfig\.fn\}/.test(isi)) return;
        if (/^gantiPage\(/.test(isi.trim())) return;
        if (/hapusSingleDlq\('\$\{keyEscaped\}'\)/.test(isi)) return; // sudah encodeURIComponent
        if (/bukaModalFormPengaturanFromTable|hapusPengaturan/.test(isi)) {
          if (/kodeAttr|namaAttr|nilaiAttr/.test(isi)) return; // sudah encodeURIComponent
        }
        mentah.push((i + 1) + ': ' + isi.replace(/\s+/g, ' ').slice(0, 120));
      });

      expect(mentah).toEqual([]);
    });

    it('tidak lagi memakai variabel perantara pegawaiData/opdData', () => {
      expect(sumber).not.toMatch(/const (pegawaiData|opdData) = JSON\.stringify/);
    });
  });
});
