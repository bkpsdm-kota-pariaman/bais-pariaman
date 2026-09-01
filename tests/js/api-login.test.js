/**
 * Test Uji Coba Endpoint Login: Worker Edge & Direct PHP Origin
 * Format Output dan Validasi Kesamaan Response Berdasarkan .agents/api.md
 * File: tests/js/api-login.test.js
 */

const https = require('https');
const http = require('http');

const WORKER_URL = process.env.WORKER_URL;
const ORIGIN_URL = process.env.ORIGIN_URL || process.env.PHP_URL;
const TEST_NIP = process.env.TEST_NIP || process.env.NIP;
const TEST_NIK = process.env.TEST_NIK || process.env.NIK;

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

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

describe('Uji Coba Endpoint Login: Worker Edge & Direct PHP Origin', () => {
    beforeAll(() => {
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
    });

    // =========================================================================
    // 1. TEST KONDISI DENGAN DATA SALAH (NEGATIVE TEST)
    // =========================================================================
    test('1. Test kondisi dengan data salah: kecocokan response Worker vs PHP Origin & validasi .agents/api.md', async () => {
        const dummyPayload = {
            nip: '999999999999999999',
            nik: '0000000000000000'
        };

        // --- 1.1 Worker Error Check (/api/login-asn) ---
        const workerTargetUrl = buildTargetUrl(WORKER_URL, `/api/login-asn?cb=${Date.now()}`);
        printLog(`\n[LANGKAH 1.1] POST -> ${workerTargetUrl}`);

        const workerRes = await sendHttpRequest(workerTargetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dummyPayload)
        });

        const workerData = await workerRes.json();
        printLog(JSON.stringify(workerData, null, 2));

        // --- 1.2 Direct PHP Origin Error Check (/api/login-asn) ---
        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/login-asn?cb=${Date.now()}`);
        printLog(`\n[LANGKAH 1.2] POST -> ${originTargetUrl}`);

        const originRes = await sendHttpRequest(originTargetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dummyPayload)
        });

        const originData = await originRes.json();
        printLog(JSON.stringify(originData, null, 2));

        // --- 1.3 Cek Kesamaan Response Worker vs PHP Origin ---
        printLog('\n[VALIDASI KECOCOKAN] Memeriksa kesamaan status dan error payload antara Worker dan PHP Origin...');
        expect(workerData.status).toBe(false);
        expect(originData.status).toBe(false);
        expect([404, 401]).toContain(workerData.code);
        expect(originData.code).toBe(401);
        expect(typeof workerData.message).toBe('string');
        expect(typeof originData.message).toBe('string');
        expect(workerData.data).toBeNull();
        expect(originData.data).toBeNull();
    });

    // =========================================================================
    // 2. TEST KONDISI DENGAN DATA BENAR (POSITIVE TEST)
    // =========================================================================
    test('2. Test kondisi dengan data benar: kecocokan response & payload JWT Worker vs PHP Origin', async () => {
        const validPayload = {
            nip: TEST_NIP,
            nik: TEST_NIK
        };

        // --- 2.1 Worker Success Check (/api/login-asn) ---
        const workerTargetUrl = buildTargetUrl(WORKER_URL, `/api/login-asn?cb=${Date.now()}`);
        printLog(`\n[LANGKAH 2.1] POST -> ${workerTargetUrl}`);

        const workerRes = await sendHttpRequest(workerTargetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload)
        });

        const workerData = await workerRes.json();
        printLog(JSON.stringify(workerData, null, 2));

        // --- 2.2 Direct PHP Origin Success Check (/api/login-asn) ---
        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/login-asn?cb=${Date.now()}`);
        printLog(`\n[LANGKAH 2.2] POST -> ${originTargetUrl}`);

        const originRes = await sendHttpRequest(originTargetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload)
        });

        const originData = await originRes.json();
        printLog(JSON.stringify(originData, null, 2));

        // --- 2.3 Cek Kesamaan Response Struktur (Kecuali Nilai Access Token) ---
        if (workerData.status === true && originData.status === true) {
            printLog('\n[VALIDASI KECOCOKAN STRUKTUR] Memeriksa kesamaan status, code, dan message antara Worker dan PHP Origin...');
            expect(workerData.status).toBe(originData.status);
            expect(workerData.code).toBe(originData.code);
            expect(workerData.message).toBe(originData.message);
            expect(workerData.data).toBeDefined();
            expect(originData.data).toBeDefined();

            expect(workerData.data.access_token).toBeDefined();
            expect(originData.data.access_token).toBeDefined();

            const workerToken = workerData.data.access_token;
            const originToken = originData.data.access_token;
            expect(typeof workerToken).toBe('string');
            expect(typeof originToken).toBe('string');

            // --- 2.4 Ekstrak & Bandingkan Payload JWT Token antara Worker & PHP Origin ---
            printLog('\n[VALIDASI PAYLOAD JWT] Mengurai & membandingkan payload data user di dalam JWT Token...');
            const parsedWorker = parseJwt(workerToken);
            const parsedOrigin = parseJwt(originToken);

            expect(parsedWorker).toBeDefined();
            expect(parsedOrigin).toBeDefined();
            expect(parsedWorker.nip).toBe(parsedOrigin.nip);
            expect(parsedWorker.nama).toBe(parsedOrigin.nama);
            expect(parsedWorker.opd).toBe(parsedOrigin.opd);
            expect(parsedWorker.jabatan).toBe(parsedOrigin.jabatan);
            expect(parsedWorker.role).toBe(parsedOrigin.role);
            expect(parsedWorker.is_temporary).toBe(parsedOrigin.is_temporary);
        }

        // --- 2.5 Validasi Kesesuaian Terhadap Format .agents/api.md ---
        printLog('\n[VALIDASI API.MD] Memeriksa kesesuaian format output terhadap .agents/api.md...');
        expect(originData).toBeDefined();
        expect(originData.status).toBe(true);
        expect(originData.code).toBe(200);
        expect(originData.message).toBe('Login Berhasil');
        expect(originData.data).toBeDefined();
        expect(typeof originData.data.access_token).toBe('string');
    });
});
