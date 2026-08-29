const { switchView, pilihOpsiKehadiran } = require('../../src/Views/pwa/js/app.js');

describe('PWA DOM Functions', () => {

  beforeAll(() => {
    window.scrollTo = jest.fn();
  });

  describe('switchView', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="view-dashboard" class="view-section"></div>
        <div id="view-login" class="view-section hidden-view"></div>
        <div id="view-form" class="view-section hidden-view"></div>
      `;
    });

    it('should show the target view and hide others', () => {
      switchView('view-login');

      expect(document.getElementById('view-login').classList.contains('hidden-view')).toBe(false);
      expect(document.getElementById('view-dashboard').classList.contains('hidden-view')).toBe(true);
      expect(document.getElementById('view-form').classList.contains('hidden-view')).toBe(true);
    });

    it('should do nothing if target view does not exist', () => {
      switchView('view-unknown');
      expect(document.getElementById('view-dashboard').classList.contains('hidden-view')).toBe(true);
    });
  });

  describe('pilihOpsiKehadiran', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="opsiKehadiranAwal"></div>
        <input type="radio" name="tipeKehadiran" value="hadir" id="radio-hadir" />
        <input type="radio" name="tipeKehadiran" value="izin" id="radio-izin" />
        
        <div id="flowHadir"></div>
        <div id="flowIzin" class="hidden-view"></div>
        <div id="hasilFoto" class="hidden-view"></div>
        <input type="hidden" id="fotoBase64" value="" />
        <video id="kamera"></video>
        
        <input type="text" id="alasanIzin" value="">
        <input type="text" id="keteranganIzin" value="">
        <input type="file" id="buktiIzin">
        
        <button id="btnKirim" disabled></button>
      `;
    });

    it('should show flowHadir and hide flowIzin when hadir option is picked', () => {
      pilihOpsiKehadiran('hadir');
      
      expect(document.getElementById('flowHadir').classList.contains('hidden-view')).toBe(false);
      expect(document.getElementById('flowIzin').classList.contains('hidden-view')).toBe(true);
      expect(document.getElementById('radio-hadir').checked).toBe(true);
    });

    it('should show flowIzin and hide flowHadir when izin option is picked', () => {
      pilihOpsiKehadiran('izin');
      
      expect(document.getElementById('flowIzin').classList.contains('hidden-view')).toBe(false);
      expect(document.getElementById('flowHadir').classList.contains('hidden-view')).toBe(true);
      expect(document.getElementById('radio-izin').checked).toBe(true);
    });
  });

});
