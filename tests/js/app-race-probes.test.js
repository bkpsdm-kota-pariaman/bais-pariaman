const fs = require('fs');

const source = fs.readFileSync(
  require.resolve('../../src/Views/pwa/js/app.js'),
  'utf8'
);

function block(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Block not found: ${start}`);
  return source.slice(from, to + end.length);
}

describe('app.js race-condition probes: camera', () => {
  test('camera startup has generation guard for stale requests', () => {
    const camera = block('async function mulaiKameraSelfie()', 'function ambilFoto()');
    expect(camera).toContain('await navigator.mediaDevices.getUserMedia(constraints)');
    expect(camera).toMatch(/selfieCameraGeneration/i);
  });
});

describe('app.js race-condition probes: scanner', () => {
  test('scanner restart timeout is not cancellable by cleanup', () => {
    const scan = block('async function handleScanSuccess', 'function startHadirFlow');
    expect(scan).toContain('setTimeout(() =>');
    expect(scan).toContain('_startScanner(selectedCameraId)');
    expect(scan).not.toMatch(/clearTimeout\([^)]*scanner|scanner.*generation|scan.*generation/is);
  });
});

describe('app.js race-condition probes: submission', () => {
  test('admin quick attendance has duplicate-submit lock', () => {
    const submit = block('async function adminCepatKirimAbsensi', 'function tampilkanFormLanjutan');
    expect(submit).toMatch(/isSubmittingAdminCepat/i);
  });

  test('normal Worker timeout path can invoke origin fallback', () => {
    const submit = block('async function kirimAbsensi()', 'async function adminCepatKirimAbsensi');
    expect(submit).toContain('res = await sendToOriginServer()');
    expect(submit).toContain('fallback ke server utama');
  });
});

describe('app.js race-condition probes: geolocation and cache', () => {
  test('geolocation uses multiple completion paths without settled guard', () => {
    const geo = block('function getPreciseLocation()', 'async function getAlamatFromKoordinat');
    expect(geo).toContain('resolve(pos)');
    expect(geo).toContain('navigator.geolocation.getCurrentPosition(resolve, reject');
    expect(geo).not.toMatch(/settled|completed|generation|requestId/i);
  });

  test('OPD cache function deduplicates same-tab requests and rejects stale writes', () => {
    const opd = block('async function fetchAndCacheOpdList', '// ==========================================\r\n// 5. FUNGSI KHUSUS ADMIN');
    expect(opd).toMatch(/opdCacheInFlight/);
    expect(opd).toMatch(/opd_cache_written_at/);
    expect(opd).toMatch(/requestStartedAt < latestWrittenAt/);
  });
});

describe('app.js defensive input probes', () => {
  test('photo capture does not guard video readiness/dimensions', () => {
    const photo = block('function ambilFoto()', 'function ulangFoto()');
    expect(photo).toContain('v.videoHeight / v.videoWidth');
    expect(photo).not.toMatch(/readyState|videoWidth.*0|videoHeight.*0/i);
  });

  test('permission and validation paths contain unguarded DOM assumptions', () => {
    const validation = block('function validasiTombolKirim()', 'function batalAbsen');
    expect(validation).toContain('btnKirim.disabled');
    expect(validation).not.toMatch(/if\s*\(btnKirim\)/);
  });
});