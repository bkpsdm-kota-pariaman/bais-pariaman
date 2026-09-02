/**
 * Test Uji Coba Endpoint Submit Absensi Cepat Admin (/api/absen-cepat/submit)
 * Symmetrical Testing: PHP Origin Direct & Cloudflare Worker Edge
 * Sesuai Standar Logging Seksi 25 .agents/TESTING.md & Siklus Fixture Jadwal Dinamis
 * File: tests/js/api-absen-cepat.test.js
 */

const https = require('https');
const http = require('http');

const WORKER_URL = process.env.WORKER_URL;
const ORIGIN_URL = process.env.ORIGIN_URL || process.env.PHP_URL;
const TEST_NIP = process.env.TEST_NIP || process.env.NIP;
const TEST_NIK = process.env.TEST_NIK || process.env.NIK;

const TEST_ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME || process.env.ADMIN_USER || 'admin';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || process.env.ADMIN_PASS || 'admin123';

const KOORDINAT_PUSAT = '-0.626411,100.124588';

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
        const payloadCopy = { ...payload };
        if (payloadCopy.user_token && payloadCopy.user_token.length > 40) {
            payloadCopy.user_token = payloadCopy.user_token.substring(0, 40) + `... [Total ${payloadCopy.user_token.length} chars]`;
        }
        printLog(`DATA DIKIRIM  : ${JSON.stringify(payloadCopy, null, 2)}`);
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

function generateRandomKodeAkses() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

describe('Uji Coba Integration API Submit Absensi Cepat Admin (/api/absen-cepat/submit)', () => {
    let asnToken = null;
    let adminToken = null;
    let userTempTokenBp = null;
    let dynamicKodeAkses = null;

    beforeAll(async () => {
        printLog('\n=================================================================');
        printLog('PROSES DISCOVERY & SETUP FIXTURE TEST ABSENSI CEPAT ADMIN');
        printLog('=================================================================');

        if (!WORKER_URL || !ORIGIN_URL) {
            throw new Error('Environment variable WORKER_URL dan ORIGIN_URL / PHP_URL wajib diatur.');
        }

        // 1. Login ASN
        const loginAsnUrl = buildTargetUrl(WORKER_URL, `/api/login-asn?cb=${Date.now()}`);
        const asnRes = await sendHttpRequest(loginAsnUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nip: TEST_NIP, nik: TEST_NIK })
        });
        const asnData = await asnRes.json();
        asnToken = asnData?.data?.access_token || asnData?.data?.token;

        if (!asnToken) {
            throw new Error('Gagal mendapatkan token login ASN.');
        }

        // 2. Login Admin
        const loginAdminUrl = buildTargetUrl(WORKER_URL, `/api/admin/login?cb=${Date.now()}`);
        const adminRes = await sendHttpRequest(loginAdminUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD })
        });
        const adminData = await adminRes.json();
        adminToken = adminData?.data?.access_token || adminData?.data?.token;

        if (!adminToken) {
            throw new Error('Gagal mendapatkan token login Admin.');
        }

        // 3. Generate Temporary BP: Token untuk ASN
        const tempTokenUrl = buildTargetUrl(WORKER_URL, `/api/token/generate-temporary?cb=${Date.now()}`);
        const tempRes = await sendHttpRequest(tempTokenUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${asnToken}`,
                'Content-Type': 'application/json'
            }
        });
        const tempData = await tempRes.json();
        userTempTokenBp = tempData?.data?.access_token;

        if (!userTempTokenBp || !userTempTokenBp.startsWith('BP:')) {
            throw new Error(`Gagal membuat Temporary Token BP: (${JSON.stringify(tempData)})`);
        }

        // 4. Admin membuat jadwal uji dinamis
        dynamicKodeAkses = generateRandomKodeAkses();
        const createJadwalUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal?cb=${Date.now()}`);
        const jadwalPayload = {
            kode_akses: dynamicKodeAkses,
            judul: `Test Absen Cepat Admin ${dynamicKodeAkses}`,
            kategori: 'Apel',
            tanggal: getTodayString(),
            jam_mulai: '00:00',
            jam_selesai: '23:59',
            koordinat: KOORDINAT_PUSAT,
            radius_meter: 500,
            aktifkan_antrian: 1,
            is_strict_time: 0,
            is_strict_location: 0
        };

        const createRes = await sendHttpRequest(createJadwalUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(jadwalPayload)
        });

        const createData = await createRes.json();
        if (!createData.status) {
            throw new Error(`Gagal membuat jadwal uji dinamis: ${createData.message}`);
        }

        printLog(`SETUP SELESAI: Kode Akses = ${dynamicKodeAkses}, BP: Token Length = ${userTempTokenBp.length}`);
    }, 30000);

    afterAll(async () => {
        if (dynamicKodeAkses && adminToken) {
            printLog('\n=================================================================');
            printLog(`CLEANUP FIXTURE: Menghapus Jadwal Uji ${dynamicKodeAkses}`);
            printLog('=================================================================');
            const deleteJadwalUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal/${dynamicKodeAkses}?cb=${Date.now()}`);
            await sendHttpRequest(deleteJadwalUrl, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
        }
    });

    test('Langkah 1 s/d 10: Pengujian Symmetrical Endpoint Absensi Cepat Admin', async () => {
        let stepCount = 1;

        const payloadDasar = {
            user_token: userTempTokenBp,
            kode_akses: dynamicKodeAkses,
            lat: -0.626411,
            lng: 100.124588,
            lokasi: 'Kantor Walikota Pariaman',
            status_kehadiran: 'Hadir',
            status_verifikasi: 'Terverifikasi Oleh Admin',
            keterangan_verifikasi: 'Absensi Cepat oleh Admin'
        };

        // --- SKENARIO 1 & 2: SUBMIT ABSENSI CEPAT NORMAL (HADIR) ---
        // Langkah 1: PHP Origin Direct
        const originUrl1 = buildTargetUrl(ORIGIN_URL, `/api/absen-cepat/submit?cb=${Date.now()}`);
        const res1 = await sendHttpRequest(originUrl1, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadDasar)
        });
        const data1 = await res1.json();
        const isPass1 = res1.status === 200 && data1.status === true && data1.code === 200 && data1.message === 'Absensi Cepat berhasil direkam.';
        logTestDetail({
            step: `${stepCount++} / 10`,
            action: 'Submit Absensi Cepat Normal ke PHP Origin Direct',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'POST',
            endpointUrl: originUrl1,
            payload: payloadDasar,
            resStatus: res1.status,
            resBody: data1,
            expectedOutput: { status: true, code: 200, message: 'Absensi Cepat berhasil direkam.' },
            actualOutput: data1,
            isPass: isPass1
        });
        expect(isPass1).toBe(true);

        // Langkah 2: Cloudflare Worker Edge
        const workerUrl2 = buildTargetUrl(WORKER_URL, `/api/absen-cepat/submit?cb=${Date.now()}`);
        const res2 = await sendHttpRequest(workerUrl2, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadDasar)
        });
        const data2 = await res2.json();
        const isPass2 = res2.status === 200 && data2.status === true && data2.code === 200 && data2.message === 'Absensi Cepat telah diterima dan akan segera diproses.';
        logTestDetail({
            step: `${stepCount++} / 10`,
            action: 'Submit Absensi Cepat Normal ke Cloudflare Worker Edge',
            serverTarget: 'CLOUDFLARE WORKER EDGE',
            method: 'POST',
            endpointUrl: workerUrl2,
            payload: payloadDasar,
            resStatus: res2.status,
            resBody: data2,
            expectedOutput: { status: true, code: 200, message: 'Absensi Cepat telah diterima dan akan segera diproses.' },
            actualOutput: data2,
            isPass: isPass2
        });
        expect(isPass2).toBe(true);

        // --- SKENARIO 3 & 4: PENOLAKAN OTORISASI NON-ADMIN (TOKEN ASN) ---
        // Langkah 3: PHP Origin Direct (Token ASN -> 403)
        const originUrl3 = buildTargetUrl(ORIGIN_URL, `/api/absen-cepat/submit?cb=${Date.now()}`);
        const res3 = await sendHttpRequest(originUrl3, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${asnToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadDasar)
        });
        const data3 = await res3.json();
        const isPass3 = data3.status === false && data3.code === 403 && data3.message === 'Hak akses ditolak.';
        logTestDetail({
            step: `${stepCount++} / 10`,
            action: 'Penolakan Otorisasi Non-Admin ke PHP Origin Direct',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'POST',
            endpointUrl: originUrl3,
            payload: payloadDasar,
            resStatus: res3.status,
            resBody: data3,
            expectedOutput: { status: false, code: 403, message: 'Hak akses ditolak.' },
            actualOutput: data3,
            isPass: isPass3
        });
        expect(isPass3).toBe(true);

        // Langkah 4: Worker Edge (Token ASN -> 403)
        const workerUrl4 = buildTargetUrl(WORKER_URL, `/api/absen-cepat/submit?cb=${Date.now()}`);
        const res4 = await sendHttpRequest(workerUrl4, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${asnToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadDasar)
        });
        const data4 = await res4.json();
        const isPass4 = data4.status === false && data4.code === 403 && data4.message === 'Hak akses ditolak.';
        logTestDetail({
            step: `${stepCount++} / 10`,
            action: 'Penolakan Otorisasi Non-Admin ke Cloudflare Worker Edge',
            serverTarget: 'CLOUDFLARE WORKER EDGE',
            method: 'POST',
            endpointUrl: workerUrl4,
            payload: payloadDasar,
            resStatus: res4.status,
            resBody: data4,
            expectedOutput: { status: false, code: 403, message: 'Hak akses ditolak.' },
            actualOutput: data4,
            isPass: isPass4
        });
        expect(isPass4).toBe(true);

        // --- SKENARIO 5 & 6: USER TOKEN KOSONG / INVALID (401) ---
        const payloadNoToken = { ...payloadDasar, user_token: '' };

        // Langkah 5: PHP Origin Direct (User Token Kosong -> 401)
        const originUrl5 = buildTargetUrl(ORIGIN_URL, `/api/absen-cepat/submit?cb=${Date.now()}`);
        const res5 = await sendHttpRequest(originUrl5, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadNoToken)
        });
        const data5 = await res5.json();
        const isPass5 = data5.status === false && data5.code === 401 && data5.message === 'Waktu login Anda sudah habis. Silahkan login ulang.';
        logTestDetail({
            step: `${stepCount++} / 10`,
            action: 'Penolakan User Token Kosong ke PHP Origin Direct',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'POST',
            endpointUrl: originUrl5,
            payload: payloadNoToken,
            resStatus: res5.status,
            resBody: data5,
            expectedOutput: { status: false, code: 401, message: 'Waktu login Anda sudah habis. Silahkan login ulang.' },
            actualOutput: data5,
            isPass: isPass5
        });
        expect(isPass5).toBe(true);

        // Langkah 6: Worker Edge (User Token Kosong -> 401)
        const workerUrl6 = buildTargetUrl(WORKER_URL, `/api/absen-cepat/submit?cb=${Date.now()}`);
        const res6 = await sendHttpRequest(workerUrl6, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadNoToken)
        });
        const data6 = await res6.json();
        const isPass6 = data6.status === false && data6.code === 401 && data6.message === 'Waktu login Anda sudah habis. Silahkan login ulang.';
        logTestDetail({
            step: `${stepCount++} / 10`,
            action: 'Penolakan User Token Kosong ke Cloudflare Worker Edge',
            serverTarget: 'CLOUDFLARE WORKER EDGE',
            method: 'POST',
            endpointUrl: workerUrl6,
            payload: payloadNoToken,
            resStatus: res6.status,
            resBody: data6,
            expectedOutput: { status: false, code: 401, message: 'Waktu login Anda sudah habis. Silahkan login ulang.' },
            actualOutput: data6,
            isPass: isPass6
        });
        expect(isPass6).toBe(true);

        // --- SKENARIO 7 & 8: DATA TIDAK LENGKAP (KODE AKSES KOSONG) (400) ---
        const payloadNoKode = { ...payloadDasar, kode_akses: '' };

        // Langkah 7: PHP Origin Direct (Kode Akses Kosong -> 400)
        const originUrl7 = buildTargetUrl(ORIGIN_URL, `/api/absen-cepat/submit?cb=${Date.now()}`);
        const res7 = await sendHttpRequest(originUrl7, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadNoKode)
        });
        const data7 = await res7.json();
        const isPass7 = data7.status === false && data7.code === 400 && data7.message === 'Data tidak lengkap untuk Absensi Cepat.';
        logTestDetail({
            step: `${stepCount++} / 10`,
            action: 'Penolakan Data Tidak Lengkap ke PHP Origin Direct',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'POST',
            endpointUrl: originUrl7,
            payload: payloadNoKode,
            resStatus: res7.status,
            resBody: data7,
            expectedOutput: { status: false, code: 400, message: 'Data tidak lengkap untuk Absensi Cepat.' },
            actualOutput: data7,
            isPass: isPass7
        });
        expect(isPass7).toBe(true);

        // Langkah 8: Worker Edge (Kode Akses Kosong -> 400)
        const workerUrl8 = buildTargetUrl(WORKER_URL, `/api/absen-cepat/submit?cb=${Date.now()}`);
        const res8 = await sendHttpRequest(workerUrl8, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadNoKode)
        });
        const data8 = await res8.json();
        const isPass8 = data8.status === false && data8.code === 400 && data8.message === 'Jadwal kegiatan tidak ditemukan atau sudah tidak berlaku untuk hari ini.';
        logTestDetail({
            step: `${stepCount++} / 10`,
            action: 'Penolakan Kode Akses Kosong ke Cloudflare Worker Edge',
            serverTarget: 'CLOUDFLARE WORKER EDGE',
            method: 'POST',
            endpointUrl: workerUrl8,
            payload: payloadNoKode,
            resStatus: res8.status,
            resBody: data8,
            expectedOutput: { status: false, code: 400, message: 'Jadwal kegiatan tidak ditemukan atau sudah tidak berlaku untuk hari ini.' },
            actualOutput: data8,
            isPass: isPass8
        });
        expect(isPass8).toBe(true);

        // --- SKENARIO 9 & 10: USER TOKEN CORRUPTED / TAMPERED (401) ---
        const payloadBadToken = { ...payloadDasar, user_token: 'BP:BAD_CORRUPTED_CIPHERTEXT' };

        // Langkah 9: PHP Origin Direct (Bad Token -> 401)
        const originUrl9 = buildTargetUrl(ORIGIN_URL, `/api/absen-cepat/submit?cb=${Date.now()}`);
        const res9 = await sendHttpRequest(originUrl9, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadBadToken)
        });
        const data9 = await res9.json();
        const isPass9 = data9.status === false && data9.code === 401 && data9.message === 'Waktu login Anda sudah habis. Silahkan login ulang.';
        logTestDetail({
            step: `${stepCount++} / 10`,
            action: 'Penolakan Token Palsu/Corrupt ke PHP Origin Direct',
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'POST',
            endpointUrl: originUrl9,
            payload: payloadBadToken,
            resStatus: res9.status,
            resBody: data9,
            expectedOutput: { status: false, code: 401, message: 'Waktu login Anda sudah habis. Silahkan login ulang.' },
            actualOutput: data9,
            isPass: isPass9
        });
        expect(isPass9).toBe(true);

        // Langkah 10: Worker Edge (Bad Token -> 401)
        const workerUrl10 = buildTargetUrl(WORKER_URL, `/api/absen-cepat/submit?cb=${Date.now()}`);
        const res10 = await sendHttpRequest(workerUrl10, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadBadToken)
        });
        const data10 = await res10.json();
        const isPass10 = data10.status === false && data10.code === 401 && data10.message === 'Waktu login Anda sudah habis. Silahkan login ulang.';
        logTestDetail({
            step: `${stepCount++} / 10`,
            action: 'Penolakan Token Palsu/Corrupt ke Cloudflare Worker Edge',
            serverTarget: 'CLOUDFLARE WORKER EDGE',
            method: 'POST',
            endpointUrl: workerUrl10,
            payload: payloadBadToken,
            resStatus: res10.status,
            resBody: data10,
            expectedOutput: { status: false, code: 401, message: 'Waktu login Anda sudah habis. Silahkan login ulang.' },
            actualOutput: data10,
            isPass: isPass10
        });
        expect(isPass10).toBe(true);
    }, 60000);
});
