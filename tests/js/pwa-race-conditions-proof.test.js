const fs = require('fs');
const vm = require('vm');

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createPwaSandbox(customMocks = {}) {
  const source = fs.readFileSync(require.resolve('../../src/Views/pwa/js/app.js'), 'utf8');
  const elements = new Map();

  const getElement = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        value: '',
        innerHTML: '',
        innerText: '',
        srcObject: null,
        className: '',
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
          contains: jest.fn(() => false),
          toggle: jest.fn()
        },
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        querySelector: jest.fn(() => null),
        disabled: false
      });
    }
    return elements.get(id);
  };

  const defaultMediaDevices = {
    enumerateDevices: jest.fn().mockResolvedValue([]),
    getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [{ stop: jest.fn() }] })
  };

  const context = {
    console,
    URL,
    URLSearchParams,
    Date,
    Promise,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    FormData: class FormData {
      constructor() { this._data = {}; }
      append(k, v) { this._data[k] = v; }
    },
    File: class File {},
    Blob,
    atob: global.atob,
    localStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
    sessionStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
    localforage: {
      getItem: jest.fn().mockResolvedValue('fake.jwt.token'),
      setItem: jest.fn().mockResolvedValue(true),
      config: jest.fn()
    },
    Swal: { fire: jest.fn(() => Promise.resolve({})) },
    QRCode: function QRCode() {},
    fetch: jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: true }) }),
    navigator: {
      userAgent: 'Android',
      vendor: '',
      mediaDevices: defaultMediaDevices,
      geolocation: { getCurrentPosition: jest.fn(), watchPosition: jest.fn() },
      serviceWorker: {
        register: jest.fn().mockReturnValue(new Promise(() => {})),
        addEventListener: jest.fn()
      }
    },
    location: { hash: '', href: '' },
    history: { back: jest.fn(), pushState: jest.fn() },
    document: {
      getElementById: getElement,
      querySelectorAll: jest.fn(() => []),
      querySelector: jest.fn(() => null),
      addEventListener: jest.fn(),
      visibilityState: 'visible',
      body: {},
      createElement: jest.fn((tag) => getElement(`dynamic-${tag}-${Math.random()}`)),
    },
    window: null,
    module: { exports: {} },
    ...customMocks
  };

  context.window = context;
  context.window.addEventListener = jest.fn();
  context.window.scrollTo = jest.fn();
  context.window.matchMedia = jest.fn(() => ({ matches: false }));

  if (customMocks.navigator) {
    context.navigator = {
      userAgent: 'Android',
      vendor: '',
      mediaDevices: defaultMediaDevices,
      geolocation: { getCurrentPosition: jest.fn(), watchPosition: jest.fn() },
      serviceWorker: {
        register: jest.fn().mockReturnValue(new Promise(() => {})),
        addEventListener: jest.fn()
      },
      ...customMocks.navigator
    };
  }

  vm.createContext(context);
  vm.runInContext(
    `${source}\n;globalThis.__pwa = {
      mulaiKameraSelfie,
      adminCepatKirimAbsensi,
      cekLokasiOtomatis,
      cleanupAbsenForm,
      validasiTombolKirim,
      getCurrentJadwal: () => currentJadwal,
      setCurrentJadwal: (j) => { currentJadwal = j; },
      setAdminCepatState: (s) => { adminCepatState = s; },
      getAdminCepatState: () => adminCepatState,
      getVideoStream: () => videoStream
    };`,
    context
  );

  return { context, elements };
}

describe('Verifikasi Perbaikan Bug & Race Condition PWA (Fix Validation)', () => {

  test('FIX 1: Late camera stream tidak lagi menimpa stream kamera aktif & stream mati di-stop', async () => {
    const streamDeferredA = deferred();
    const streamDeferredB = deferred();

    const stopTrackA = jest.fn();
    const stopTrackB = jest.fn();
    const streamA = { id: 'Stream-Kamera-A', getTracks: () => [{ stop: stopTrackA }] };
    const streamB = { id: 'Stream-Kamera-B', getTracks: () => [{ stop: stopTrackB }] };

    const getUserMedia = jest.fn()
      .mockImplementationOnce(() => streamDeferredA.promise) // Kamera A (default)
      .mockImplementationOnce(() => streamDeferredB.promise); // Kamera B (dipilih user)

    const { context, elements } = createPwaSandbox({
      navigator: {
        userAgent: 'Android',
        mediaDevices: {
          enumerateDevices: jest.fn().mockResolvedValue([
            { kind: 'videoinput', deviceId: 'cam-a', label: 'Front Camera A' },
            { kind: 'videoinput', deviceId: 'cam-b', label: 'Front Camera B' }
          ]),
          getUserMedia
        }
      }
    });

    context.__pwa.setCurrentJadwal({ kode_akses: 'KODE-01' });

    // Inisialisasi awal (memulai stream Kamera A)
    context.__pwa.mulaiKameraSelfie();
    await new Promise(r => setTimeout(r, 10));

    // User memilih Kamera B
    const select = elements.get('selfie-camera-select');
    expect(typeof select.onchange).toBe('function');
    select.value = 'cam-b';
    select.onchange();

    // Kamera B selesai lebih dulu
    streamDeferredB.resolve(streamB);
    await streamDeferredB.promise;
    await new Promise(r => setTimeout(r, 10));

    const kameraEl = elements.get('kamera');
    expect(kameraEl.srcObject.id).toBe('Stream-Kamera-B');

    // Kamera A baru selesai belakangan (terlambat)
    streamDeferredA.resolve(streamA);
    await streamDeferredA.promise;
    await new Promise(r => setTimeout(r, 10));

    // VERIFIKASI: Stream Kamera B tetap aktif! Kamera A ditolak dan langsung di-stop
    expect(kameraEl.srcObject.id).toBe('Stream-Kamera-B');
    expect(stopTrackA).toHaveBeenCalled();
  });

  test('FIX 2: Double Submit pada adminCepatKirimAbsensi dibendung oleh guard', async () => {
    const fetchMock = jest.fn().mockImplementation(() =>
      new Promise(res => setTimeout(() => res({
        ok: true,
        json: () => Promise.resolve({ status: true, message: 'Sukses' })
      }), 50))
    );

    const payload = JSON.stringify({
      data: {
        nip: '198001012000011001',
        nama: 'Pegawai Test',
        exp: Math.floor(Date.now() / 1000) + 3600
      }
    });
    const fakeUserToken = `header.${Buffer.from(payload).toString('base64').replace(/=/g, '')}.signature`;

    const { context } = createPwaSandbox({
      fetch: fetchMock
    });

    context.__pwa.setAdminCepatState({
      jadwal: { kode_akses: 'JADWAL-01', kategori: 'Apel Pagi' },
      status_kehadiran: 'Hadir',
      status_verifikasi: 'Terverifikasi Oleh Admin',
      keterangan: 'Absensi Cepat',
      lat: '-0.62',
      lng: '100.12'
    });

    // Simulasi 2 submit bersamaan
    const call1 = context.__pwa.adminCepatKirimAbsensi(fakeUserToken);
    const call2 = context.__pwa.adminCepatKirimAbsensi(fakeUserToken);

    await Promise.all([call1, call2]);

    // VERIFIKASI: Hanya 1 request yang terikat dan dikirim ke server!
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('FIX 3: Geocoding jadwal lama tidak menimpa form jadwal baru', async () => {
    const geoDeferredOld = deferred();

    const { context, elements } = createPwaSandbox({
      navigator: {
        userAgent: 'Android',
        geolocation: {
          watchPosition: jest.fn((success) => {
            geoDeferredOld.promise.then(pos => success(pos));
            return 1;
          }),
          clearWatch: jest.fn()
        }
      },
      fetch: jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ display_name: 'Lokasi Jadwal Lama (Jalan A)' })
      })
    });

    // 1. User membuka Jadwal 1
    context.__pwa.setCurrentJadwal({
      kode_akses: 'JADWAL-LAMA',
      koordinat: '-0.60,100.10',
      radius_meter: '100'
    });
    const cekLokasiPromise = context.__pwa.cekLokasiOtomatis();

    // 2. User membatalkan form Jadwal 1
    context.__pwa.cleanupAbsenForm();

    // 3. User membuka Jadwal 2
    context.__pwa.setCurrentJadwal({
      kode_akses: 'JADWAL-BARU',
      koordinat: '-0.65,100.15',
      radius_meter: '500'
    });

    // 4. GPS / Geocoding dari Jadwal 1 baru selesai
    geoDeferredOld.resolve({
      coords: { latitude: -0.6001, longitude: 100.1001, accuracy: 10 }
    });
    await cekLokasiPromise;

    // VERIFIKASI: Input alamat jadwal 2 tidak terkontaminasi oleh jadwal 1
    const inputAlamat = elements.get('alamat');
    expect(inputAlamat.value).toBe('');
  });

  test('FIX 4: validasiTombolKirim aman ketika btnKirim tidak ada di DOM', () => {
    const { context, elements } = createPwaSandbox();

    elements.set('btnKirim', null);
    elements.set('fotoBase64', { value: 'data:image/jpeg;base64,123' });
    elements.set('lat', { value: '-0.62' });
    elements.set('keterangan', { value: 'Hadir' });

    // VERIFIKASI: Tidak melemparkan TypeError
    let errorCaught = null;
    try {
      context.__pwa.validasiTombolKirim();
    } catch (e) {
      errorCaught = e;
    }

    expect(errorCaught).toBeNull();
  });

});
