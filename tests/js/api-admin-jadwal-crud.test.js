/**
 * Test Uji Coba Endpoint CRUD Data Jadwal Kegiatan oleh Admin (PHP Origin Direct)
 * Sesuai Standar Logging Seksi 25 pada .agents/TESTING.md & Standar Respon PRD.md
 * File: tests/js/api-admin-jadwal-crud.test.js
 */

const https = require('https');
const http = require('http');

const ORIGIN_URL = process.env.ORIGIN_URL || process.env.PHP_URL;
const TEST_ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME || process.env.ADMIN_USER || 'admin';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || process.env.ADMIN_PASS || 'admin123';
const TEST_NIP = process.env.TEST_NIP || process.env.NIP;
const TEST_NIK = process.env.TEST_NIK || process.env.NIK;

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

describe('Uji Coba Endpoint CRUD Data Jadwal Kegiatan Admin (PHP Origin Direct)', () => {
    let adminToken = null;
    let asnToken = null;
    let createdKodeAkses = null;

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

        // 2. Login ASN (untuk verifikasi penolakan hak akses role non-admin)
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
    });

    // =========================================================================
    // 1. TEST UNAUTHENTICATED / AUTHORIZATION ERROR (401 & 403)
    // =========================================================================
    test('1. Test akses list jadwal admin tanpa token auth -> Error 401', async () => {
        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal?cb=${Date.now()}`);
        const res = await sendHttpRequest(targetUrl, { method: 'GET' });
        const resData = await res.json();

        const expectedOutput = {
            status: false,
            code: 401,
            message: 'Waktu login Anda sudah habis. Silahkan login ulang.'
        };

        const isPass = (resData.status === false && resData.code === 401 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '1 / 11',
            action: 'Akses List Jadwal Admin Tanpa Header Authorization',
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

    test('2. Test create jadwal oleh ASN (bukan admin) -> Error 403 (Hak akses ditolak)', async () => {
        if (!asnToken) {
            printLog('[SKIPPED] Test 2 dilewati karena TEST_NIP & TEST_NIK tidak disediakan.');
            return;
        }

        // Decode payload token ASN untuk cek apakah akun test memiliki role admin di DB
        let isAsnAdmin = false;
        try {
            const parts = asnToken.split('.');
            if (parts.length === 3) {
                const decodedJson = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                const roles = Array.isArray(decodedJson?.data?.role) ? decodedJson.data.role : (decodedJson?.data?.role ? [decodedJson.data.role] : []);
                isAsnAdmin = roles.some(r => ['admin', 'super admin'].includes(String(r).trim().toLowerCase()));
            }
        } catch (e) {}

        if (isAsnAdmin) {
            printLog(`\n[INFO Test 2] Akun TEST_NIP (${TEST_NIP}) memiliki role admin di database.`);
            printLog(`[INFO Test 2] Uji coba penolakan HTTP 403 dilewati karena akun pengujian ini adalah Admin/Super Admin.`);
            return;
        }

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal?cb=${Date.now()}`);
        const payload = {
            judul: 'Uji Coba Ilegal ASN',
            kategori: 'Apel Pagi',
            tanggal: '2026-09-02',
            jam_mulai: '07:30:00',
            jam_selesai: '08:30:00',
            koordinat: '-0.626411,100.124588',
            radius_meter: 100
        };

        const headers = {
            'Authorization': `Bearer ${asnToken}`,
            'Content-Type': 'application/json'
        };

        const res = await sendHttpRequest(targetUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
        const resData = await res.json();

        const expectedOutput = {
            status: false,
            code: 403,
            message: 'Hak akses ditolak.'
        };

        const isPass = (resData.status === false && resData.code === 403 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '2 / 11',
            action: 'Create Jadwal Baru oleh Pengguna dengan Token ASN (Bukan Admin)',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'POST',
            endpointUrl: targetUrl,
            payload,
            resStatus: res.status,
            resBody: resData,
            expectedOutput,
            actualOutput: resData,
            isPass
        });

        expect(resData.status).toBe(false);
        expect(resData.code).toBe(403);
        expect(resData.message).toBe('Hak akses ditolak.');
    });

    // =========================================================================
    // 2. TEST CREATE JADWAL BARU (200)
    // =========================================================================
    test('3. Test create jadwal baru oleh Admin -> Sukses (200)', async () => {
        expect(adminToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal?cb=${Date.now()}`);
        const todayYMD = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
        
        const createPayload = {
            judul: 'Uji Coba CRUD Admin Fest 2026',
            kategori: 'Apel Pagi',
            tanggal: todayYMD,
            jam_mulai: '07:30:00',
            jam_selesai: '10:00:00',
            koordinat: '-0.626411,100.124588',
            radius_meter: 100,
            aktifkan_antrian: 1,
            is_strict_time: 1,
            is_strict_location: 1,
            target_opd: ['BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA']
        };

        const headers = {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        };

        const res = await sendHttpRequest(targetUrl, { method: 'POST', headers, body: JSON.stringify(createPayload) });
        const resData = await res.json();

        // Assign kode akses jika ada di respon (mencegah cascade /null)
        if (resData && resData.data && resData.data.kode_akses) {
            createdKodeAkses = resData.data.kode_akses;
        }

        const isPass = (resData.status === true && (resData.code === 200 || resData.code === 201) && createdKodeAkses);

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'Jadwal berhasil dibuat.',
            data: { kode_akses: '(6 karakter huruf kapital)' }
        };

        logTestDetail({
            step: '3 / 11',
            action: 'Create Jadwal Baru oleh Admin Lengkap Target OPD & Strict Mode',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'POST',
            endpointUrl: targetUrl,
            payload: createPayload,
            resStatus: res.status,
            resBody: resData,
            expectedOutput,
            actualOutput: resData,
            isPass
        });

        expect(resData.status).toBe(true);
        expect(resData.code).toBe(200);
        expect(resData.message).toMatch(/^Jadwal berhasil dibuat/);
        expect(createdKodeAkses).toBeDefined();
        expect(createdKodeAkses.length).toBe(6);
    });

    // =========================================================================
    // 3. TEST READ DETAIL JADWAL (200 & 404)
    // =========================================================================
    test('4. Test get detail jadwal yang baru dibuat -> Sukses (200)', async () => {
        expect(createdKodeAkses).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal/${createdKodeAkses}?cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${adminToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'GET', headers });
        const resData = await res.json();

        const isPass = (resData.status === true && resData.code === 200 && resData.data && resData.data.kode_akses === createdKodeAkses);

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'OK',
            data: { kode_akses: createdKodeAkses, judul: 'Uji Coba CRUD Admin Fest 2026' }
        };

        logTestDetail({
            step: '4 / 11',
            action: `Get Detail Data Jadwal Kegiatan Valid (${createdKodeAkses})`,
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
        expect(resData.data.kode_akses).toBe(createdKodeAkses);
        expect(resData.data.judul).toBe('Uji Coba CRUD Admin Fest 2026');
    });

    test('5. Test get detail jadwal tidak ditemukan -> Error 404', async () => {
        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal/NONEXISTENT99?cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${adminToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'GET', headers });
        const resData = await res.json();

        const expectedOutput = {
            status: false,
            code: 404,
            message: 'Jadwal tidak ditemukan.'
        };

        const isPass = (resData.status === false && resData.code === 404 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '5 / 11',
            action: 'Get Detail Data Jadwal Kegiatan Tidak Ditemukan / Invalid',
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
        expect(resData.code).toBe(404);
        expect(resData.message).toBe('Jadwal tidak ditemukan.');
    });

    // =========================================================================
    // 4. TEST UPDATE JADWAL (200)
    // =========================================================================
    test('6. Test update jadwal oleh Admin -> Sukses (200)', async () => {
        expect(createdKodeAkses).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal/${createdKodeAkses}?cb=${Date.now()}`);
        const todayYMD = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

        const updatePayload = {
            judul: 'Uji Coba CRUD Admin Fest 2026 (REVISED)',
            kategori: 'Rapat',
            tanggal: todayYMD,
            jam_mulai: '08:00:00',
            jam_selesai: '11:00:00',
            koordinat: '-0.626411,100.124588',
            radius_meter: 150,
            aktifkan_antrian: 1,
            is_strict_time: 0,
            is_strict_location: 1,
            target_opd: ['BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA']
        };

        const headers = {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        };

        const res = await sendHttpRequest(targetUrl, { method: 'PUT', headers, body: JSON.stringify(updatePayload) });
        const resData = await res.json();

        const isPass = (resData.status === true && resData.code === 200);

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'Jadwal berhasil diperbarui.'
        };

        logTestDetail({
            step: '6 / 11',
            action: `Update Informasi Data Jadwal Kegiatan (${createdKodeAkses})`,
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
        expect(resData.message).toMatch(/^Jadwal berhasil diperbarui/);
    });

    // =========================================================================
    // 5. TEST GENERATE TOKEN QR JADWAL (200)
    // =========================================================================
    test('7. Test generate token QR jadwal -> Sukses (200)', async () => {
        expect(createdKodeAkses).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal/generate-token/${createdKodeAkses}?cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${adminToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'GET', headers });
        const resData = await res.json();

        const isPass = (resData.status === true && resData.code === 200 && resData.data && resData.data.token);

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'Token jadwal berhasil dibuat',
            data: { token: '(JWT token string)' }
        };

        logTestDetail({
            step: '7 / 11',
            action: `Generate Token QR Code Jadwal Kegiatan (${createdKodeAkses})`,
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
        expect(resData.message).toBe('Token jadwal berhasil dibuat');
        expect(resData.data.token).toBeDefined();
    });

    // =========================================================================
    // 6. TEST SYNC KV CACHE MANUAL (200)
    // =========================================================================
    test('8. Test sync KV cache jadwal manual -> Sukses (200)', async () => {
        expect(createdKodeAkses).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal/sync-kv/${createdKodeAkses}?cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${adminToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'POST', headers });
        const resData = await res.json();

        const isPass = (resData.status === true && resData.code === 200);

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'Cache berhasil disinkronkan dengan Cloudflare KV.'
        };

        logTestDetail({
            step: '8 / 11',
            action: `Manual Trigger Sinkronisasi Jadwal ke KV Cloudflare (${createdKodeAkses})`,
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
    // 7. TEST LIST & SEARCH JADWAL (200)
    // =========================================================================
    test('9. Test list & search jadwal admin -> Sukses (200)', async () => {
        expect(createdKodeAkses).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal?page=1&limit=10&search=${createdKodeAkses}&cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${adminToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'GET', headers });
        const resData = await res.json();

        const isPass = (resData.status === true && resData.code === 200 && resData.data && Array.isArray(resData.data.data));

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'OK',
            data: { data: 'Array data jadwal', pagination: 'Informasi pagination' }
        };

        logTestDetail({
            step: '9 / 11',
            action: `List Data Jadwal Admin dengan Filter Search (${createdKodeAkses})`,
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
    // 8. TEST DELETE JADWAL (200)
    // =========================================================================
    test('10. Test delete jadwal oleh Admin -> Sukses (200)', async () => {
        expect(createdKodeAkses).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal/${createdKodeAkses}?cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${adminToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'DELETE', headers });
        const resData = await res.json();

        const isPass = (resData.status === true && resData.code === 200);

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'Jadwal berhasil dihapus dari database.'
        };

        logTestDetail({
            step: '10 / 11',
            action: `Delete Data Jadwal Kegiatan (${createdKodeAkses})`,
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
        expect(resData.message).toMatch(/^Jadwal berhasil dihapus/);
    });

    test('11. Test get detail jadwal setelah dihapus -> Error 404', async () => {
        expect(createdKodeAkses).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal/${createdKodeAkses}?cb=${Date.now()}`);
        const headers = { 'Authorization': `Bearer ${adminToken}` };

        const res = await sendHttpRequest(targetUrl, { method: 'GET', headers });
        const resData = await res.json();

        const expectedOutput = {
            status: false,
            code: 404,
            message: 'Jadwal tidak ditemukan.'
        };

        const isPass = (resData.status === false && resData.code === 404 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '11 / 11',
            action: `Verifikasi Get Detail Jadwal yang Sudah Dihapus (${createdKodeAkses})`,
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
        expect(resData.code).toBe(404);
        expect(resData.message).toBe('Jadwal tidak ditemukan.');
    });
});
