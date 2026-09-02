/**
 * Test Uji Coba Endpoint Submit Absensi Kegiatan ASN (Status Kehadiran: HADIR)
 * File: tests/js/api-absen-submit-hadir.test.js
 */

const https = require('https');
const http = require('http');

const WORKER_URL = process.env.WORKER_URL;
const ORIGIN_URL = process.env.ORIGIN_URL || process.env.PHP_URL;
const TEST_NIP = process.env.TEST_NIP || process.env.NIP;
const TEST_NIK = process.env.TEST_NIK || process.env.NIK;
const TEST_KODE_AKSES = process.env.TEST_KODE_AKSES || 'TESTKODE123';

const TEST_ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME || process.env.ADMIN_USER;
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || process.env.ADMIN_PASS;

/**
 * Dummy Foto Base64 Kecil (< 100 KB) - 1x1 Pixel Red Dot JPEG
 */
const VALID_SMALL_BASE64_PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

/**
 * Dummy Foto Base64 Besar (> 100 KB = 102,400 bytes)
 */
const OVERSIZE_BASE64_PHOTO = "data:image/jpeg;base64," + "A".repeat(140000);

function printLog(message) {
    process.stdout.write(message + '\n');
}

function logTestDetail({ testName, serverName, method, endpointUrl, payload, resStatus, resBody, isPass }) {
    printLog(`\n=================================================================`);
    printLog(`TEST SUITE : ${testName}`);
    printLog(`SERVER     : ${serverName}`);
    printLog(`HTTP METHOD: ${method}`);
    printLog(`ENDPOINT   : ${endpointUrl}`);
    
    if (payload) {
        const payloadCopy = { ...payload };
        if (payloadCopy.foto_absensi && payloadCopy.foto_absensi.length > 50) {
            payloadCopy.foto_absensi = payloadCopy.foto_absensi.substring(0, 50) + `... [Total ${payloadCopy.foto_absensi.length} bytes/chars]`;
        }
        printLog(`DATA DIKIRIM: ${JSON.stringify(payloadCopy, null, 2)}`);
    } else {
        printLog(`DATA DIKIRIM: (Tanpa Payload / Kosong)`);
    }

    printLog(`HTTP STATUS : ${resStatus}`);
    printLog(`RESPON OUTPUT: ${JSON.stringify(resBody, null, 2)}`);
    printLog(`STATUS TEST : ${isPass ? '✅ LULUS (PASS)' : '❌ GAGAL (FAIL)'}`);
    printLog(`=================================================================\n`);
}

function buildTargetUrl(baseUrl, endpointPath) {
    const cleanBase = baseUrl.replace(/\/$/, '');
    const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    
    if (cleanBase.endsWith('/api') && cleanPath.startsWith('/api/')) {
        return `${cleanBase}${cleanPath.substring(4)}`;
    }
    return `${cleanBase}${cleanPath}`;
}

async function sendHttpRequest(targetUrl, options = {}) {
    if (typeof globalThis.fetch === 'function') {
        try {
            return await globalThis.fetch(targetUrl, options);
        } catch (e) {
            // Fallback ke native client
        }
    }

    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(targetUrl);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        const postData = options.body || '';

        const reqHeaders = {
            ...(options.headers || {})
        };
        if (options.method && options.method.toUpperCase() !== 'GET' && postData) {
            reqHeaders['Content-Length'] = Buffer.byteLength(postData);
        }

        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: `${parsedUrl.pathname}${parsedUrl.search}`,
            method: options.method || 'GET',
            headers: reqHeaders
        };

        const req = client.request(reqOptions, (res) => {
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    json: async () => {
                        try {
                            return JSON.parse(rawData);
                        } catch (err) {
                            throw new Error(`Response bukan JSON valid: ${rawData}`);
                        }
                    },
                    text: async () => rawData
                });
            });
        });

        req.on('error', reject);
        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

// Format Helper Jam (HH:mm:ss)
function formatTimeOffset(offsetMinutes) {
    const d = new Date(Date.now() + offsetMinutes * 60000);
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
}

describe('Uji Coba Endpoint Submit Absensi (Status Kehadiran: HADIR)', () => {
    let validAuthToken = null;
    let adminAuthToken = null;

    // Kode Akses Jadwal Fixture
    const KODE_NORMAL = TEST_KODE_AKSES;
    const KODE_FUTURE = `FUT${TEST_KODE_AKSES.substring(0, 3)}`.toUpperCase();
    const KODE_EXPIRED = `EXP${TEST_KODE_AKSES.substring(0, 3)}`.toUpperCase();
    const KODE_STRICT_LOC = `LOC${TEST_KODE_AKSES.substring(0, 3)}`.toUpperCase();

    beforeAll(async () => {
        if (!WORKER_URL || !ORIGIN_URL || !TEST_NIP || !TEST_NIK) {
            throw new Error('Environment variable WORKER_URL, ORIGIN_URL, TEST_NIP, dan TEST_NIK wajib disediakan!');
        }

        // 1. Login ASN
        const loginUrl = buildTargetUrl(ORIGIN_URL, `/api/login-asn?cb=${Date.now()}`);
        const loginRes = await sendHttpRequest(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nip: TEST_NIP, nik: TEST_NIK })
        });
        const loginData = await loginRes.json();
        if (loginData && loginData.status && loginData.data) {
            validAuthToken = loginData.data.access_token || loginData.data.token;
        }

        // 2. Setup Otomatis Jadwal Uji via Admin API (jika credential admin ada)
        if (TEST_ADMIN_USERNAME && TEST_ADMIN_PASSWORD) {
            try {
                const adminLoginUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/login?cb=${Date.now()}`);
                const adminLoginRes = await sendHttpRequest(adminLoginUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD })
                });
                const adminLoginData = await adminLoginRes.json();
                if (adminLoginData && adminLoginData.status && adminLoginData.data) {
                    adminAuthToken = adminLoginData.data.access_token || adminLoginData.data.token;
                }

                if (adminAuthToken) {
                    const todayYMD = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
                    const adminHeaders = {
                        'Authorization': `Bearer ${adminAuthToken}`,
                        'Content-Type': 'application/json'
                    };

                    // Fixture 1: Jadwal Normal Valid (Buka)
                    await sendHttpRequest(buildTargetUrl(ORIGIN_URL, `/api/jadwal/${KODE_NORMAL}`), {
                        method: 'PUT',
                        headers: adminHeaders,
                        body: JSON.stringify({
                            judul: 'Uji Coba Presensi Hadir Normal',
                            kategori: 'Apel Pagi',
                            tanggal: todayYMD,
                            jam_mulai: formatTimeOffset(-60),
                            jam_selesai: formatTimeOffset(120),
                            koordinat: '-0.626411,100.124588',
                            radius_meter: 50000,
                            is_strict_time: 0,
                            is_strict_location: 0,
                            aktifkan_antrian: 1
                        })
                    });

                    // Fixture 2: Jadwal Belum Buka (Future)
                    await sendHttpRequest(buildTargetUrl(ORIGIN_URL, `/api/jadwal/${KODE_FUTURE}`), {
                        method: 'PUT',
                        headers: adminHeaders,
                        body: JSON.stringify({
                            judul: 'Uji Coba Presensi Belum Buka',
                            kategori: 'Rapat',
                            tanggal: todayYMD,
                            jam_mulai: formatTimeOffset(60),
                            jam_selesai: formatTimeOffset(180),
                            koordinat: '-0.626411,100.124588',
                            radius_meter: 5000,
                            is_strict_time: 0,
                            is_strict_location: 0,
                            aktifkan_antrian: 1
                        })
                    });

                    // Fixture 3: Jadwal Strict Time Expired
                    await sendHttpRequest(buildTargetUrl(ORIGIN_URL, `/api/jadwal/${KODE_EXPIRED}`), {
                        method: 'PUT',
                        headers: adminHeaders,
                        body: JSON.stringify({
                            judul: 'Uji Coba Presensi Strict Time Expired',
                            kategori: 'Apel Sore',
                            tanggal: todayYMD,
                            jam_mulai: formatTimeOffset(-120),
                            jam_selesai: formatTimeOffset(-60),
                            koordinat: '-0.626411,100.124588',
                            radius_meter: 5000,
                            is_strict_time: 1,
                            is_strict_location: 0,
                            aktifkan_antrian: 1
                        })
                    });

                    // Fixture 4: Jadwal Strict Location (Radius Sempit 5 meter)
                    await sendHttpRequest(buildTargetUrl(ORIGIN_URL, `/api/jadwal/${KODE_STRICT_LOC}`), {
                        method: 'PUT',
                        headers: adminHeaders,
                        body: JSON.stringify({
                            judul: 'Uji Coba Presensi Strict Location',
                            kategori: 'Upacara',
                            tanggal: todayYMD,
                            jam_mulai: formatTimeOffset(-60),
                            jam_selesai: formatTimeOffset(120),
                            koordinat: '-0.626411,100.124588',
                            radius_meter: 5,
                            is_strict_time: 0,
                            is_strict_location: 1,
                            aktifkan_antrian: 1
                        })
                    });
                }
            } catch (err) {
                console.warn('[beforeAll] Setup fixture jadwal otomatis dilewati:', err.message);
            }
        }
    });

    // =========================================================================
    // 1. TEST UNAUTHENTICATED (401)
    // =========================================================================
    test('1. Test submit Hadir tanpa token auth -> Error 401 (Kecocokan Worker vs Origin)', async () => {
        const workerTargetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);

        const payload = {
            kode_akses: KODE_NORMAL,
            status_kehadiran: 'Hadir',
            lat: '-0.626',
            lng: '100.124',
            lokasi: 'Balaikota Pariaman',
            foto_absensi: VALID_SMALL_BASE64_PHOTO
        };

        const headers = { 'Content-Type': 'application/json' };

        const workerRes = await sendHttpRequest(workerTargetUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
        const workerData = await workerRes.json();

        const originRes = await sendHttpRequest(originTargetUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
        const originData = await originRes.json();

        const isWorkerPass = (workerData.status === false && workerData.code === 401);
        const isOriginPass = (originData.status === false && originData.code === 401);

        logTestDetail({
            testName: '1. HADIR TANPA TOKEN AUTH (401)',
            serverName: 'WORKER EDGE',
            method: 'POST',
            endpointUrl: workerTargetUrl,
            payload,
            resStatus: workerRes.status,
            resBody: workerData,
            isPass: isWorkerPass
        });

        logTestDetail({
            testName: '1. HADIR TANPA TOKEN AUTH (401)',
            serverName: 'PHP ORIGIN',
            method: 'POST',
            endpointUrl: originTargetUrl,
            payload,
            resStatus: originRes.status,
            resBody: originData,
            isPass: isOriginPass
        });

        expect(workerData.status).toBe(originData.status);
        expect(workerData.code).toBe(originData.code);
        expect(workerData.message).toBe(originData.message);
        expect(originData.status).toBe(false);
        expect(originData.code).toBe(401);
        expect(originData.message).toBe('Waktu login Anda sudah habis. Silahkan login ulang.');
    });

    // =========================================================================
    // 2. TEST DATA INCOMPLETE / TANPA FOTO (422)
    // =========================================================================
    test('2. Test submit Hadir tanpa foto selfie -> Error 422 (Kecocokan Worker vs Origin)', async () => {
        expect(validAuthToken).toBeDefined();

        const workerTargetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);

        const payloadIncomplete = {
            kode_akses: KODE_NORMAL,
            status_kehadiran: 'Hadir',
            lat: '-0.626',
            lng: '100.124',
            lokasi: 'Balaikota Pariaman'
        };

        const headers = {
            'Authorization': `Bearer ${validAuthToken}`,
            'Content-Type': 'application/json'
        };

        const workerRes = await sendHttpRequest(workerTargetUrl, { method: 'POST', headers, body: JSON.stringify(payloadIncomplete) });
        const workerData = await workerRes.json();

        const originRes = await sendHttpRequest(originTargetUrl, { method: 'POST', headers, body: JSON.stringify(payloadIncomplete) });
        const originData = await originRes.json();

        const isWorkerPass = (workerData.status === false && workerData.code === 422);
        const isOriginPass = (originData.status === false && originData.code === 422);

        logTestDetail({
            testName: '2. HADIR TANPA FOTO SELFIE (422)',
            serverName: 'WORKER EDGE',
            method: 'POST',
            endpointUrl: workerTargetUrl,
            payload: payloadIncomplete,
            resStatus: workerRes.status,
            resBody: workerData,
            isPass: isWorkerPass
        });

        logTestDetail({
            testName: '2. HADIR TANPA FOTO SELFIE (422)',
            serverName: 'PHP ORIGIN',
            method: 'POST',
            endpointUrl: originTargetUrl,
            payload: payloadIncomplete,
            resStatus: originRes.status,
            resBody: originData,
            isPass: isOriginPass
        });

        expect(workerData.status).toBe(originData.status);
        expect(workerData.code).toBe(originData.code);
        expect(workerData.message).toBe(originData.message);
        expect(originData.status).toBe(false);
        expect(originData.code).toBe(422);
        expect(originData.message).toBe('Foto / bukti dukung wajib diisi.');
    });

    // =========================================================================
    // 3. TEST OVERSIZED PHOTO BASE64 > 100 KB (422)
    // =========================================================================
    test('3. Test submit Hadir dengan foto Base64 > 100 KB -> Error 422 (Kecocokan Worker vs Origin)', async () => {
        expect(validAuthToken).toBeDefined();

        const workerTargetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);

        const payloadOversize = {
            kode_akses: KODE_NORMAL,
            status_kehadiran: 'Hadir',
            lat: '-0.626',
            lng: '100.124',
            lokasi: 'Balaikota Pariaman',
            foto_absensi: OVERSIZE_BASE64_PHOTO
        };

        const headers = {
            'Authorization': `Bearer ${validAuthToken}`,
            'Content-Type': 'application/json'
        };

        const workerRes = await sendHttpRequest(workerTargetUrl, { method: 'POST', headers, body: JSON.stringify(payloadOversize) });
        const workerData = await workerRes.json();

        const originRes = await sendHttpRequest(originTargetUrl, { method: 'POST', headers, body: JSON.stringify(payloadOversize) });
        const originData = await originRes.json();

        const isWorkerPass = (workerData.status === false && workerData.code === 422);
        const isOriginPass = (originData.status === false && originData.code === 422);

        logTestDetail({
            testName: '3. HADIR FOTO OVERSIZED > 100KB (422)',
            serverName: 'WORKER EDGE',
            method: 'POST',
            endpointUrl: workerTargetUrl,
            payload: payloadOversize,
            resStatus: workerRes.status,
            resBody: workerData,
            isPass: isWorkerPass
        });

        logTestDetail({
            testName: '3. HADIR FOTO OVERSIZED > 100KB (422)',
            serverName: 'PHP ORIGIN',
            method: 'POST',
            endpointUrl: originTargetUrl,
            payload: payloadOversize,
            resStatus: originRes.status,
            resBody: originData,
            isPass: isOriginPass
        });

        expect(workerData.status).toBe(originData.status);
        expect(workerData.code).toBe(originData.code);
        expect(workerData.message).toBe(originData.message);
        expect(originData.status).toBe(false);
        expect(originData.code).toBe(422);
        expect(originData.message).toBe('Ukuran foto terlalu besar. Maksimal 100 KB.');
    });

    // =========================================================================
    // 4. TEST MISSING GPS KOORDINAT HADIR (422)
    // =========================================================================
    test('4. Test submit Hadir tanpa koordinat GPS / 0,0 -> Error 422 (Kecocokan Worker vs Origin)', async () => {
        expect(validAuthToken).toBeDefined();

        const workerTargetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);

        const payloadNoGps = {
            kode_akses: KODE_NORMAL,
            status_kehadiran: 'Hadir',
            lat: '0',
            lng: '0',
            lokasi: '',
            foto_absensi: VALID_SMALL_BASE64_PHOTO
        };

        const headers = {
            'Authorization': `Bearer ${validAuthToken}`,
            'Content-Type': 'application/json'
        };

        const workerRes = await sendHttpRequest(workerTargetUrl, { method: 'POST', headers, body: JSON.stringify(payloadNoGps) });
        const workerData = await workerRes.json();

        const originRes = await sendHttpRequest(originTargetUrl, { method: 'POST', headers, body: JSON.stringify(payloadNoGps) });
        const originData = await originRes.json();

        const isWorkerPass = (workerData.status === false && workerData.code === 422);
        const isOriginPass = (originData.status === false && originData.code === 422);

        logTestDetail({
            testName: '4. HADIR TANPA GPS KOORDINAT (422)',
            serverName: 'WORKER EDGE',
            method: 'POST',
            endpointUrl: workerTargetUrl,
            payload: payloadNoGps,
            resStatus: workerRes.status,
            resBody: workerData,
            isPass: isWorkerPass
        });

        logTestDetail({
            testName: '4. HADIR TANPA GPS KOORDINAT (422)',
            serverName: 'PHP ORIGIN',
            method: 'POST',
            endpointUrl: originTargetUrl,
            payload: payloadNoGps,
            resStatus: originRes.status,
            resBody: originData,
            isPass: isOriginPass
        });

        expect(workerData.status).toBe(originData.status);
        expect(workerData.code).toBe(originData.code);
        expect(workerData.message).toBe(originData.message);
        expect(originData.status).toBe(false);
        expect(originData.code).toBe(422);
        expect(originData.message).toBe('Lokasi GPS wajib diisi untuk presensi Hadir.');
    });

    // =========================================================================
    // 5. TEST POSITIVE SUBMIT HADIR FOTO VALID < 100 KB (200)
    // =========================================================================
    test('5. Test submit Hadir dengan data & foto valid -> Sukses kecocokan Worker vs PHP Origin (200)', async () => {
        expect(validAuthToken).toBeDefined();

        const workerTargetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);

        const validPayload = {
            kode_akses: KODE_NORMAL,
            status_kehadiran: 'Hadir',
            lat: '-0.626411',
            lng: '100.124588',
            lokasi: 'Balaikota Pariaman',
            keterangan: 'Presensi Hadir Uji Coba',
            foto_absensi: VALID_SMALL_BASE64_PHOTO
        };

        const headers = {
            'Authorization': `Bearer ${validAuthToken}`,
            'Content-Type': 'application/json'
        };

        const originRes = await sendHttpRequest(originTargetUrl, { method: 'POST', headers, body: JSON.stringify(validPayload) });
        const originData = await originRes.json();

        const workerRes = await sendHttpRequest(workerTargetUrl, { method: 'POST', headers, body: JSON.stringify(validPayload) });
        const workerData = await workerRes.json();

        const isWorkerPass = (workerData.status === true && workerData.code === 200);
        const isOriginPass = (originData.status === true && originData.code === 200);

        logTestDetail({
            testName: '5. HADIR DATA & FOTO VALID (200)',
            serverName: 'PHP ORIGIN',
            method: 'POST',
            endpointUrl: originTargetUrl,
            payload: validPayload,
            resStatus: originRes.status,
            resBody: originData,
            isPass: isOriginPass
        });

        logTestDetail({
            testName: '5. HADIR DATA & FOTO VALID (200)',
            serverName: 'WORKER EDGE',
            method: 'POST',
            endpointUrl: workerTargetUrl,
            payload: validPayload,
            resStatus: workerRes.status,
            resBody: workerData,
            isPass: isWorkerPass
        });

        if (originData.status === true && workerData.status === true) {
            expect(workerData.status).toBe(originData.status);
            expect(workerData.code).toBe(originData.code);
            expect(workerData.message).toBe(originData.message);
            expect(originData.status).toBe(true);
            expect(originData.code).toBe(200);
            expect(workerData.code).toBe(200);
            expect(originData.data).toBeNull();
            expect(workerData.data).toBeNull();
        }
    });
});
