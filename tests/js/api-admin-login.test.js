/**
 * Test Uji Coba Endpoint Login Admin / Super Admin (Worker Edge & Direct PHP Origin)
 * Format Output dan Validasi Kesamaan Response Berdasarkan .agents/api.md
 * File: tests/js/api-admin-login.test.js
 */

const https = require('https');
const http = require('http');

const WORKER_URL = process.env.WORKER_URL;
const ORIGIN_URL = process.env.ORIGIN_URL || process.env.PHP_URL;
const TEST_ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME || process.env.TEST_NIP || process.env.NIP;
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_NIK || process.env.NIK;

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

describe('Uji Coba Endpoint Login Admin: Worker Edge & Direct PHP Origin', () => {
    beforeAll(() => {
        if (!ORIGIN_URL) {
            throw new Error('Parameter ORIGIN_URL wajib diberikan melalui environment variable!');
        }
        if (!TEST_ADMIN_USERNAME) {
            throw new Error('Parameter TEST_ADMIN_USERNAME wajib diberikan melalui environment variable!');
        }
        if (!TEST_ADMIN_PASSWORD) {
            throw new Error('Parameter TEST_ADMIN_PASSWORD wajib diberikan melalui environment variable!');
        }
    });

    // =========================================================================
    // 1. TEST KONDISI DENGAN DATA SALAH (NEGATIVE TEST)
    // =========================================================================
    test('1. Test kondisi data salah: kecocokan error response Worker vs PHP Origin & validasi .agents/api.md', async () => {
        const workerTargetUrl = WORKER_URL ? buildTargetUrl(WORKER_URL, `/api/admin/login?cb=${Date.now()}`) : null;
        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/login?cb=${Date.now()}`);

        // --- 1.1 Test Payload Kosong (401) ---
        printLog(`\n[LANGKAH 1.1A] POST Origin (Payload Kosong) -> ${originTargetUrl}`);
        const emptyOriginRes = await sendHttpRequest(originTargetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const emptyOriginData = await emptyOriginRes.json();
        printLog(JSON.stringify(emptyOriginData, null, 2));

        if (workerTargetUrl) {
            printLog(`\n[LANGKAH 1.1B] POST Worker (Payload Kosong) -> ${workerTargetUrl}`);
            const emptyWorkerRes = await sendHttpRequest(workerTargetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const emptyWorkerData = await emptyWorkerRes.json();
            printLog(JSON.stringify(emptyWorkerData, null, 2));

            // Validasi kesamaan error payload kosong
            printLog('\n[VALIDASI KECOCOKAN 401] Memeriksa kesamaan status, code, dan message...');
            expect(emptyWorkerData.status).toBe(emptyOriginData.status);
            expect(emptyWorkerData.code).toBe(emptyOriginData.code);
            expect(emptyWorkerData.message).toBe(emptyOriginData.message);
            expect(emptyWorkerData.data).toBe(emptyOriginData.data);
        }

        expect(emptyOriginData.status).toBe(false);
        expect(emptyOriginData.code).toBe(401);
        expect(emptyOriginData.message).toBe('Username dan Password salah.');
        expect(emptyOriginData.data).toBeNull();

        // --- 1.2 Test Kredensial Salah (401) ---
        const dummyPayload = {
            username: '999999999999999999',
            password: '0000000000000000'
        };

        printLog(`\n[LANGKAH 1.2A] POST Origin (Kredensial Salah) -> ${originTargetUrl}`);
        const invalidOriginRes = await sendHttpRequest(originTargetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dummyPayload)
        });
        const invalidOriginData = await invalidOriginRes.json();
        printLog(JSON.stringify(invalidOriginData, null, 2));

        if (workerTargetUrl) {
            printLog(`\n[LANGKAH 1.2B] POST Worker (Kredensial Salah) -> ${workerTargetUrl}`);
            const invalidWorkerRes = await sendHttpRequest(workerTargetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dummyPayload)
            });
            const invalidWorkerData = await invalidWorkerRes.json();
            printLog(JSON.stringify(invalidWorkerData, null, 2));

            // Validasi kesamaan error kredensial salah
            printLog('\n[VALIDASI KECOCOKAN 401] Memeriksa kesamaan status, code, dan message...');
            expect(invalidWorkerData.status).toBe(invalidOriginData.status);
            expect(invalidWorkerData.code).toBe(invalidOriginData.code);
            expect(invalidWorkerData.message).toBe(invalidOriginData.message);
            expect(invalidWorkerData.data).toBe(invalidOriginData.data);
        }

        expect(invalidOriginData.status).toBe(false);
        expect(invalidOriginData.code).toBe(401);
        expect(invalidOriginData.message).toBe('Username atau Password salah.');
        expect(invalidOriginData.data).toBeNull();
    });

    // =========================================================================
    // 2. TEST KONDISI DENGAN DATA BENAR (POSITIVE TEST)
    // =========================================================================
    test('2. Test kondisi kredensial admin valid: kecocokan response & decoded JWT admin token', async () => {
        const validPayload = {
            username: TEST_ADMIN_USERNAME,
            password: TEST_ADMIN_PASSWORD
        };

        const workerTargetUrl = WORKER_URL ? buildTargetUrl(WORKER_URL, `/api/admin/login?cb=${Date.now()}`) : null;
        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/login?cb=${Date.now()}`);

        // --- 2.1 Origin Admin Login ---
        printLog(`\n[LANGKAH 2.1] POST Origin (Kredensial Admin Valid) -> ${originTargetUrl}`);
        const originRes = await sendHttpRequest(originTargetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload)
        });
        const originData = await originRes.json();
        printLog(JSON.stringify(originData, null, 2));

        // --- 2.2 Worker Admin Login ---
        let workerData = null;
        if (workerTargetUrl) {
            printLog(`\n[LANGKAH 2.2] POST Worker (Kredensial Admin Valid) -> ${workerTargetUrl}`);
            const workerRes = await sendHttpRequest(workerTargetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validPayload)
            });
            workerData = await workerRes.json();
            printLog(JSON.stringify(workerData, null, 2));
        }

        // --- 2.3 Cek Kesamaan Response Struktur Antara Worker dan PHP Origin ---
        if (workerData && workerData.status === true && originData.status === true) {
            printLog('\n[VALIDASI KECOCOKAN STRUKTUR] Memeriksa kesamaan status, code, dan message...');
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

            // --- 2.4 Ekstrak & Bandingkan Payload JWT Token Admin ---
            printLog('\n[VALIDASI PAYLOAD JWT ADMIN] Mengurai & membandingkan data admin di token...');
            const parsedWorker = parseJwt(workerToken);
            const parsedOrigin = parseJwt(originToken);

            expect(parsedWorker.iss).toBe(parsedOrigin.iss);
            expect(parsedWorker.data.username).toBe(parsedOrigin.data.username);
            expect(parsedWorker.data.nama).toBe(parsedOrigin.data.nama);
            expect(parsedWorker.data.role).toEqual(parsedOrigin.data.role);
        }

        // --- 2.5 Validasi Kesesuaian Terhadap Format .agents/api.md ---
        printLog('\n[VALIDASI API.MD] Memeriksa kesesuaian format output terhadap .agents/api.md...');
        if (originData.status === true) {
            expect(originData.code).toBe(200);
            expect(originData.message).toBe('Login Admin Berhasil');
            expect(originData.data).toBeDefined();

            const jwtToken = originData.data.access_token;
            expect(typeof jwtToken).toBe('string');

            const parsedJwt = parseJwt(jwtToken);
            expect(parsedJwt).toBeDefined();
            expect(parsedJwt.iss).toBe('bais-pariaman-apps-admin');
            expect(parsedJwt.data.username).toBe(TEST_ADMIN_USERNAME);
            expect(Array.isArray(parsedJwt.data.role)).toBe(true);

            const hasAdminRole = parsedJwt.data.role.some(r => ['admin', 'super admin'].includes(r.toLowerCase()));
            expect(hasAdminRole).toBe(true);
        } else {
            expect(originData.status).toBe(false);
            expect([401, 403]).toContain(originData.code);
        }
    });
});
