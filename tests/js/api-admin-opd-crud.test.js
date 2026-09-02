/**
 * Test Uji Coba Endpoint CRUD Data Perangkat Daerah / OPD oleh Admin (PHP Origin Direct)
 * Sesuai Standar Logging Seksi 25 pada .agents/TESTING.md & Standar Respon PRD.md
 * File: tests/js/api-admin-opd-crud.test.js
 */

const https = require('https');
const http = require('http');

const ORIGIN_URL = process.env.ORIGIN_URL || process.env.PHP_URL;
const TEST_ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME || process.env.ADMIN_USER || 'admin';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || process.env.ADMIN_PASS || 'admin123';
const TEST_NIP = process.env.TEST_NIP || process.env.NIP;
const TEST_NIK = process.env.TEST_NIK || process.env.NIK;

const TEST_OPD_NAME = 'Dinas Penguji Antigravity 2026';
const TEST_OPD_REVISED = 'Dinas Penguji Antigravity 2026 (REVISED)';

function printLog(message) {
    process.stdout.write(message + '\n');
}

/**
 * Helper Standarisasi Logging Test Sesuai Seksi 25 .agents/TESTING.md
 */
function logTestDetail({ step, action, serverTarget, method, endpointUrl, payload, resStatus, resBody, expectedOutput, actualOutput, isPass }) {
    printLog(`\n=================================================================`);
    printLog(`LANGKAH TEST  : ${step}`);
    printLog(`NAMA AKSI     : ${action}`);
    printLog(`SERVER TARGET : ${serverTarget || 'PHP ORIGIN DIRECT'} (${endpointUrl})`);
    printLog(`HTTP METHOD   : ${method}`);
    
    if (payload) {
        printLog(`DATA DIKIRIM  : ${JSON.stringify(payload, null, 2)}`);
    } else {
        printLog(`DATA DIKIRIM  : (Tanpa Payload / Kosong)`);
    }

    printLog(`RESPON SERVER : HTTP ${resStatus} - ${JSON.stringify(resBody, null, 2)}`);
    printLog(`OUTPUT HARAPAN: ${JSON.stringify(expectedOutput, null, 2)}`);
    printLog(`OUTPUT MUNCUL : ${JSON.stringify(actualOutput || resBody, null, 2)}`);
    printLog(`STATUS TEST   : ${isPass ? '✅ LULUS (PASS)' : '❌ GAGAL (FAIL)'}`);
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

describe('Uji Coba Endpoint CRUD Data Perangkat Daerah / OPD (PHP Origin Direct)', () => {
    let adminToken = null;
    let asnToken = null;

    beforeAll(async () => {
        if (!ORIGIN_URL) {
            throw new Error('Environment variable ORIGIN_URL / PHP_URL wajib disediakan!');
        }

        // 1. Login Admin
        const adminLoginUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/login?cb=${Date.now()}`);
        const adminLoginRes = await sendHttpRequest(adminLoginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD })
        });
        const adminLoginData = await adminLoginRes.json();
        if (adminLoginData && adminLoginData.status && adminLoginData.data) {
            adminToken = adminLoginData.data.access_token || adminLoginData.data.token;
        }

        // 2. Login ASN
        if (TEST_NIP && TEST_NIK) {
            const asnLoginUrl = buildTargetUrl(ORIGIN_URL, `/api/login-asn?cb=${Date.now()}`);
            const asnLoginRes = await sendHttpRequest(asnLoginUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nip: TEST_NIP, nik: TEST_NIK })
            });
            const asnLoginData = await asnLoginRes.json();
            if (asnLoginData && asnLoginData.status && asnLoginData.data) {
                asnToken = asnLoginData.data.access_token || asnLoginData.data.token;
            }
        }

        // Cleanup awal: Hapus OPD uji coba jika ada dari sesi uji sebelumnya
        if (adminToken) {
            try {
                await sendHttpRequest(buildTargetUrl(ORIGIN_URL, `/api/admin/opd/${encodeURIComponent(TEST_OPD_NAME)}?cb=${Date.now()}`), {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${adminToken}` }
                });
                await sendHttpRequest(buildTargetUrl(ORIGIN_URL, `/api/admin/opd/${encodeURIComponent(TEST_OPD_REVISED)}?cb=${Date.now()}`), {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${adminToken}` }
                });
            } catch (e) {}
        }
    });

    // =========================================================================
    // 1. TEST UNAUTHENTICATED (401)
    // =========================================================================
    test('1. Test akses list OPD admin tanpa token auth -> Error 401', async () => {
        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/opd?cb=${Date.now()}`);
        const res = await sendHttpRequest(targetUrl, { method: 'GET' });
        const resData = await res.json();

        const expectedOutput = {
            status: false,
            code: 401,
            message: 'Waktu login Anda sudah habis. Silahkan login ulang.'
        };

        const isPass = (resData.status === false && resData.code === 401 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '1 / 9',
            action: 'Akses List OPD Admin Tanpa Header Authorization',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'GET',
            endpointUrl: targetUrl,
            payload: null,
            resStatus: res.status,
            resBody: resData,
            expectedOutput,
            actualOutput: resData,
            isPass
        });

        expect(resData.status).toBe(false);
        expect(resData.code).toBe(401);
        expect(resData.message).toBe('Waktu login Anda sudah habis. Silahkan login ulang.');
    });

    // =========================================================================
    // 2. TEST VALIDASI INPUT CREATE OPD (400)
    // =========================================================================
    test('2. Test create OPD dengan nama OPD kosong -> Error 400', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/opd?cb=${Date.now()}`);
        const emptyPayload = { nama_opd: '' };

        const headers = {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        };

        const res = await sendHttpRequest(targetUrl, { method: 'POST', headers, body: JSON.stringify(emptyPayload) });
        const resData = await res.json();

        const expectedOutput = {
            status: false,
            code: 400,
            message: 'Nama OPD wajib diisi.'
        };

        const isPass = (resData.status === false && resData.code === 400 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '2 / 9',
            action: 'Create OPD dengan Nama Kosong',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'POST',
            endpointUrl: targetUrl,
            payload: emptyPayload,
            resStatus: res.status,
            resBody: resData,
            expectedOutput,
            actualOutput: resData,
            isPass
        });

        expect(resData.status).toBe(false);
        expect(resData.code).toBe(400);
        expect(resData.message).toBe('Nama OPD wajib diisi.');
    });

    // =========================================================================
    // 3. TEST CREATE OPD BARU VALID (200)
    // =========================================================================
    test('3. Test create OPD baru oleh Admin -> Sukses (200)', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/opd?cb=${Date.now()}`);
        const validPayload = { nama_opd: TEST_OPD_NAME };

        const headers = {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        };

        const res = await sendHttpRequest(targetUrl, { method: 'POST', headers, body: JSON.stringify(validPayload) });
        const resData = await res.json();

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'OPD berhasil ditambahkan.'
        };

        const isPass = (resData.status === true && resData.code === 200 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '3 / 9',
            action: `Create OPD Baru Valid (${TEST_OPD_NAME})`,
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'POST',
            endpointUrl: targetUrl,
            payload: validPayload,
            resStatus: res.status,
            resBody: resData,
            expectedOutput,
            actualOutput: resData,
            isPass
        });

        expect(resData.status).toBe(true);
        expect(resData.code).toBe(200);
        expect(resData.message).toBe('OPD berhasil ditambahkan.');
    });

    // =========================================================================
    // 4. TEST CREATE DUPLIKAT OPD (409)
    // =========================================================================
    test('4. Test create OPD duplikat nama yang sama -> Error 409', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/opd?cb=${Date.now()}`);
        const duplicatePayload = { nama_opd: TEST_OPD_NAME };

        const headers = {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        };

        const res = await sendHttpRequest(targetUrl, { method: 'POST', headers, body: JSON.stringify(duplicatePayload) });
        const resData = await res.json();

        const expectedOutput = {
            status: false,
            code: 409,
            message: 'Nama OPD sudah ada.'
        };

        const isPass = (resData.status === false && resData.code === 409 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '4 / 9',
            action: `Create Duplikat OPD (${TEST_OPD_NAME})`,
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'POST',
            endpointUrl: targetUrl,
            payload: duplicatePayload,
            resStatus: res.status,
            resBody: resData,
            expectedOutput,
            actualOutput: resData,
            isPass
        });

        expect(resData.status).toBe(false);
        expect(resData.code).toBe(409);
        expect(resData.message).toBe('Nama OPD sudah ada.');
    });

    // =========================================================================
    // 5. TEST LIST OPD ADMIN (200)
    // =========================================================================
    test('5. Test list OPD admin (dengan format id & nama_opd) -> Sukses (200)', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/opd?cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${adminToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'GET', headers });
        const resData = await res.json();

        const isPass = (resData.status === true && resData.code === 200 && Array.isArray(resData.data) && resData.data.some(opd => opd.nama_opd === TEST_OPD_NAME));

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'OK',
            data: 'Array daftar OPD dengan field nama_opd dan id'
        };

        logTestDetail({
            step: '5 / 9',
            action: 'List Data OPD oleh Admin',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'GET',
            endpointUrl: targetUrl,
            payload: null,
            resStatus: res.status,
            resBody: resData,
            expectedOutput,
            actualOutput: resData,
            isPass
        });

        expect(resData.status).toBe(true);
        expect(resData.code).toBe(200);
        expect(Array.isArray(resData.data)).toBe(true);
        expect(resData.data.some(opd => opd.nama_opd === TEST_OPD_NAME)).toBe(true);
    });

    // =========================================================================
    // 6. TEST LIST OPD PUBLIC ASN (200)
    // =========================================================================
    test('6. Test list OPD publik (akses dengan token ASN) -> Sukses (200)', async () => {
        const authToken = asnToken || adminToken;
        expect(authToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/opd/list?cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${authToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'GET', headers });
        const resData = await res.json();

        const isPass = (resData.status === true && resData.code === 200 && Array.isArray(resData.data) && resData.data.includes(TEST_OPD_NAME));

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'List OPD berhasil diambil',
            data: 'Array string nama-nama OPD'
        };

        logTestDetail({
            step: '6 / 9',
            action: 'List OPD Publik (Client-Side ASN)',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'GET',
            endpointUrl: targetUrl,
            payload: null,
            resStatus: res.status,
            resBody: resData,
            expectedOutput,
            actualOutput: resData,
            isPass
        });

        expect(resData.status).toBe(true);
        expect(resData.code).toBe(200);
        expect(resData.message).toBe('List OPD berhasil diambil');
        expect(Array.isArray(resData.data)).toBe(true);
        expect(resData.data.includes(TEST_OPD_NAME)).toBe(true);
    });

    // =========================================================================
    // 7. TEST UPDATE OPD (200)
    // =========================================================================
    test('7. Test update nama OPD oleh Admin -> Sukses (200)', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/opd/${encodeURIComponent(TEST_OPD_NAME)}?cb=${Date.now()}`);
        const updatePayload = { nama_opd: TEST_OPD_REVISED };

        const headers = {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        };

        const res = await sendHttpRequest(targetUrl, { method: 'PUT', headers, body: JSON.stringify(updatePayload) });
        const resData = await res.json();

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'OPD berhasil diperbarui.'
        };

        const isPass = (resData.status === true && resData.code === 200 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '7 / 9',
            action: `Update Nama OPD (${TEST_OPD_NAME} -> ${TEST_OPD_REVISED})`,
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'PUT',
            endpointUrl: targetUrl,
            payload: updatePayload,
            resStatus: res.status,
            resBody: resData,
            expectedOutput,
            actualOutput: resData,
            isPass
        });

        expect(resData.status).toBe(true);
        expect(resData.code).toBe(200);
        expect(resData.message).toBe('OPD berhasil diperbarui.');
    });

    // =========================================================================
    // 8. TEST MANUAL SYNC KV CACHE OPD (200)
    // =========================================================================
    test('8. Test sync list OPD ke KV Cloudflare manual -> Sukses (200)', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/opd/sync-kv?cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${adminToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'POST', headers });
        const resData = await res.json();

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'Daftar OPD berhasil disinkronkan ke cache (KV).'
        };

        const isPass = (resData.status === true && resData.code === 200 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '8 / 9',
            action: 'Manual Trigger Sinkronisasi Daftar OPD ke Cloudflare KV',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'POST',
            endpointUrl: targetUrl,
            payload: null,
            resStatus: res.status,
            resBody: resData,
            expectedOutput,
            actualOutput: resData,
            isPass
        });

        expect(resData.status).toBe(true);
        expect(resData.code).toBe(200);
        expect(resData.message).toBe('Daftar OPD berhasil disinkronkan ke cache (KV).');
    });

    // =========================================================================
    // 9. TEST DELETE OPD (200)
    // =========================================================================
    test('9. Test delete OPD oleh Admin -> Sukses (200)', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/opd/${encodeURIComponent(TEST_OPD_REVISED)}?cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${adminToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'DELETE', headers });
        const resData = await res.json();

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'OPD berhasil dihapus.'
        };

        const isPass = (resData.status === true && resData.code === 200 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '9 / 9',
            action: `Delete OPD (${TEST_OPD_REVISED})`,
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'DELETE',
            endpointUrl: targetUrl,
            payload: null,
            resStatus: res.status,
            resBody: resData,
            expectedOutput,
            actualOutput: resData,
            isPass
        });

        expect(resData.status).toBe(true);
        expect(resData.code).toBe(200);
        expect(resData.message).toBe('OPD berhasil dihapus.');
    });
});
