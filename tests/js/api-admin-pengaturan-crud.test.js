/**
 * Test Uji Coba Endpoint CRUD Pengaturan Aplikasi Admin (/api/admin/pengaturan)
 * Sesuai Standar Logging Seksi 25 .agents/TESTING.md & Siklus Fixture Dinamis
 * File: tests/js/api-admin-pengaturan-crud.test.js
 */

const https = require('https');
const http = require('http');

const WORKER_URL = process.env.WORKER_URL;
const ORIGIN_URL = process.env.ORIGIN_URL || process.env.PHP_URL;
const TEST_NIP = process.env.TEST_NIP || process.env.NIP;
const TEST_NIK = process.env.TEST_NIK || process.env.NIK;

const TEST_ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME || process.env.ADMIN_USER || 'admin';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || process.env.ADMIN_PASS || 'admin123';

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
    printLog(`SERVER TARGET : ${serverTarget} (${endpointUrl})`);
    printLog(`HTTP METHOD   : ${method}`);
    
    if (payload) {
        printLog(`DATA DIKIRIM  : ${JSON.stringify(payload, null, 2)}`);
    } else {
        printLog(`DATA DIKIRIM  : (Tanpa Payload / Kosong)`);
    }

    printLog(`RESPON SERVER : HTTP ${resStatus} - ${JSON.stringify(resBody, null, 2)}`);
    printLog(`OUTPUT HARAPAN: ${JSON.stringify(expectedOutput, null, 2)}`);
    printLog(`OUTPUT MUNCUL : ${JSON.stringify(actualOutput || resBody, null, 2)}`);
    printLog(`STATUS HASIL  : ${isPass ? '✅ LULUS (PASS)' : '❌ GAGAL (FAIL)'}`);
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
            // Fallback ke native https/http
        }
    }

    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(targetUrl);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        const postData = options.body || '';

        const reqHeaders = { ...(options.headers || {}) };
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
        if (postData) req.write(postData);
        req.end();
    });
}

function generateRandomSuffix() {
    return Math.random().toString(36).substring(2, 8).toLowerCase();
}

describe('Uji Coba Integration API CRUD Pengaturan Aplikasi (/api/admin/pengaturan)', () => {
    let superAdminToken = null;
    let nonSuperAdminToken = null;
    let dynamicKodePengaturan = null;

    beforeAll(async () => {
        printLog('\n=================================================================');
        printLog('PROSES SETUP FIXTURE TEST CRUD PENGATURAN APLIKASI');
        printLog('=================================================================');

        if (!ORIGIN_URL) {
            throw new Error('Environment variable ORIGIN_URL / PHP_URL wajib diatur.');
        }

        // 1. Login Super Admin
        const loginAdminUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/login?cb=${Date.now()}`);
        const adminRes = await sendHttpRequest(loginAdminUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD })
        });
        const adminData = await adminRes.json();
        superAdminToken = adminData?.data?.access_token || adminData?.data?.token;

        if (!superAdminToken) {
            throw new Error('Gagal mendapatkan token login Super Admin.');
        }

        // 2. Login Non-Super Admin (ASN Token)
        if (TEST_NIP && TEST_NIK) {
            const loginAsnUrl = buildTargetUrl(ORIGIN_URL, `/api/login?cb=${Date.now()}`);
            const asnRes = await sendHttpRequest(loginAsnUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nip: TEST_NIP, nik: TEST_NIK })
            });
            const asnData = await asnRes.json();
            nonSuperAdminToken = asnData?.data?.access_token || asnData?.data?.token;
        }

        dynamicKodePengaturan = `test_setting_${generateRandomSuffix()}`;
        printLog(`SETUP SELESAI: Super Admin Token Ready, Kode Setting Dinamis = ${dynamicKodePengaturan}`);
    }, 30000);

    afterAll(async () => {
        if (dynamicKodePengaturan && superAdminToken) {
            printLog('\n=================================================================');
            printLog(`CLEANUP FIXTURE: Menghapus Pengaturan Uji ${dynamicKodePengaturan}`);
            printLog('=================================================================');
            const deleteUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/pengaturan/${dynamicKodePengaturan}?cb=${Date.now()}`);
            await sendHttpRequest(deleteUrl, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${superAdminToken}` }
            });
        }
    });

    test('Langkah 1 s/d 7: Pengujian Lengkap Endpoint CRUD Pengaturan Aplikasi Admin', async () => {
        let stepCount = 1;

        // --- LANGKAH 1: GET LIST PENGATURAN OLEH SUPER ADMIN (200) ---
        const getListUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/pengaturan?cb=${Date.now()}`);
        const res1 = await sendHttpRequest(getListUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${superAdminToken}` }
        });
        const data1 = await res1.json();
        const isPass1 = res1.status === 200 && data1.status === true && data1.code === 200 && Array.isArray(data1?.data);
        logTestDetail({
            step: `${stepCount++} / 7`,
            action: 'Mengambil Daftar Pengaturan Aplikasi oleh Super Admin',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'GET',
            endpointUrl: getListUrl,
            payload: null,
            resStatus: res1.status,
            resBody: data1,
            expectedOutput: { status: true, code: 200, message: 'Berhasil mengambil pengaturan aplikasi.' },
            actualOutput: data1,
            isPass: isPass1
        });
        expect(isPass1).toBe(true);

        // --- LANGKAH 2: PENOLAKAN AKSES GET PENGATURAN OLEH NON-SUPER ADMIN (403) ---
        if (nonSuperAdminToken) {
            const res2 = await sendHttpRequest(getListUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${nonSuperAdminToken}` }
            });
            const data2 = await res2.json();
            const isPass2 = data2.status === false && data2.code === 403 && data2.message === 'Hak akses ditolak.';
            logTestDetail({
                step: `${stepCount++} / 7`,
                action: 'Penolakan Akses List Pengaturan oleh Non-Super Admin',
                serverTarget: 'PHP ORIGIN DIRECT',
                method: 'GET',
                endpointUrl: getListUrl,
                payload: null,
                resStatus: res2.status,
                resBody: data2,
                expectedOutput: { status: false, code: 403, message: 'Hak akses ditolak.' },
                actualOutput: data2,
                isPass: isPass2
            });
            expect(isPass2).toBe(true);
        } else {
            stepCount++;
        }

        // --- LANGKAH 3: CREATE PENGATURAN BARU DINAMIS (200) ---
        const createPayload = {
            kode_pengaturan: dynamicKodePengaturan,
            nama_pengaturan: 'Test Pengaturan Dinamis',
            nilai_pengaturan: 'https://script.google.com/macros/s/test_init/exec'
        };
        const putUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/pengaturan?cb=${Date.now()}`);
        const res3 = await sendHttpRequest(putUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${superAdminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(createPayload)
        });
        const data3 = await res3.json();
        const isPass3 = res3.status === 200 && data3.status === true && data3.code === 200;
        logTestDetail({
            step: `${stepCount++} / 7`,
            action: 'Menambah Pengaturan Aplikasi Baru Dinamis',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'PUT',
            endpointUrl: putUrl,
            payload: createPayload,
            resStatus: res3.status,
            resBody: data3,
            expectedOutput: { status: true, code: 200 },
            actualOutput: data3,
            isPass: isPass3
        });
        expect(isPass3).toBe(true);

        // --- LANGKAH 4: UPDATE PENGATURAN YANG SUDAH ADA (200) ---
        const updatePayload = {
            kode_pengaturan: dynamicKodePengaturan,
            nama_pengaturan: 'Test Pengaturan Dinamis Updated',
            nilai_pengaturan: 'https://script.google.com/macros/s/test_updated/exec'
        };
        const res4 = await sendHttpRequest(putUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${superAdminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatePayload)
        });
        const data4 = await res4.json();
        const isPass4 = res4.status === 200 && data4.status === true && data4.code === 200;
        logTestDetail({
            step: `${stepCount++} / 7`,
            action: 'Memperbarui Nilai Pengaturan Aplikasi',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'PUT',
            endpointUrl: putUrl,
            payload: updatePayload,
            resStatus: res4.status,
            resBody: data4,
            expectedOutput: { status: true, code: 200 },
            actualOutput: data4,
            isPass: isPass4
        });
        expect(isPass4).toBe(true);

        // --- LANGKAH 5: VALIDASI INPUT KOSONG (400) ---
        const invalidPayload = {
            kode_pengaturan: '',
            nama_pengaturan: 'Nama Kosong',
            nilai_pengaturan: 'Nilai'
        };
        const res5 = await sendHttpRequest(putUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${superAdminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(invalidPayload)
        });
        const data5 = await res5.json();
        const isPass5 = data5.status === false && data5.code === 400 && data5.message === 'Kode pengaturan wajib diisi.';
        logTestDetail({
            step: `${stepCount++} / 7`,
            action: 'Penolakan Update Pengaturan Tanpa Kode Pengaturan',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'PUT',
            endpointUrl: putUrl,
            payload: invalidPayload,
            resStatus: res5.status,
            resBody: data5,
            expectedOutput: { status: false, code: 400, message: 'Kode pengaturan wajib diisi.' },
            actualOutput: data5,
            isPass: isPass5
        });
        expect(isPass5).toBe(true);

        // --- LANGKAH 6: PENOLAKAN HAPUS PENGATURAN OLEH NON-SUPER ADMIN (403) ---
        const deleteTargetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/pengaturan/${dynamicKodePengaturan}?cb=${Date.now()}`);
        if (nonSuperAdminToken) {
            const res6 = await sendHttpRequest(deleteTargetUrl, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${nonSuperAdminToken}` }
            });
            const data6 = await res6.json();
            const isPass6 = data6.status === false && data6.code === 403 && data6.message === 'Hak akses ditolak.';
            logTestDetail({
                step: `${stepCount++} / 7`,
                action: 'Penolakan Hapus Pengaturan oleh Non-Super Admin',
                serverTarget: 'PHP ORIGIN DIRECT',
                method: 'DELETE',
                endpointUrl: deleteTargetUrl,
                payload: null,
                resStatus: res6.status,
                resBody: data6,
                expectedOutput: { status: false, code: 403, message: 'Hak akses ditolak.' },
                actualOutput: data6,
                isPass: isPass6
            });
            expect(isPass6).toBe(true);
        } else {
            stepCount++;
        }

        // --- LANGKAH 7: HAPUS PENGATURAN DINAMIS OLEH SUPER ADMIN (200) ---
        const res7 = await sendHttpRequest(deleteTargetUrl, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${superAdminToken}` }
        });
        const data7 = await res7.json();
        const isPass7 = res7.status === 200 && data7.status === true && data7.code === 200;
        logTestDetail({
            step: `${stepCount++} / 7`,
            action: 'Menghapus Pengaturan Aplikasi oleh Super Admin',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'DELETE',
            endpointUrl: deleteTargetUrl,
            payload: null,
            resStatus: res7.status,
            resBody: data7,
            expectedOutput: { status: true, code: 200 },
            actualOutput: data7,
            isPass: isPass7
        });
        expect(isPass7).toBe(true);
    }, 60000);
});
