/**
 * Test Uji Coba Endpoint Submit Absensi Kegiatan ASN (Status Kehadiran: TIDAK HADIR / IZIN / SAKIT / CUTI)
 * File: tests/js/api-absen-submit-tidakhadir.test.js
 */

const https = require('https');
const http = require('http');

const WORKER_URL = process.env.WORKER_URL;
const ORIGIN_URL = process.env.ORIGIN_URL || process.env.PHP_URL;
const TEST_NIP = process.env.TEST_NIP || process.env.NIP;
const TEST_NIK = process.env.TEST_NIK || process.env.NIK;
const TEST_KODE_AKSES = process.env.TEST_KODE_AKSES || 'TESTKODE123';

/**
 * File Bukti Dukung Valid < 1 MB
 */
const VALID_SMALL_DOC = "data:application/pdf;base64,JVBERi0xLjAKMSAwIG9iajw8L1BhZ2VzIDIgMCBSPj5lbmRvYmoKMiAwIG9iajw8L0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvTWVkaWFCb3hbMCAwIDMgM10+PmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYKMDAwMDAwMDAxMCAwMDAwMCBuCjAwMDAwMDAwNTAgMDAwMDAgbgowMDAwMDAwMDk2IDAwMDAwIG4KdHJhaWxlcjw8L1Jvb3QgMSAwIFIvU2l6ZSA0Pj4KJSVFT0YK";

/**
 * File Bukti Dukung Oversized > 1 MB (1.048.576 bytes)
 */
const OVERSIZED_DOC = "data:application/pdf;base64," + "A".repeat(1450000);

function printLog(message) {
    process.stdout.write(message + '\n');
}

function logFetchDetail(stepTitle, serverName, targetUrl, headers, payload, resStatus, resBody) {
    printLog(`\n=================================================================`);
    printLog(`[${stepTitle}] SERVER: ${serverName}`);
    printLog(`URL     : ${targetUrl}`);
    printLog(`HEADERS : ${JSON.stringify(headers || {})}`);
    if (payload) {
        const payloadCopy = { ...payload };
        if (payloadCopy.foto_absensi && payloadCopy.foto_absensi.length > 50) {
            payloadCopy.foto_absensi = payloadCopy.foto_absensi.substring(0, 50) + `... [Total ${payloadCopy.foto_absensi.length} chars]`;
        }
        printLog(`PAYLOAD : ${JSON.stringify(payloadCopy)}`);
    } else {
        printLog(`PAYLOAD : (empty / none)`);
    }
    printLog(`HTTP ST : ${resStatus}`);
    printLog(`RESPONSE: ${JSON.stringify(resBody, null, 2)}`);
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

describe('Uji Coba Endpoint Submit Absensi (Status Kehadiran: TIDAK HADIR / IZIN / SAKIT)', () => {
    let validAuthToken = null;

    beforeAll(async () => {
        if (!WORKER_URL || !ORIGIN_URL || !TEST_NIP || !TEST_NIK) {
            throw new Error('Environment variable WORKER_URL, ORIGIN_URL, TEST_NIP, dan TEST_NIK wajib disediakan!');
        }

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
    });

    // =========================================================================
    // 1. TEST UNAUTHENTICATED (401)
    // =========================================================================
    test('1. Test submit Izin tanpa token auth -> Error 401 (Worker vs Origin)', async () => {
        const workerTargetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);

        const payload = {
            kode_akses: TEST_KODE_AKSES,
            status_kehadiran: 'Izin',
            keterangan: 'Izin urusan keluarga'
        };

        const headers = { 'Content-Type': 'application/json' };

        const workerRes = await sendHttpRequest(workerTargetUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
        const workerData = await workerRes.json();
        logFetchDetail('TEST 1: IZIN TANPA TOKEN AUTH', 'WORKER EDGE', workerTargetUrl, headers, payload, workerRes.status, workerData);

        const originRes = await sendHttpRequest(originTargetUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
        const originData = await originRes.json();
        logFetchDetail('TEST 1: IZIN TANPA TOKEN AUTH', 'PHP ORIGIN', originTargetUrl, headers, payload, originRes.status, originData);

        expect(workerData.status).toBe(originData.status);
        expect(workerData.code).toBe(originData.code);
        expect(workerData.message).toBe(originData.message);
        expect(originData.status).toBe(false);
        expect(originData.code).toBe(401);
        expect(originData.message).toBe('Waktu login Anda sudah habis. Silahkan login ulang.');
    });

    // =========================================================================
    // 2. TEST PROTEKSI WORKER EDGE (403 Data Ditolak)
    // =========================================================================
    test('2. Test ASN submit Izin ke Worker Edge -> Error 403 (Data ditolak.)', async () => {
        expect(validAuthToken).toBeDefined();

        const workerTargetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payloadIzin = {
            kode_akses: TEST_KODE_AKSES,
            status_kehadiran: 'Izin',
            keterangan: 'Izin urusan keluarga'
        };
        const headers = {
            'Authorization': `Bearer ${validAuthToken}`,
            'Content-Type': 'application/json'
        };

        const workerRes = await sendHttpRequest(workerTargetUrl, { method: 'POST', headers, body: JSON.stringify(payloadIzin) });
        const workerData = await workerRes.json();
        logFetchDetail('TEST 2: WORKER EDGE DITOLAK UNTUK IZIN', 'WORKER EDGE', workerTargetUrl, headers, payloadIzin, workerRes.status, workerData);

        expect(workerData.status).toBe(false);
        expect(workerData.code).toBe(403);
        expect(workerData.message).toBe('Data ditolak.');
    });

    // =========================================================================
    // 3. TEST MISSING KODE AKSES DI PHP ORIGIN (422)
    // =========================================================================
    test('3. Test submit Izin tanpa kode akses di PHP Origin -> Error 422', async () => {
        expect(validAuthToken).toBeDefined();

        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payloadNoKode = {
            status_kehadiran: 'Izin',
            keterangan: 'Izin urusan keluarga'
        };
        const headers = {
            'Authorization': `Bearer ${validAuthToken}`,
            'Content-Type': 'application/json'
        };

        const originRes = await sendHttpRequest(originTargetUrl, { method: 'POST', headers, body: JSON.stringify(payloadNoKode) });
        const originData = await originRes.json();
        logFetchDetail('TEST 3: IZIN TANPA KODE AKSES', 'PHP ORIGIN', originTargetUrl, headers, payloadNoKode, originRes.status, originData);

        expect(originData.status).toBe(false);
        expect(originData.code).toBe(422);
        expect(originData.message).toBe('Kode akses kegiatan wajib diisi.');
    });

    // =========================================================================
    // 4. TEST MISSING KETERANGAN ALASAN DI PHP ORIGIN (422)
    // =========================================================================
    test('4. Test submit Izin tanpa keterangan di PHP Origin -> Error 422', async () => {
        expect(validAuthToken).toBeDefined();

        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payloadNoKet = {
            kode_akses: TEST_KODE_AKSES,
            status_kehadiran: 'Izin',
            keterangan: ''
        };
        const headers = {
            'Authorization': `Bearer ${validAuthToken}`,
            'Content-Type': 'application/json'
        };

        const originRes = await sendHttpRequest(originTargetUrl, { method: 'POST', headers, body: JSON.stringify(payloadNoKet) });
        const originData = await originRes.json();
        logFetchDetail('TEST 4: IZIN TANPA KETERANGAN', 'PHP ORIGIN', originTargetUrl, headers, payloadNoKet, originRes.status, originData);

        expect(originData.status).toBe(false);
        expect(originData.code).toBe(422);
        expect(originData.message).toBe('Keterangan alasan tidak hadir wajib diisi.');
    });

    // =========================================================================
    // 5. TEST OVERSIZED BUKTI DUKUNG > 1 MB DI PHP ORIGIN (422)
    // =========================================================================
    test('5. Test submit Izin dengan bukti dukung > 1 MB di PHP Origin -> Error 422', async () => {
        expect(validAuthToken).toBeDefined();

        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payloadOversize = {
            kode_akses: TEST_KODE_AKSES,
            status_kehadiran: 'Izin',
            keterangan: 'Izin urusan dinas',
            foto_absensi: OVERSIZED_DOC
        };
        const headers = {
            'Authorization': `Bearer ${validAuthToken}`,
            'Content-Type': 'application/json'
        };

        const originRes = await sendHttpRequest(originTargetUrl, { method: 'POST', headers, body: JSON.stringify(payloadOversize) });
        const originData = await originRes.json();
        logFetchDetail('TEST 5: IZIN BUKTI OVERSIZED > 1MB', 'PHP ORIGIN', originTargetUrl, headers, payloadOversize, originRes.status, originData);

        expect(originData.status).toBe(false);
        expect(originData.code).toBe(422);
        expect(originData.message).toBe('Ukuran file bukti dukung terlalu besar. Maksimal 1 MB.');
    });

    // =========================================================================
    // 6. TEST POSITIVE SUBMIT IZIN VALID DI PHP ORIGIN (200)
    // =========================================================================
    test('6. Test submit Izin valid di PHP Origin -> Sukses (200, Menunggu Verifikasi Admin)', async () => {
        expect(validAuthToken).toBeDefined();

        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const validPayload = {
            kode_akses: TEST_KODE_AKSES,
            status_kehadiran: 'Izin',
            keterangan: 'Izin urusan keluarga mendesak',
            foto_absensi: VALID_SMALL_DOC
        };
        const headers = {
            'Authorization': `Bearer ${validAuthToken}`,
            'Content-Type': 'application/json'
        };

        const originRes = await sendHttpRequest(originTargetUrl, { method: 'POST', headers, body: JSON.stringify(validPayload) });
        const originData = await originRes.json();
        logFetchDetail('TEST 6: IZIN VALID', 'PHP ORIGIN', originTargetUrl, headers, validPayload, originRes.status, originData);

        expect(originData.status).toBe(true);
        expect(originData.code).toBe(200);
        expect(originData.message).toBe('Absen sudah terkirim. BKPSDM Kota Pariaman akan melakukan verifikasi absen Anda.');
        expect(originData.data).toBeNull();
    });
});
