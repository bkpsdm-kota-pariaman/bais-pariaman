/**
 * Test Uji Coba Endpoint CRUD Data Pegawai oleh Admin (PHP Origin Direct)
 * Sesuai Standar Logging Seksi 25 pada .agents/TESTING.md & Standar Respon PRD.md
 * File: tests/js/api-admin-pegawai-crud.test.js
 */

const https = require('https');
const http = require('http');

const ORIGIN_URL = process.env.ORIGIN_URL || process.env.PHP_URL;
const TEST_ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME || process.env.ADMIN_USER || 'admin';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || process.env.ADMIN_PASS || 'admin123';
const TEST_DUMMY_NIP = '999999999999999999';
const TEST_DUMMY_NIK = '9999999999999999';

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

describe('Uji Coba Endpoint CRUD Data Pegawai oleh Admin (PHP Origin Direct)', () => {
    let adminToken = null;

    beforeAll(async () => {
        if (!ORIGIN_URL) {
            throw new Error('Environment variable ORIGIN_URL / PHP_URL wajib disediakan!');
        }

        // Login Admin
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

        // Cleanup awal: Hapus dummy NIP jika ada dari sesi uji sebelumnya
        if (adminToken) {
            try {
                await sendHttpRequest(buildTargetUrl(ORIGIN_URL, `/api/admin/pegawai/${TEST_DUMMY_NIP}?cb=${Date.now()}`), {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${adminToken}` }
                });
            } catch (e) {}
        }
    });

    // =========================================================================
    // 1. TEST UNAUTHENTICATED (401)
    // =========================================================================
    test('1. Test akses list pegawai admin tanpa token auth -> Error 401', async () => {
        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/pegawai?cb=${Date.now()}`);
        const res = await sendHttpRequest(targetUrl, { method: 'GET' });
        const resData = await res.json();

        const expectedOutput = {
            status: false,
            code: 401,
            message: 'Waktu login Anda sudah habis. Silahkan login ulang.'
        };

        const isPass = (resData.status === false && resData.code === 401 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '1 / 10',
            action: 'Akses List Pegawai Admin Tanpa Header Authorization',
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
    // 2. TEST VALIDASI INPUT CREATE PEGAWAI (400)
    // =========================================================================
    test('2. Test create pegawai tanpa field wajib -> Error 400', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/pegawai?cb=${Date.now()}`);
        const payloadIncomplete = {
            nip: TEST_DUMMY_NIP,
            nik: TEST_DUMMY_NIK
            // nama_pegawai, perangkat_daerah, jenis_asn, role dikosongkan
        };

        const headers = {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        };

        const res = await sendHttpRequest(targetUrl, { method: 'POST', headers, body: JSON.stringify(payloadIncomplete) });
        const resData = await res.json();

        const expectedOutput = {
            status: false,
            code: 400,
            message: 'Semua field wajib diisi.'
        };

        const isPass = (resData.status === false && resData.code === 400 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '2 / 10',
            action: 'Create Pegawai dengan Field Wajib Tidak Lengkap',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'POST',
            endpointUrl: targetUrl,
            payload: payloadIncomplete,
            resStatus: res.status,
            resBody: resData,
            expectedOutput,
            actualOutput: resData,
            isPass
        });

        expect(resData.status).toBe(false);
        expect(resData.code).toBe(400);
        expect(resData.message).toBe('Semua field wajib diisi.');
    });

    // =========================================================================
    // 3. TEST CREATE PEGAWAI BARU (200)
    // =========================================================================
    test('3. Test create pegawai baru oleh Admin -> Sukses (200)', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/pegawai?cb=${Date.now()}`);
        const validPayload = {
            nip: TEST_DUMMY_NIP,
            nik: TEST_DUMMY_NIK,
            nama_pegawai: 'Pegawai Uji Coba Antigravity',
            perangkat_daerah: 'BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA',
            jabatan: 'Pranata Komputer Ahli Pertama',
            jenis_asn: 'PNS',
            role: 'asn'
        };

        const headers = {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        };

        const res = await sendHttpRequest(targetUrl, { method: 'POST', headers, body: JSON.stringify(validPayload) });
        const resData = await res.json();

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'Pegawai berhasil ditambahkan.'
        };

        const isPass = (resData.status === true && resData.code === 200 && resData.message.startsWith('Pegawai berhasil ditambahkan'));

        logTestDetail({
            step: '3 / 10',
            action: `Create Pegawai Baru Valid (NIP: ${TEST_DUMMY_NIP})`,
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
        expect(resData.message).toMatch(/^Pegawai berhasil ditambahkan/);
    });

    // =========================================================================
    // 4. TEST LIST & SEARCH PEGAWAI (200)
    // =========================================================================
    test('4. Test search pegawai yang baru dibuat -> Sukses (200)', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/pegawai?search=${TEST_DUMMY_NIP}&page=1&limit=10&cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${adminToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'GET', headers });
        const resData = await res.json();

        const isPass = (resData.status === true && resData.code === 200 && resData.data && Array.isArray(resData.data.data));

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'OK',
            data: { data: 'Array data pegawai terfilter', pagination: 'Informasi pagination' }
        };

        logTestDetail({
            step: '4 / 10',
            action: `List & Search Pegawai dengan Filter NIP (${TEST_DUMMY_NIP})`,
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
        expect(Array.isArray(resData.data.data)).toBe(true);
        expect(resData.data.pagination).toBeDefined();
    });

    // =========================================================================
    // 5. TEST PEGAWAI STATS (200)
    // =========================================================================
    test('5. Test get statistik pegawai per OPD -> Sukses (200)', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/pegawai/stats?cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${adminToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'GET', headers });
        const resData = await res.json();

        const isPass = (resData.status === true && resData.code === 200 && resData.data);

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'OK',
            data: 'Object rekapitulasi statistik pegawai per OPD'
        };

        logTestDetail({
            step: '5 / 10',
            action: 'Get Data Statistik Pegawai per OPD',
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
        expect(resData.data).toBeDefined();
    });

    // =========================================================================
    // 6. TEST UPDATE PEGAWAI (200)
    // =========================================================================
    test('6. Test update data pegawai -> Sukses (200)', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/pegawai/${TEST_DUMMY_NIP}?cb=${Date.now()}`);
        const updatePayload = {
            nama_pegawai: 'Pegawai Uji Coba Antigravity (UPDATED)',
            perangkat_daerah: 'BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA',
            jabatan: 'Pranata Komputer Ahli Muda',
            jenis_asn: 'PNS',
            role: 'asn'
        };

        const headers = {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        };

        const res = await sendHttpRequest(targetUrl, { method: 'PUT', headers, body: JSON.stringify(updatePayload) });
        const resData = await res.json();

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'Data pegawai berhasil diperbarui.'
        };

        const isPass = (resData.status === true && resData.code === 200 && resData.message.startsWith('Data pegawai berhasil diperbarui'));

        logTestDetail({
            step: '6 / 10',
            action: `Update Informasi Data Pegawai (NIP: ${TEST_DUMMY_NIP})`,
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
        expect(resData.message).toMatch(/^Data pegawai berhasil diperbarui/);
    });

    // =========================================================================
    // 7. TEST MANUAL SYNC KV CACHE PEGAWAI (200)
    // =========================================================================
    test('7. Test manual sync KV cache pegawai -> Sukses (200)', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/pegawai/sync-kv/${TEST_DUMMY_NIP}?cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${adminToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'POST', headers });
        const resData = await res.json();

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'Cache berhasil disinkronkan dengan Cloudflare KV.'
        };

        const isPass = (resData.status === true && resData.code === 200);

        logTestDetail({
            step: '7 / 10',
            action: `Manual Trigger Sinkronisasi KV Cache Pegawai (NIP: ${TEST_DUMMY_NIP})`,
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
    });

    // =========================================================================
    // 8. TEST DELETE PEGAWAI (200)
    // =========================================================================
    test('8. Test delete data pegawai -> Sukses (200)', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/pegawai/${TEST_DUMMY_NIP}?cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${adminToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'DELETE', headers });
        const resData = await res.json();

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'Pegawai berhasil dihapus.'
        };

        const isPass = (resData.status === true && resData.code === 200 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '8 / 10',
            action: `Delete Data Pegawai (NIP: ${TEST_DUMMY_NIP})`,
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
        expect(resData.message).toBe('Pegawai berhasil dihapus.');
    });

    // =========================================================================
    // 9. TEST RE-DELETE PEGAWAI TERHAPUS (404)
    // =========================================================================
    test('9. Test re-delete pegawai yang sudah dihapus -> Error 404', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/pegawai/${TEST_DUMMY_NIP}?cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${adminToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'DELETE', headers });
        const resData = await res.json();

        const expectedOutput = {
            status: false,
            code: 404,
            message: 'Pegawai tidak ditemukan atau gagal dihapus.'
        };

        const isPass = (resData.status === false && resData.code === 404 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '9 / 10',
            action: `Re-delete Pegawai yang Sudah Terhapus (NIP: ${TEST_DUMMY_NIP})`,
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

        expect(resData.status).toBe(false);
        expect(resData.code).toBe(404);
        expect(resData.message).toBe('Pegawai tidak ditemukan atau gagal dihapus.');
    });

    // =========================================================================
    // 10. TEST SYNC KV PEGAWAI TERHAPUS (404)
    // =========================================================================
    test('10. Test sync KV cache untuk pegawai yang tidak ada di DB -> Error 404', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/pegawai/sync-kv/${TEST_DUMMY_NIP}?cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${adminToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'POST', headers });
        const resData = await res.json();

        const expectedOutput = {
            status: false,
            code: 404,
            message: `Pegawai dengan NIP ${TEST_DUMMY_NIP} tidak ditemukan di database.`
        };

        const isPass = (resData.status === false && resData.code === 404 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '10 / 10',
            action: `Sync KV Cache Pegawai Tidak Ada di DB (NIP: ${TEST_DUMMY_NIP})`,
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

        expect(resData.status).toBe(false);
        expect(resData.code).toBe(404);
        expect(resData.message).toBe(`Pegawai dengan NIP ${TEST_DUMMY_NIP} tidak ditemukan di database.`);
    });
});
