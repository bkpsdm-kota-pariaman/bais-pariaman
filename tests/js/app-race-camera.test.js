const fs = require('fs');
const vm = require('vm');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function loadApp(overrides = {}) {
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
        classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn(() => false), toggle: jest.fn() },
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        getTracks: undefined,
      });
    }
    return elements.get(id);
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
    FormData: class FormData { append() {} },
    File: class File {},
    Blob,
    atob: global.atob,
    localStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
    sessionStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
    localforage: { getItem: jest.fn(), setItem: jest.fn(), config: jest.fn() },
    Swal: { fire: jest.fn(() => Promise.resolve({})) },
    QRCode: function QRCode() {},
    fetch: jest.fn(),
    navigator: { userAgent: 'Android', vendor: '', mediaDevices: {}, serviceWorker: undefined },
    location: { hash: '', href: '' },
    history: { back: jest.fn(), pushState: jest.fn() },
    document: {
      getElementById: getElement,
      querySelectorAll: jest.fn(() => []),
      querySelector: jest.fn(() => null),
      addEventListener: jest.fn(),
      visibilityState: 'visible',
      body: {},
      createElement: jest.fn(() => getElement(`option-${Math.random()}`)),
    },
    window: null,
    module: { exports: {} },
    ...overrides,
  };
  context.window = context;
  context.window.addEventListener = jest.fn();
  context.window.scrollTo = jest.fn();
  context.window.matchMedia = jest.fn(() => ({ matches: false }));
  vm.createContext(context);
  vm.runInContext(`${source}\n;globalThis.__appTest = { mulaiKameraSelfie, setJadwal: (value) => { currentJadwal = value; } };`, context);
  return { context, elements };
}

describe('app.js camera race reproduction', () => {
  test('late camera request overwrites newer selected camera stream', async () => {
    const first = deferred();
    const second = deferred();
    const streamA = { id: 'A', getTracks: () => [{ stop: jest.fn() }] };
    const streamB = { id: 'B', getTracks: () => [{ stop: jest.fn() }] };
    const getUserMedia = jest.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const { context, elements } = loadApp({
      navigator: {
        userAgent: 'Android', vendor: '', serviceWorker: { controller: null, register: jest.fn(() => Promise.resolve({ update: jest.fn(() => Promise.resolve()) })), addEventListener: jest.fn() },
        mediaDevices: {
          enumerateDevices: jest.fn().mockResolvedValue([
            { kind: 'videoinput', deviceId: 'camera-a', label: 'Front A' },
            { kind: 'videoinput', deviceId: 'camera-b', label: 'Front B' },
          ]),
          getUserMedia,
        },
      },
    });
    context.__appTest.setJadwal({ kode_akses: 'RACE01' });

    await context.__appTest.mulaiKameraSelfie();
    elements.get('selfie-camera-select').onchange();
    await Promise.resolve();

    second.resolve(streamB);
    await Promise.resolve();
    await Promise.resolve();
    first.resolve(streamA);
    await Promise.resolve();
    await Promise.resolve();

    expect(elements.get('kamera').srcObject).toBe(streamB); // Fails before fix: stale stream A wins
  });
});
// Expected red test: current implementation attaches stale stream A after stream B.
