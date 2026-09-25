/**
 * @jest-environment jsdom
 */

// Global mocks
global.bootstrap = {
  Modal: class {
    constructor() {}
    show() {}
    hide() {}
    static getOrCreateInstance() { return new global.bootstrap.Modal(); }
    static getInstance() { return new global.bootstrap.Modal(); }
  }
};

global.Swal = {
  fire: jest.fn().mockResolvedValue({ isConfirmed: true })
};

document.body.innerHTML = `
  <div id="logAbsensiContainer" class="d-none"></div>
  <input type="text" id="logFilterKegiatan" value="">
  <input type="text" id="logFilterPegawai" value="">
  <select id="logFilterAksi"><option value="">Semua Aksi</option><option value="edit">Edit</option></select>
  <input type="text" id="logFilterPelaku" value="">
  <input type="date" id="logFilterStartDate" value="">
  <input type="date" id="logFilterEndDate" value="">
  <input type="date" id="logFilterTanggal" value="">
  <div id="logKegiatanDetailBox" class="d-none">
    <span id="logDetailKodeAkses"></span>
    <span id="logDetailJudul"></span>
    <span id="logDetailKategori"></span>
    <span id="logDetailTanggal"></span>
    <span id="logDetailJam"></span>
    <span id="logDetailRadius"></span>
  </div>
  <table>
    <tbody id="logAbsensiTableBody"></tbody>
  </table>
  <div id="logAbsensiPaginationTop"></div>
  <div id="logAbsensiPagination"></div>
`;

// Helper create mock JWT
function createMockJwt(data) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ data }));
  const signature = 'mock_signature';
  return `${header}.${payload}.${signature}`;
}

// Require admin.js
require('../../src/Views/admin/js/admin.js');

describe('Log Absensi - Filter Kode Akses Opsional & Rentang Tanggal', () => {

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    document.getElementById('logFilterKegiatan').value = '';
    document.getElementById('logFilterPegawai').value = '';
    document.getElementById('logFilterAksi').value = '';
    document.getElementById('logFilterPelaku').value = '';
    document.getElementById('logFilterStartDate').value = '';
    document.getElementById('logFilterEndDate').value = '';
    document.getElementById('logKegiatanDetailBox').classList.add('d-none');
    document.getElementById('logAbsensiTableBody').innerHTML = '';
  });

  describe('1. Logika Filter UI & Pengiriman Request (admin.js)', () => {
    it('terapkanFilterLogAbsensi() BISA berjalan saat kode_akses kosong (tidak memunculkan warning wajib)', async () => {
      const superAdminToken = createMockJwt({ nip: '123', role: ['super admin'] });
      localStorage.setItem('admin_jwt_token', superAdminToken);

      // Mock global.fetch
      const mockFetch = jest.fn().mockImplementation((url) => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: true,
            data: {
              data: [
                {
                  id_log_absensi: 1,
                  kode_akses: 'KODEX',
                  nip: '19800101',
                  nama: 'Ahmad',
                  jenis_aksi: 'edit',
                  nip_pelaku: '19900202',
                  nama_pelaku: 'Verifikator A',
                  ip_address: '127.0.0.1',
                  user_agent: 'Chrome',
                  waktu_aksi: '2026-09-25 10:00:00',
                  data: '{"status_kehadiran":"Hadir"}'
                }
              ],
              pagination: { total_rows: 1, total_pages: 1, current_page: 1, limit: 10 }
            }
          })
        });
      });
      global.fetch = mockFetch;

      document.getElementById('logFilterKegiatan').value = '';
      document.getElementById('logFilterPelaku').value = 'Verifikator A';
      document.getElementById('logFilterStartDate').value = '2026-09-01';
      document.getElementById('logFilterEndDate').value = '2026-09-30';

      await terapkanFilterLogAbsensi();

      expect(Swal.fire).not.toHaveBeenCalledWith('Filter Wajib', expect.anything(), 'warning');
      expect(mockFetch).toHaveBeenCalled();
      
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/admin/log-absensi');
      expect(calledUrl).toContain('search_pelaku=Verifikator+A');
      expect(calledUrl).toContain('tanggal_mulai=2026-09-01');
      expect(calledUrl).toContain('tanggal_selesai=2026-09-30');
      expect(calledUrl).not.toContain('kode_akses=');
      expect(document.getElementById('logKegiatanDetailBox').classList.contains('d-none')).toBe(true);
    });

    it('terapkanFilterLogAbsensi() menyertakan kode_akses saat kode_akses diisi', async () => {
      const superAdminToken = createMockJwt({ nip: '123', role: ['super admin'] });
      localStorage.setItem('admin_jwt_token', superAdminToken);

      const mockFetch = jest.fn().mockImplementation((url) => {
        if (url.includes('/admin/jadwal/KODE123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              status: true,
              data: {
                kode_akses: 'KODE123',
                judul: 'Kegiatan Apel Pagi',
                kategori: 'Apel',
                tanggal: '2026-09-25',
                jam_mulai: '07:30',
                jam_selesai: '08:30',
                radius_meter: 100
              }
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: true,
            data: { data: [], pagination: { total_rows: 0, total_pages: 1, current_page: 1, limit: 10 } }
          })
        });
      });
      global.fetch = mockFetch;

      document.getElementById('logFilterKegiatan').value = 'KODE123';
      await terapkanFilterLogAbsensi();

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/admin/jadwal/KODE123'), expect.anything());
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('kode_akses=KODE123'), expect.anything());
      expect(document.getElementById('logKegiatanDetailBox').classList.contains('d-none')).toBe(false);
      expect(document.getElementById('logDetailJudul').textContent).toBe('Kegiatan Apel Pagi');
    });

    it('renderLogAbsensiTable() menampilkan badge kode_akses pada baris tabel', () => {
      const rows = [
        {
          id_log_absensi: 1,
          kode_akses: 'APEL-01',
          nip: '19800101',
          nama: 'Pegawai A',
          jenis_aksi: 'tambah',
          nip_pelaku: '19900202',
          nama_pelaku: 'Verifikator X',
          ip_address: '192.168.1.1',
          user_agent: 'TestBrowser',
          waktu_aksi: '2026-09-25 08:00:00',
          data: '{"status":"Hadir"}'
        }
      ];

      renderLogAbsensiTable(rows);
      const html = document.getElementById('logAbsensiTableBody').innerHTML;
      expect(html).toContain('APEL-01');
      expect(html).toContain('Pegawai A');
      expect(html).toContain('Verifikator X');
    });
  });

  describe('2. Logika Query Backend (Simulasi Controller listLog)', () => {
    function buildLogQuery(getParams) {
      const kodeAkses = (getParams.kode_akses || '').trim();
      const searchPegawai = (getParams.search_pegawai || '').trim();
      const jenisAksi = (getParams.jenis_aksi || '').trim();
      const searchPelaku = (getParams.search_pelaku || '').trim();
      const tanggal = (getParams.tanggal || '').trim();
      const tanggalMulai = (getParams.tanggal_mulai || '').trim();
      const tanggalSelesai = (getParams.tanggal_selesai || '').trim();

      const conditions = [];
      const params = {};

      if (kodeAkses !== '') {
        conditions.push("kode_akses = :kode_akses");
        params[':kode_akses'] = kodeAkses;
      }
      if (searchPegawai !== '') {
        conditions.push("(nip LIKE :search_pegawai_nip OR nama LIKE :search_pegawai_nama)");
        params[':search_pegawai_nip'] = `%${searchPegawai}%`;
        params[':search_pegawai_nama'] = `%${searchPegawai}%`;
      }
      if (jenisAksi !== '' && ['tambah', 'edit', 'hapus'].includes(jenisAksi.toLowerCase())) {
        conditions.push("jenis_aksi = :jenis_aksi");
        params[':jenis_aksi'] = jenisAksi.toLowerCase();
      }
      if (searchPelaku !== '') {
        conditions.push("(nip_pelaku LIKE :search_pelaku_nip OR nama_pelaku LIKE :search_pelaku_nama)");
        params[':search_pelaku_nip'] = `%${searchPelaku}%`;
        params[':search_pelaku_nama'] = `%${searchPelaku}%`;
      }
      if (tanggalMulai !== '' && tanggalSelesai !== '') {
        conditions.push("DATE(waktu_aksi) BETWEEN :tanggal_mulai AND :tanggal_selesai");
        params[':tanggal_mulai'] = tanggalMulai;
        params[':tanggal_selesai'] = tanggalSelesai;
      } else if (tanggalMulai !== '') {
        conditions.push("DATE(waktu_aksi) >= :tanggal_mulai");
        params[':tanggal_mulai'] = tanggalMulai;
      } else if (tanggalSelesai !== '') {
        conditions.push("DATE(waktu_aksi) <= :tanggal_selesai");
        params[':tanggal_selesai'] = tanggalSelesai;
      } else if (tanggal !== '') {
        conditions.push("DATE(waktu_aksi) = :tanggal");
        params[':tanggal'] = tanggal;
      }

      const whereSql = conditions.length > 0 ? conditions.join(' AND ') : '1=1';
      return { whereSql, params };
    }

    it('menghasilkan WHERE 1=1 saat seluruh filter kosong', () => {
      const q = buildLogQuery({});
      expect(q.whereSql).toBe('1=1');
      expect(Object.keys(q.params).length).toBe(0);
    });

    it('memfilter rentang tanggal dan verifikator tanpa menyertakan kode_akses', () => {
      const q = buildLogQuery({
        search_pelaku: 'Admin Verif',
        tanggal_mulai: '2026-09-01',
        tanggal_selesai: '2026-09-30'
      });
      expect(q.whereSql).toContain('(nip_pelaku LIKE :search_pelaku_nip OR nama_pelaku LIKE :search_pelaku_nama)');
      expect(q.whereSql).toContain('DATE(waktu_aksi) BETWEEN :tanggal_mulai AND :tanggal_selesai');
      expect(q.whereSql).not.toContain('kode_akses =');
      expect(q.params[':tanggal_mulai']).toBe('2026-09-01');
      expect(q.params[':tanggal_selesai']).toBe('2026-09-30');
    });

    it('menyertakan kode_akses saat kode_akses diberikan', () => {
      const q = buildLogQuery({
        kode_akses: 'KODE999'
      });
      expect(q.whereSql).toBe('kode_akses = :kode_akses');
      expect(q.params[':kode_akses']).toBe('KODE999');
    });
  });

});
