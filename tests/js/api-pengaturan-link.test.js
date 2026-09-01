/**
 * Test Uji Coba Endpoint Link Absensi Cadangan (Worker Edge & Direct PHP Origin)
 * Format Output dan Validasi Kesamaan Response Berdasarkan .agents/api.md
 * File: tests/js/api-pengaturan-link.test.js
 */

const https = require('https');
const http = require('http');

const WORKER_URL = process.env.WORKER_URL;
const ORIGIN_URL = process.env.ORIGIN_URL || process.env.PHP_URL;

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

describe('Uji Coba Endpoint Link Absensi Cadangan: Worker Edge & Direct PHP Origin', () => {
    beforeAll(() => {
        if (!WORKER_URL) {
            throw new Error('Parameter WORKER_URL wajib diberikan melalui environment variable!');
        }
        if (!ORIGIN_URL) {
            throw new Error('Parameter ORIGIN_URL wajib diberikan melalui environment variable!');
        }
    });

    // =========================================================================
    // 1. TEST KONDISI DATA BENAR: AMBIL LINK ABSENSI CADANGAN (POSITIVE TEST)
    // =========================================================================
    test('1. Test kondisi data benar: kecocokan response & data link Worker vs PHP Origin', async () => {
        // --- 1.1 Worker Get Link Absensi Cadangan ---
        const workerTargetUrl = buildTargetUrl(WORKER_URL, `/api/pengaturan/link-absensi-cadangan?cb=${Date.now()}`);
        printLog(`\n[LANGKAH 1.1] GET -> ${workerTargetUrl}`);

        const workerRes = await sendHttpRequest(workerTargetUrl, { method: 'GET' });
        const workerData = await workerRes.json();
        printLog(JSON.stringify(workerData, null, 2));

        // --- 1.2 Direct PHP Origin Get Link Absensi Cadangan ---
        const originTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/pengaturan/link-absensi-cadangan?cb=${Date.now()}`);
        printLog(`\n[LANGKAH 1.2] GET -> ${originTargetUrl}`);

        const originRes = await sendHttpRequest(originTargetUrl, { method: 'GET' });
        const originData = await originRes.json();
        printLog(JSON.stringify(originData, null, 2));

        // --- 1.3 Cek Kesamaan Response Worker vs PHP Origin ---
        if (workerData.status === true && originData.status === true) {
            printLog('\n[VALIDASI KECOCOKAN] Memeriksa kesamaan persis payload antara Worker dan PHP Origin...');
            expect(workerData.status).toBe(originData.status);
            expect(workerData.code).toBe(originData.code);
            expect(workerData.message).toBe(originData.message);
            expect(workerData.data).toEqual(originData.data);
        } else if (workerData.status === false && originData.status === false) {
            expect(workerData.status).toBe(originData.status);
            expect(workerData.code).toBe(originData.code);
            expect(workerData.message).toBe(originData.message);
        }

        // --- 1.4 Validasi Kesesuaian Terhadap Format .agents/api.md ---
        printLog('\n[VALIDASI API.MD] Memeriksa kesesuaian format output terhadap .agents/api.md...');
        if (originData.status === true) {
            expect(originData.code).toBe(200);
            expect(originData.message).toBe('Link absensi cadangan berhasil diambil.');
            expect(originData.data).toBeDefined();
            expect(typeof originData.data.link_absensi_cadangan).toBe('string');
            expect(originData.data.link_absensi_cadangan).toMatch(/^https?:\/\//);
        } else {
            expect(originData.code).toBe(404);
            expect(originData.message).toBe('Pengaturan link absensi cadangan tidak ditemukan di database.');
            expect(originData.data).toBeNull();
        }
    });

    // =========================================================================
    // 2. TEST KONDISI DATA SALAH: ENDPOINT RUTE INVALID (NEGATIVE TEST)
    // =========================================================================
    test('2. Test kondisi rute invalid: output error 404 & kecocokan Worker vs PHP Origin', async () => {
        const invalidWorkerUrl = buildTargetUrl(WORKER_URL, `/api/pengaturan/link-invalid?cb=${Date.now()}`);
        printLog(`\n[LANGKAH 2.1] GET (Path Invalid Worker) -> ${invalidWorkerUrl}`);

        const workerRes = await sendHttpRequest(invalidWorkerUrl, { method: 'GET' });
        const workerData = await workerRes.json();
        printLog(JSON.stringify(workerData, null, 2));

        const invalidOriginUrl = buildTargetUrl(ORIGIN_URL, `/api/pengaturan/link-invalid?cb=${Date.now()}`);
        printLog(`\n[LANGKAH 2.2] GET (Path Invalid Origin) -> ${invalidOriginUrl}`);

        const originRes = await sendHttpRequest(invalidOriginUrl, { method: 'GET' });
        const originData = await originRes.json();
        printLog(JSON.stringify(originData, null, 2));

        // Validasi response 404 Not Found
        expect(workerData.status).toBe(false);
        expect(workerData.code).toBe(404);
        expect(originData.status).toBe(false);
        expect(originData.code).toBe(404);
    });
});
