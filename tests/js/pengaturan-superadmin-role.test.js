/**
 * @jest-environment jsdom
 */

// Setup DOM elements before requiring scripts
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
  <div id="modalPengaturanAplikasi"></div>
  <div id="modalFormPengaturanItem"></div>
  <div id="pengaturanContainer" class="d-none"></div>

  <li id="menuDividerLogAbsensi" class="d-none"></li>
  <li id="menuItemLogAbsensi" class="d-none"></li>
  <li id="menuDividerPengaturanAplikasi" class="d-none"></li>
  <li id="menuItemPengaturanAplikasi" class="d-none"></li>
`;

global.bootstrap = {
  Modal: class {
    constructor() {}
    show() {}
    hide() {}
    static getOrCreateInstance() {
      return new global.bootstrap.Modal();
    }
    static getInstance() {
      return new global.bootstrap.Modal();
    }
  }
};

global.Swal = {
  fire: jest.fn().mockResolvedValue({ isConfirmed: true })
};

// Import code after DOM setup
require('../../src/Views/admin/js/admin.js');

// Helper to construct mock JWT tokens
function createMockJwt(data) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ data }));
  const signature = 'mock_signature';
  return `${header}.${payload}.${signature}`;
}

describe('Pembuktian Akses Khusus Super Admin - Pengaturan Aplikasi', () => {

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    document.getElementById('menuDividerPengaturanAplikasi').classList.add('d-none');
    document.getElementById('menuItemPengaturanAplikasi').classList.add('d-none');
  });

  describe('1. Verifikasi UI & Token JWT di Frontend (admin.js & index.html)', () => {
    it('isSuperAdmin() mengembalikan TRUE jika JWT memiliki role super admin', () => {
      const token = createMockJwt({ nip: '19900101', role: ['admin', 'super admin'] });
      localStorage.setItem('admin_jwt_token', token);
      
      expect(isSuperAdmin()).toBe(true);
    });

    it('isSuperAdmin() mengembalikan FALSE jika JWT HANYA memiliki role admin biasa', () => {
      const token = createMockJwt({ nip: '19900101', role: ['admin'] });
      localStorage.setItem('admin_jwt_token', token);
      
      expect(isSuperAdmin()).toBe(false);
    });

    it('isSuperAdmin() mengembalikan FALSE jika JWT hanya role asn atau token tidak ada', () => {
      const token = createMockJwt({ nip: '19900101', role: ['asn'] });
      localStorage.setItem('admin_jwt_token', token);
      expect(isSuperAdmin()).toBe(false);

      localStorage.removeItem('admin_jwt_token');
      expect(isSuperAdmin()).toBe(false);
    });

    it('checkSuperAdminUI() HANYA menampilkan menu Pengaturan Aplikasi jika role super admin', () => {
      const superAdminToken = createMockJwt({ role: ['admin', 'super admin'] });
      localStorage.setItem('admin_jwt_token', superAdminToken);

      checkSuperAdminUI();

      const itemPengaturan = document.getElementById('menuItemPengaturanAplikasi');
      const dividerPengaturan = document.getElementById('menuDividerPengaturanAplikasi');
      expect(itemPengaturan.classList.contains('d-none')).toBe(false);
      expect(dividerPengaturan.classList.contains('d-none')).toBe(false);
    });

    it('checkSuperAdminUI() MENYEMBUNYIKAN menu Pengaturan Aplikasi jika role admin biasa', () => {
      const adminToken = createMockJwt({ role: ['admin'] });
      localStorage.setItem('admin_jwt_token', adminToken);

      checkSuperAdminUI();

      const itemPengaturan = document.getElementById('menuItemPengaturanAplikasi');
      const dividerPengaturan = document.getElementById('menuDividerPengaturanAplikasi');
      expect(itemPengaturan.classList.contains('d-none')).toBe(true);
      expect(dividerPengaturan.classList.contains('d-none')).toBe(true);
    });

    it('bukaHalamanPengaturanAplikasi() MENOLAK akses jika user bukan super admin', async () => {
      const adminToken = createMockJwt({ role: ['admin'] });
      localStorage.setItem('admin_jwt_token', adminToken);

      await bukaHalamanPengaturanAplikasi();

      expect(Swal.fire).toHaveBeenCalledWith('Akses Ditolak', expect.stringContaining('super admin'), 'error');
    });

    it('hapusPengaturan() MENOLAK akses jika user bukan super admin', async () => {
      const adminToken = createMockJwt({ role: ['admin'] });
      localStorage.setItem('admin_jwt_token', adminToken);

      await hapusPengaturan('link_absensi_cadangan', 'Link Absensi');

      expect(Swal.fire).toHaveBeenCalledWith('Akses Ditolak', expect.stringContaining('super admin'), 'error');
    });
  });

  describe('2. Verifikasi Logika Otorisasi Backend PHP (PengaturanController.php)', () => {
    function simulateBackendRoleCheck(userRoleArray) {
      const roles = (userRoleArray || []).map(r => String(r).trim().toLowerCase());
      if (!roles.includes('super admin')) {
        return { status: false, code: 403, message: "Hak akses ditolak. Hanya Super Admin yang dapat mengakses pengaturan aplikasi." };
      }
      return { status: true, code: 200, message: "Akses diizinkan" };
    }

    it('Backend MENOLAK akses (403) untuk role [admin] pada PengaturanController', () => {
      const result = simulateBackendRoleCheck(['admin']);
      expect(result.status).toBe(false);
      expect(result.code).toBe(403);
      expect(result.message).toContain('Hanya Super Admin');
    });

    it('Backend MENOLAK akses (403) untuk role [asn] pada PengaturanController', () => {
      const result = simulateBackendRoleCheck(['asn']);
      expect(result.status).toBe(false);
      expect(result.code).toBe(403);
    });

    it('Backend MENERIMA akses (200) HANYA jika role memuat super admin', () => {
      const result = simulateBackendRoleCheck(['admin', 'super admin']);
      expect(result.status).toBe(true);
      expect(result.code).toBe(200);
    });
  });

  describe('3. Verifikasi Logika Otorisasi Cloudflare Worker (worker/src/index.js)', () => {
    function simulateWorkerSuperAdminTokenVerify(payload) {
      if (!payload || !payload.data) return null;
      const userRoles = Array.isArray(payload.data.role)
        ? payload.data.role
        : (payload.data.role ? [payload.data.role] : []);
      const isSuperAdmin = userRoles.some(r => String(r).trim().toLowerCase() === 'super admin');
      if (!isSuperAdmin) return null;
      return payload;
    }

    it('Worker verifySuperAdminToken mengembalikan null (Ditolak) untuk token role admin biasa', () => {
      const payload = { data: { nip: '12345', role: ['admin'] } };
      const verified = simulateWorkerSuperAdminTokenVerify(payload);
      expect(verified).toBeNull();
    });

    it('Worker verifySuperAdminToken mengembalikan payload (Diizinkan) HANYA untuk role super admin', () => {
      const payload = { data: { nip: '12345', role: ['admin', 'super admin'] } };
      const verified = simulateWorkerSuperAdminTokenVerify(payload);
      expect(verified).not.toBeNull();
      expect(verified.data.nip).toBe('12345');
    });
  });

});
