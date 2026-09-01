/**
 * Test Uji Coba Endpoint Cek Jadwal Kegiatan (Worker Edge & Direct PHP Origin)
 * Format Output dan Validasi Kesamaan Response Berdasarkan .agents/api.md
 * File: tests/js/api-jadwal.test.js
 */

const https = require('https');
const http = require('http');

const WORKER_URL = process.env.WORKER_URL;
const ORIGIN_URL = process.env.ORIGIN_URL || process.env.PHP_URL;
const TEST_NIP = process.env.TEST_NIP || process.env.NIP;
const TEST_NIK = process.env.TEST_NIK || process.env.NIK;
const TEST_KODE_JADWAL = process.env.TEST_KODE_JADWAL || process.env.KODE_JADWAL || 'KODE12';

/**
 * Output log bersih langsung ke stdout tanpa trace stack Jest
 */
function printLog(message) {
    process.stdout.write(message + '\n');
}

/**
 * Helper penyesuaian base URL (menghindari duplikasi /api)
 */
function buildTargetUrl(baseUrl, endpointPath) {
    const cleanBase = baseUrl.replace(/\/$/, '');
    const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    
    if (cleanBase.endsWith('/api') && cleanPath.startsWith('/api/')) {
        return `${cleanBase}${cleanPath.substring(4)}`;
    }
    return `${cleanBase}${cleanPath}`;
}

/**
 * Native HTTP/HTTPS request helper
 */
async function sendHttpRequest(targetUrl, options = {}) {
    if (typeof globalThis.fetch === 'function') {
        try {
            return await globalThis.fetch(targetUrl, options);
        } catch (e) {
            // Fallback ke native https/http jika fetch VM error
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

describe('Uji Coba Endpoint Jadwal Kegiatan: Worker Edge & Direct PHP Origin', () => {
    let validAuthToken = null;

    beforeAll(async () => {
        if (!WORKER_URL) {
            throw new Error('Parameter WORKER_URL wajib diberikan melalui environment variable!');
        }
        if (!ORIGIN_URL) {
            throw new Error('Parameter ORIGIN_URL wajib diberikan melalui environment variable!');
        }
        if (!TEST_NIP) {
            throw new Error('Parameter TEST_NIP wajib diberikan melalui environment variable!');
        }
        if (!TEST_NIK) {
            throw new Error('Parameter TEST_NIK wajib diberikan melalui environment variable!');
        }

        // Login ke PHP Origin untuk mendapatkan JWT Token sah
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
    // 1. TEST KONDISI JADWAL TIDAK DITEMUKAN / SALAH (NEGATIVE TEST)
    // =========================================================================
    test('1. Test kondisi dengan kode jadwal salah: kecocokan response Worker vs PHP Origin & validasi .agents/api.md', async () => {
        const invalidKode = `INVALID_${Date.now()}`;

        // --- 1.1 Worker Check (/api/jadwal/INVALID) ---
        const workerTargetUrl = buildTargetUrl(WORKER_URL, `/api/jadwal/${invalidKode}?cb=${Date.now()}`);
        printLog(`\n[LANGKAH 1.1] GET -> ${workerTargetUrl}`);

        const workerRes = await sendHttpRequest(workerTargetUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${validAuthToken}` }
        });

        const workerData = await workerRes.json();
        printLog(JSON.stringify(workerData, null, 2));

        // --- 1.2 Direct PHP Origin Check (/api/jadwal/INVALID) ---
        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/jadwal/${invalidKode}?cb=${Date.now()}`);
        printLog(`\n[LANGKAH 1.2] GET -> ${originTargetUrl}`);

        const originRes = await sendHttpRequest(originTargetUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${validAuthToken}` }
        });

        const originData = await originRes.json();
        printLog(JSON.stringify(originData, null, 2));

        // --- 1.3 Cek Kecocokan Response Worker vs PHP Origin ---
        if (workerData.code === 404 && originData.code === 404) {
            printLog('\n[VALIDASI KECOCOKAN] Memeriksa kesamaan persis error response antara Worker dan PHP Origin...');
            expect(workerData.status).toBe(originData.status);
            expect(workerData.code).toBe(originData.code);
            expect(workerData.message).toBe(originData.message);
            expect(workerData.data).toBe(originData.data);
        }

        // --- 1.4 Validasi Kesesuaian Terhadap Format .agents/api.md ---
        printLog('\n[VALIDASI API.MD] Memeriksa kesesuaian format output terhadap .agents/api.md...');
        expect(originData).toBeDefined();
        expect(originData.status).toBe(false);
        expect(originData.code).toBe(404);
        expect(originData.message).toBe('Jadwal kegiatan tidak ditemukan atau sudah tidak berlaku untuk hari ini.');
        expect(originData.data).toBeNull();
    });

    // =========================================================================
    // 2. TEST KONDISI JADWAL VALID (POSITIVE TEST DARI PARAMETER)
    // =========================================================================
    test('2. Test kondisi dengan kode jadwal valid: kecocokan response Worker vs PHP Origin & validasi .agents/api.md', async () => {
        // --- 2.1 Worker Success Check (/api/jadwal/:kode) ---
        const workerTargetUrl = buildTargetUrl(WORKER_URL, `/api/jadwal/${TEST_KODE_JADWAL}?cb=${Date.now()}`);
        printLog(`\n[LANGKAH 2.1] GET -> ${workerTargetUrl}`);

        const workerRes = await sendHttpRequest(workerTargetUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${validAuthToken}` }
        });

        const workerData = await workerRes.json();
        printLog(JSON.stringify(workerData, null, 2));

        // --- 2.2 Direct PHP Origin Success Check (/api/jadwal/:kode_akses) ---
        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/jadwal/${TEST_KODE_JADWAL}?cb=${Date.now()}`);
        printLog(`\n[LANGKAH 2.2] GET -> ${originTargetUrl}`);

        const originRes = await sendHttpRequest(originTargetUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${validAuthToken}` }
        });

        const originData = await originRes.json();
        printLog(JSON.stringify(originData, null, 2));

        // --- 2.3 Cek Kecocokan Response Worker vs PHP Origin ---
        if (workerData.status === true && originData.status === true) {
            printLog('\n[VALIDASI KECOCOKAN] Memeriksa kesamaan persis response sukses antara Worker dan PHP Origin...');
            expect(workerData.status).toBe(originData.status);
            expect(workerData.code).toBe(originData.code);
            expect(workerData.message).toBe(originData.message);
            expect(workerData.data.kode_akses).toBe(originData.data.kode_akses);
            expect(workerData.data.judul).toBe(originData.data.judul);
            expect(workerData.data.tanggal).toBe(originData.data.tanggal);
            expect(workerData.data.jam_mulai).toBe(originData.data.jam_mulai);
            expect(workerData.data.jam_selesai).toBe(originData.data.jam_selesai);
        }

        // --- 2.4 Validasi Kesesuaian Terhadap Format .agents/api.md ---
        printLog('\n[VALIDASI API.MD] Memeriksa kesesuaian format output terhadap .agents/api.md...');
        if (originData.status === true) {
            expect(originData.code).toBe(200);
            expect(originData.message).toBe('Jadwal kegiatan berhasil ditemukan');
            expect(originData.data).toBeDefined();
            expect(originData.data.kode_akses).toBe(TEST_KODE_JADWAL);
        } else {
            expect(originData.status).toBe(false);
            expect([403, 404]).toContain(originData.code);
        }
    });
});
