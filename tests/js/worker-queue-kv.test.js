const fs = require('fs');
const vm = require('vm');
const util = require('util');

function loadWorker(mockUserRole = 'super admin') {
  const code = fs.readFileSync(require.resolve('../../worker/src/index.js'), 'utf8');
  const transformed = code
    .replace(/import\s+[^;]+;?/g, '')
    .replace('export default {', 'module.exports = {');

  const context = {
    console,
    Date,
    Promise,
    URL,
    URLSearchParams,
    TextEncoder: global.TextEncoder || util.TextEncoder,
    AbortSignal,
    setTimeout: (fn) => fn(), // Fast execution in unit tests
    jwtVerify: jest.fn().mockResolvedValue({ payload: { data: { role: [mockUserRole] } } }),
    SignJWT: class {
      setProtectedHeader() { return this; }
      setIssuedAt() { return this; }
      setIssuer() { return this; }
      setExpirationTime() { return this; }
      sign() { return Promise.resolve('mock-token'); }
    },
    bcrypt: { compare: jest.fn().mockResolvedValue(true) },
    fetch: (...args) => global.fetch(...args),
    Response: global.Response || class Response {
      constructor(body, init = {}) {
        this._body = body;
        this.status = init.status || 200;
        this.headers = init.headers || {};
      }
      json() { return Promise.resolve(JSON.parse(this._body)); }
      text() { return Promise.resolve(this._body); }
    },
    module: { exports: {} }
  };
  vm.createContext(context);
  vm.runInContext(transformed, context);
  return context.module.exports;
}

describe('Worker Queue Consumer (No KV Error Logging)', () => {

  test('Consumer: 5xx/520 server errors trigger 60-second retry without writing to KV', async () => {
    const worker = loadWorker('super admin');
    const retryFn = jest.fn();
    const ackFn = jest.fn();
    const kvPut = jest.fn();

    const batch = {
      messages: [
        {
          id: 'msg-520-proof',
          attempts: 1,
          body: {
            nip: '199001012020011001',
            nama: 'Budi Test',
            kode_akses: 'JADWAL-520',
            jwt_token: 'token-jwt-super-admin',
            status_kehadiran: 'Hadir'
          },
          retry: retryFn,
          ack: ackFn
        }
      ],
      retryAll: jest.fn()
    };

    const env = {
      ORIGIN_API_BULK_URL: 'https://api-origin.test/bulk',
      WORKER_SECRET: 'test-secret',
      PEGAWAI_KV: { put: kvPut }
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 520,
      text: () => Promise.resolve('Origin Web Server Down / Error 520')
    });

    await worker.queue(batch, env);

    expect(kvPut).not.toHaveBeenCalled();
    expect(retryFn).toHaveBeenCalledWith({ delaySeconds: 60 });
    expect(ackFn).not.toHaveBeenCalled();
  });

  test('Consumer: 400 client data error ACKs immediately without retry and without writing to KV', async () => {
    const worker = loadWorker('super admin');
    const retryFn = jest.fn();
    const ackFn = jest.fn();
    const kvPut = jest.fn();

    const batch = {
      messages: [
        {
          id: 'msg-400-data-error',
          attempts: 1,
          body: {
            nip: '199001012020011001',
            nama: 'Budi Test',
            kode_akses: 'JADWAL-400',
            jwt_token: 'token-jwt',
            status_kehadiran: 'Hadir'
          },
          retry: retryFn,
          ack: ackFn
        }
      ],
      retryAll: jest.fn()
    };

    const env = {
      ORIGIN_API_BULK_URL: 'https://api-origin.test/bulk',
      WORKER_SECRET: 'test-secret',
      PEGAWAI_KV: { put: kvPut }
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Data absensi tidak valid / NIP tidak ditemukan')
    });

    await worker.queue(batch, env);

    expect(kvPut).not.toHaveBeenCalled();
    expect(ackFn).toHaveBeenCalled();
    expect(retryFn).not.toHaveBeenCalled();
  });

});
