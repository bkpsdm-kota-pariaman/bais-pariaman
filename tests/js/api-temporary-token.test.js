/**
 * Test Uji Coba Endpoint Generate Temporary Token (Worker Edge & Direct PHP Origin)
 * Format Output dan Validasi Kesamaan Response Berdasarkan .agents/api.md
 * File: tests/js/api-temporary-token.test.js
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
        const cleanToken = token.startsWith('BB:') ? token.substring(3) : token;
        const base64Url = cleanToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

describe('Uji Coba Endpoint Generate Temporary Token: Worker Edge & Direct PHP Origin', () => {
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

        // Login ke PHP Origin untuk mendapatkan JWT Token awal yang sah
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
    // 1. TEST KONDISI DATA SALAH: TOKEN INVALID / TANPA HEADER (NEGATIVE TEST)
    // =========================================================================
    test('1. Test kondisi token salah / tanpa header: output error 401 & kecocokan Worker vs PHP Origin', async () => {
        // --- 1.1 Worker Request Tanpa Header Auth ---
        const workerTargetUrl = buildTargetUrl(WORKER_URL, `/api/token/generate-temporary?cb=${Date.now()}`);
        printLog(`\n[LANGKAH 1.1] POST (Tanpa Auth Header) -> ${workerTargetUrl}`);

        const workerRes = await sendHttpRequest(workerTargetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const workerData = await workerRes.json();
        printLog(JSON.stringify(workerData, null, 2));

        // --- 1.2 Direct PHP Origin Request Tanpa Header Auth ---
        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/token/generate-temporary?cb=${Date.now()}`);
        printLog(`\n[LANGKAH 1.2] POST (Tanpa Auth Header) -> ${originTargetUrl}`);

        const originRes = await sendHttpRequest(originTargetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const originData = await originRes.json();
        printLog(JSON.stringify(originData, null, 2));

        // --- 1.3 Cek Kecocokan Error Response Worker vs PHP Origin ---
        printLog('\n[VALIDASI KECOCOKAN] Memeriksa kesamaan status dan error payload...');
        expect(workerData.status).toBe(originData.status);
        expect(workerData.code).toBe(originData.code);
        expect(workerData.message).toBe(originData.message);
        expect(workerData.data).toBe(originData.data);

        // --- 1.4 Validasi Kesesuaian Terhadap Format .agents/api.md ---
        printLog('\n[VALIDASI API.MD] Memeriksa kesesuaian format error terhadap .agents/api.md...');
        expect(originData.status).toBe(false);
        expect(originData.code).toBe(401);
        expect(originData.message).toBe('Waktu login Anda sudah habis. Silahkan login ulang.');
        expect(originData.data).toBeNull();
    });

    // =========================================================================
    // 2. TEST KONDISI DATA BENAR: TOKEN VALID (POSITIVE TEST)
    // =========================================================================
    test('2. Test kondisi token valid: kecocokan response & prefix BB: token sementara antara Worker vs PHP Origin', async () => {
        expect(validAuthToken).toBeDefined();

        // --- 2.1 Worker Generate Temporary Token ---
        const workerTargetUrl = buildTargetUrl(WORKER_URL, `/api/token/generate-temporary?cb=${Date.now()}`);
        printLog(`\n[LANGKAH 2.1] POST (Token Sah) -> ${workerTargetUrl}`);

        const workerRes = await sendHttpRequest(workerTargetUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${validAuthToken}`,
                'Content-Type': 'application/json'
            }
        });

        const workerData = await workerRes.json();
        printLog(JSON.stringify(workerData, null, 2));

        // --- 2.2 Direct PHP Origin Generate Temporary Token ---
        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/token/generate-temporary?cb=${Date.now()}`);
        printLog(`\n[LANGKAH 2.2] POST (Token Sah) -> ${originTargetUrl}`);

        const originRes = await sendHttpRequest(originTargetUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${validAuthToken}`,
                'Content-Type': 'application/json'
            }
        });

        const originData = await originRes.json();
        printLog(JSON.stringify(originData, null, 2));

        // --- 2.3 Cek Kesamaan Response Struktur Antara Worker dan PHP Origin ---
        if (workerData.status === true && originData.status === true) {
            printLog('\n[VALIDASI KECOCOKAN STRUKTUR] Memeriksa kesamaan status, code, dan message...');
            expect(workerData.status).toBe(originData.status);
            expect(workerData.code).toBe(originData.code);
            expect(workerData.data.access_token).toBeDefined();
            expect(originData.data.access_token).toBeDefined();

            const workerToken = workerData.data.access_token;
            const originToken = originData.data.access_token;

            expect(typeof workerToken).toBe('string');
            expect(typeof originToken).toBe('string');
            expect(workerToken.startsWith('BB:')).toBe(true);
            expect(originToken.startsWith('BB:')).toBe(true);

            // --- 2.4 Ekstrak & Bandingkan Payload JWT Token Sementara ---
            printLog('\n[VALIDASI PAYLOAD JWT TEMPORARY] Mengurai & membandingkan data user di token sementara...');
            const parsedWorker = parseJwt(workerToken);
            const parsedOrigin = parseJwt(originToken);

            const workerUserData = parsedWorker.data || parsedWorker;
            const originUserData = parsedOrigin.data || parsedOrigin;

            expect(workerUserData.nip).toBe(originUserData.nip);
            expect(workerUserData.nama).toBe(originUserData.nama);
            expect(workerUserData.opd).toBe(originUserData.opd);
            expect(workerUserData.jabatan).toBe(originUserData.jabatan);
        }

        // --- 2.5 Validasi Kesesuaian Terhadap Format .agents/api.md ---
        printLog('\n[VALIDASI API.MD] Memeriksa kesesuaian format output sukses terhadap .agents/api.md...');
        expect(originData.status).toBe(true);
        expect(originData.code).toBe(200);
        expect(originData.message).toBe('Token sementara berhasil dibuat');
        expect(originData.data).toBeDefined();
        expect(originData.data.access_token.startsWith('BB:')).toBe(true);
    });
});
