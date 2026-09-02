/**
 * Test Uji Coba Endpoint Submit Absensi Kegiatan ASN (Status Kehadiran: TIDAK HADIR)
 * Status: Izin, Sakit, Dinas Luar, Cuti (Cukai)
 * Sesuai Standar Logging Seksi 25 .agents/TESTING.md & Siklus Fixture Jadwal Dinamis
 * File: tests/js/api-absen-submit-tidakhadir.test.js
 */

const https = require('https');
const http = require('http');

const WORKER_URL = process.env.WORKER_URL;
const ORIGIN_URL = process.env.ORIGIN_URL || process.env.PHP_URL;
const TEST_NIP = process.env.TEST_NIP || process.env.NIP;
const TEST_NIK = process.env.TEST_NIK || process.env.NIK;

const TEST_ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME || process.env.ADMIN_USER || 'admin';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || process.env.ADMIN_PASS || 'admin123';

/**
 * Dummy Foto Base64 Kecil (< 100 KB)
 */
const VALID_SMALL_BASE64_PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

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
        if (payloadCopy.foto_absensi && payloadCopy.foto_absensi.length > 50) {
            payloadCopy.foto_absensi = payloadCopy.foto_absensi.substring(0, 50) + `... [Total ${payloadCopy.foto_absensi.length} bytes/chars]`;
        }
        printLog(`DATA DIKIRIM  : ${JSON.stringify(payloadCopy, null, 2)}`);
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

function formatTimeOffset(offsetMinutes) {
    const d = new Date(Date.now() + offsetMinutes * 60000);
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
}

describe('Uji Coba Endpoint Submit Absensi ASN (Status Kehadiran: TIDAK HADIR)', () => {
    let asnToken = null;
    let adminToken = null;
    let dynamicKodeAkses = null;

    beforeAll(async () => {
        if (!ORIGIN_URL || !TEST_NIP || !TEST_NIK) {
            throw new Error('Environment variable ORIGIN_URL, TEST_NIP, dan TEST_NIK wajib disediakan!');
        }

        // 1. Login ASN
        const loginUrl = buildTargetUrl(ORIGIN_URL, `/api/login-asn?cb=${Date.now()}`);
        const loginRes = await sendHttpRequest(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nip: TEST_NIP, nik: TEST_NIK })
        });
        const loginData = await loginRes.json();
        if (loginData && loginData.status && loginData.data) {
            asnToken = loginData.data.access_token || loginData.data.token;
        }

        // 2. Login Admin
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

        // 3. Buat Jadwal Uji Dinamis
        if (adminToken) {
            const todayYMD = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
            const createJadwalUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal?cb=${Date.now()}`);
            const createRes = await sendHttpRequest(createJadwalUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    judul: 'Uji Coba Presensi Tidak Hadir Dinamis',
                    kategori: 'Apel Pagi',
                    tanggal: todayYMD,
                    jam_mulai: formatTimeOffset(-60),
                    jam_selesai: formatTimeOffset(120),
                    koordinat: '-0.626411,100.124588',
                    radius_meter: 50000,
                    is_strict_time: 0,
                    is_strict_location: 0,
                    aktifkan_antrian: 1
                })
            });
            const createData = await createRes.json();
            if (createData && createData.data && createData.data.kode_akses) {
                dynamicKodeAkses = createData.data.kode_akses;
            }
        }
    });

    afterAll(async () => {
        // Cleanup jadwal uji
        if (adminToken && dynamicKodeAkses) {
            try {
                await sendHttpRequest(buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal/${dynamicKodeAkses}?cb=${Date.now()}`), {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${adminToken}` }
                });
            } catch (e) {}
        }
    });

    // =========================================================================
    // 1. PENOLAKAN WORKER EDGE (403 "Data ditolak.")
    // =========================================================================
    test('1. Test penolakan Worker untuk status Tidak Hadir (Izin) -> Error 403', async () => {
        if (!WORKER_URL) {
            printLog('[SKIPPED] Test 1 dilewati karena WORKER_URL tidak diset.');
            return;
        }

        const targetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Izin',
            keterangan: 'Ada keperluan keluarga mendesak',
            foto_absensi: VALID_SMALL_BASE64_PHOTO
        };

        const res = await sendHttpRequest(targetUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${asnToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const resData = await res.json();

        const expectedOutput = {
            status: false,
            code: 403,
            message: 'Data ditolak.'
        };

        const isPass = (resData.status === false && resData.code === 403 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '1 / 5',
            action: 'Penolakan Pengiriman Tidak Hadir ke Cloudflare Worker Edge',
            serverTarget: 'CLOUDFLARE WORKER EDGE',
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
        expect(resData.message).toBe('Data ditolak.');
    });

    // =========================================================================
    // 2. PENGIRIMAN LANGSUNG KE PHP ORIGIN (IZIN, SAKIT, DINAS LUAR, CUTI)
    // =========================================================================
    test('2. Test submit status IZIN langsung ke PHP Origin -> Sukses 200', async () => {
        expect(asnToken).toBeDefined();
        expect(dynamicKodeAkses).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Izin',
            keterangan: 'Ada urusan keluarga penting',
            foto_absensi: VALID_SMALL_BASE64_PHOTO
        };

        const res = await sendHttpRequest(targetUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${asnToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const resData = await res.json();

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'Absen sudah terkirim. BKPSDM Kota Pariaman akan melakukan verifikasi absen Anda.'
        };

        const isPass = (resData.status === true && resData.code === 200 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '2 / 5',
            action: `Submit Presensi Status IZIN ke PHP Origin (${dynamicKodeAkses})`,
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

        expect(resData.status).toBe(true);
        expect(resData.code).toBe(200);
        expect(resData.message).toBe('Absen sudah terkirim. BKPSDM Kota Pariaman akan melakukan verifikasi absen Anda.');
    });

    test('3. Test submit status SAKIT langsung ke PHP Origin -> Sukses 200', async () => {
        expect(asnToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Sakit',
            keterangan: 'Demam tinggi dan istirahat dokter',
            foto_absensi: VALID_SMALL_BASE64_PHOTO
        };

        const res = await sendHttpRequest(targetUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${asnToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const resData = await res.json();

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'Absen sudah terkirim. BKPSDM Kota Pariaman akan melakukan verifikasi absen Anda.'
        };

        const isPass = (resData.status === true && resData.code === 200 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '3 / 5',
            action: `Submit Presensi Status SAKIT ke PHP Origin (${dynamicKodeAkses})`,
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

        expect(resData.status).toBe(true);
        expect(resData.code).toBe(200);
        expect(resData.message).toBe('Absen sudah terkirim. BKPSDM Kota Pariaman akan melakukan verifikasi absen Anda.');
    });

    test('4. Test submit status DINAS LUAR langsung ke PHP Origin -> Sukses 200', async () => {
        expect(asnToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Dinas Luar',
            keterangan: 'Menghadiri rapat koordinasi tingkat provinsi',
            foto_absensi: VALID_SMALL_BASE64_PHOTO
        };

        const res = await sendHttpRequest(targetUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${asnToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const resData = await res.json();

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'Absen sudah terkirim. BKPSDM Kota Pariaman akan melakukan verifikasi absen Anda.'
        };

        const isPass = (resData.status === true && resData.code === 200 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '4 / 5',
            action: `Submit Presensi Status DINAS LUAR ke PHP Origin (${dynamicKodeAkses})`,
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

        expect(resData.status).toBe(true);
        expect(resData.code).toBe(200);
        expect(resData.message).toBe('Absen sudah terkirim. BKPSDM Kota Pariaman akan melakukan verifikasi absen Anda.');
    });

    test('5. Test submit status CUTI (Cukai) langsung ke PHP Origin -> Sukses 200', async () => {
        expect(asnToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Cukai',
            keterangan: 'Cuti tahunan yang telah disetujui pimpinan',
            foto_absensi: VALID_SMALL_BASE64_PHOTO
        };

        const res = await sendHttpRequest(targetUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${asnToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const resData = await res.json();

        const expectedOutput = {
            status: true,
            code: 200,
            message: 'Absen sudah terkirim. BKPSDM Kota Pariaman akan melakukan verifikasi absen Anda.'
        };

        const isPass = (resData.status === true && resData.code === 200 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '5 / 5',
            action: `Submit Presensi Status CUTI (Cukai) ke PHP Origin (${dynamicKodeAkses})`,
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

        expect(resData.status).toBe(true);
        expect(resData.code).toBe(200);
        expect(resData.message).toBe('Absen sudah terkirim. BKPSDM Kota Pariaman akan melakukan verifikasi absen Anda.');
    });
});
