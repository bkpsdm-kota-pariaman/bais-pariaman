/**
 * Test Uji Coba Endpoint Submit Presensi Kegiatan ASN (Status Kehadiran: HADIR)
 * Symmetrical Testing: PHP Origin Direct & Cloudflare Worker Edge (18 Langkah Test)
 * Sesuai Standar Logging Seksi 25 .agents/TESTING.md & Siklus Fixture Jadwal Dinamis
 * File: tests/js/api-absen-submit-hadir.test.js
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
 * Dummy Foto Base64 Kecil (< 100 KB) - 1x1 Pixel Red Dot JPEG
 */
const VALID_SMALL_BASE64_PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

/**
 * Dummy Foto Base64 Besar (> 100 KB = 102,400 bytes)
 */
const OVERSIZE_BASE64_PHOTO = "data:image/jpeg;base64," + "A".repeat(140000);

// Koordinat Pusat Pariaman
const KOORDINAT_PUSAT = '-0.626411,100.124588';
// Koordinat Jauh (Jakarta)
const KOORDINAT_JAUH = '-6.208763,106.845599';

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

describe('Uji Coba Endpoint Submit Presensi ASN (Status Kehadiran: HADIR)', () => {
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

        // 3. Tambah Jadwal Baru Dinamis via Admin API
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
                    judul: 'Uji Coba Presensi Hadir Otomatis',
                    kategori: 'Apel Pagi',
                    tanggal: todayYMD,
                    jam_mulai: formatTimeOffset(-60),
                    jam_selesai: formatTimeOffset(120),
                    koordinat: KOORDINAT_PUSAT,
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
        // Cleanup: Hapus jadwal uji dinamis
        if (adminToken && dynamicKodeAkses) {
            try {
                await sendHttpRequest(buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal/${dynamicKodeAkses}?cb=${Date.now()}`), {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${adminToken}` }
                });
            } catch (e) {}
        }
    });

    /**
     * Helper Manipulasi Konfigurasi Jadwal Uji via Admin API
     */
    async function updateJadwalConfig(customConfig) {
        if (!adminToken || !dynamicKodeAkses) return;
        const todayYMD = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
        const updateUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal/${dynamicKodeAkses}?cb=${Date.now()}`);
        
        const payload = {
            judul: 'Uji Coba Presensi Hadir Otomatis',
            kategori: 'Apel Pagi',
            tanggal: todayYMD,
            jam_mulai: formatTimeOffset(-60),
            jam_selesai: formatTimeOffset(120),
            koordinat: KOORDINAT_PUSAT,
            radius_meter: 50000,
            is_strict_time: 0,
            is_strict_location: 0,
            aktifkan_antrian: 1,
            ...customConfig
        };

        await sendHttpRequest(updateUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
    }

    // =========================================================================
    // SKENARIO 1: SUBMIT HADIR NORMAL (LOKASI BEBAS & JADWAL BUKA)
    // =========================================================================
    test('1. Test submit presensi Hadir normal ke PHP Origin -> Sukses 200', async () => {
        expect(asnToken).toBeDefined();
        expect(dynamicKodeAkses).toBeDefined();

        await updateJadwalConfig({
            jam_mulai: formatTimeOffset(-60),
            jam_selesai: formatTimeOffset(120),
            is_strict_time: 0,
            is_strict_location: 0,
            radius_meter: 50000
        });

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: KOORDINAT_PUSAT,
            lat: -0.626411,
            lng: 100.124588,
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

        const expectedOutput = { status: true, code: 200, message: 'Absen sudah terkirim.' };
        const isPass = (resData.status === true && resData.code === 200 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '1 / 18',
            action: `Submit Presensi Hadir Normal ke PHP Origin (${dynamicKodeAkses})`,
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
        expect(resData.message).toBe('Absen sudah terkirim.');
    });

    test('2. Test submit presensi Hadir normal ke Worker Edge -> Sukses 200', async () => {
        if (!WORKER_URL) {
            printLog('[SKIPPED] Test 2 dilewati karena WORKER_URL tidak diset.');
            return;
        }

        const targetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: KOORDINAT_PUSAT,
            lat: -0.626411,
            lng: 100.124588,
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

        const expectedOutput = { status: true, code: 200, message: 'Absen sudah terkirim.' };
        const isPass = (resData.status === true && resData.code === 200 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '2 / 18',
            action: `Submit Presensi Hadir Normal ke Cloudflare Worker Edge (${dynamicKodeAkses})`,
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

        expect(resData.status).toBe(true);
        expect(resData.code).toBe(200);
        expect(resData.message).toBe('Absen sudah terkirim.');
    });

    // =========================================================================
    // SKENARIO 2: TEST WAKTU BELUM MULAI (FUTURE)
    // =========================================================================
    test('3. Test submit presensi sebelum jam mulai ke PHP Origin -> Ditolak 403', async () => {
        expect(asnToken).toBeDefined();

        await updateJadwalConfig({
            jam_mulai: formatTimeOffset(30), // Mulai 30 menit ke depan
            jam_selesai: formatTimeOffset(120),
            is_strict_time: 0
        });

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: KOORDINAT_PUSAT,
            lat: -0.626411,
            lng: 100.124588,
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

        const isPass = (resData.status === false && resData.code === 403 && /^Absensi untuk kegiatan ini belum dibuka/.test(resData.message));
        const expectedOutput = {
            status: false,
            code: 403,
            message: 'Absensi untuk kegiatan ini belum dibuka. Silakan coba lagi pada atau setelah pukul (HH:mm) WIB.'
        };

        logTestDetail({
            step: '3 / 18',
            action: 'Submit Presensi Sebelum Waktu Masuk ke PHP Origin',
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
        expect(resData.message).toMatch(/^Absensi untuk kegiatan ini belum dibuka\. Silakan coba lagi pada atau setelah pukul \d{2}:\d{2} WIB\.$/);
    });

    test('4. Test submit presensi sebelum jam mulai ke Worker Edge -> Ditolak 403', async () => {
        if (!WORKER_URL) {
            printLog('[SKIPPED] Test 4 dilewati karena WORKER_URL tidak diset.');
            return;
        }

        const targetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: KOORDINAT_PUSAT,
            lat: -0.626411,
            lng: 100.124588,
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

        const isPass = (resData.status === false && resData.code === 403 && /^Absensi untuk kegiatan ini belum dibuka/.test(resData.message));
        const expectedOutput = {
            status: false,
            code: 403,
            message: 'Absensi untuk kegiatan ini belum dibuka. Silakan coba lagi pada atau setelah pukul (HH:mm) WIB.'
        };

        logTestDetail({
            step: '4 / 18',
            action: 'Submit Presensi Sebelum Waktu Masuk ke Worker Edge',
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
        expect(resData.message).toMatch(/^Absensi untuk kegiatan ini belum dibuka\. Silakan coba lagi pada atau setelah pukul \d{2}:\d{2} WIB\.$/);
    });

    // =========================================================================
    // SKENARIO 3: TEST WAKTU SELESAI + STRICT TIME (EXPIRED)
    // =========================================================================
    test('5. Test submit presensi setelah jam selesai (is_strict_time=1) ke PHP Origin -> Ditolak 403', async () => {
        expect(asnToken).toBeDefined();

        await updateJadwalConfig({
            jam_mulai: formatTimeOffset(-120),
            jam_selesai: formatTimeOffset(-30), // Selesai 30 menit yang lalu
            is_strict_time: 1
        });

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: KOORDINAT_PUSAT,
            lat: -0.626411,
            lng: 100.124588,
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
            message: 'Gagal: Waktu Berakhir. Anda melanggar Aturan Waktu Berlaku.'
        };
        const isPass = (resData.status === false && resData.code === 403 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '5 / 18',
            action: 'Submit Presensi Melewati Batas Waktu ke PHP Origin (is_strict_time=1)',
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
        expect(resData.message).toBe('Gagal: Waktu Berakhir. Anda melanggar Aturan Waktu Berlaku.');
    });

    test('6. Test submit presensi setelah jam selesai (is_strict_time=1) ke Worker Edge -> Ditolak 403', async () => {
        if (!WORKER_URL) {
            printLog('[SKIPPED] Test 6 dilewati karena WORKER_URL tidak diset.');
            return;
        }

        const targetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: KOORDINAT_PUSAT,
            lat: -0.626411,
            lng: 100.124588,
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
            message: 'Gagal: Waktu Berakhir. Anda melanggar Aturan Waktu Berlaku.'
        };
        const isPass = (resData.status === false && resData.code === 403 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '6 / 18',
            action: 'Submit Presensi Melewati Batas Waktu ke Worker Edge (is_strict_time=1)',
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
        expect(resData.message).toBe('Gagal: Waktu Berakhir. Anda melanggar Aturan Waktu Berlaku.');
    });

    // =========================================================================
    // SKENARIO 4: TEST STRICT LOCATION (DI LUAR RADIUS)
    // =========================================================================
    test('7. Test submit presensi di luar radius (is_strict_location=1) ke PHP Origin -> Ditolak 403', async () => {
        expect(asnToken).toBeDefined();

        await updateJadwalConfig({
            jam_mulai: formatTimeOffset(-60),
            jam_selesai: formatTimeOffset(120),
            is_strict_time: 0,
            is_strict_location: 1,
            koordinat: KOORDINAT_PUSAT,
            radius_meter: 50
        });

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: KOORDINAT_JAUH,
            lat: -6.208763,
            lng: 106.845599,
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
            message: 'Gagal: Di Luar Lokasi. Anda melanggar Aturan Wajib Sesuai Lokasi.'
        };
        const isPass = (resData.status === false && resData.code === 403 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '7 / 18',
            action: 'Submit Presensi di Luar Radius ke PHP Origin (is_strict_location=1)',
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
        expect(resData.message).toBe('Gagal: Di Luar Lokasi. Anda melanggar Aturan Wajib Sesuai Lokasi.');
    });

    test('8. Test submit presensi di luar radius (is_strict_location=1) ke Worker Edge -> Ditolak 403', async () => {
        if (!WORKER_URL) {
            printLog('[SKIPPED] Test 8 dilewati karena WORKER_URL tidak diset.');
            return;
        }

        const targetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: KOORDINAT_JAUH,
            lat: -6.208763,
            lng: 106.845599,
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
            message: 'Gagal: Di Luar Lokasi. Anda melanggar Aturan Wajib Sesuai Lokasi.'
        };
        const isPass = (resData.status === false && resData.code === 403 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '8 / 18',
            action: 'Submit Presensi di Luar Radius ke Worker Edge (is_strict_location=1)',
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
        expect(resData.message).toBe('Gagal: Di Luar Lokasi. Anda melanggar Aturan Wajib Sesuai Lokasi.');
    });

    // =========================================================================
    // SKENARIO 5: TEST STRICT LOCATION (DI DALAM RADIUS)
    // =========================================================================
    test('9. Test submit presensi di dalam radius (is_strict_location=1) ke PHP Origin -> Sukses 200', async () => {
        expect(asnToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: KOORDINAT_PUSAT,
            lat: -0.626411,
            lng: 100.124588,
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

        const expectedOutput = { status: true, code: 200, message: 'Absen sudah terkirim.' };
        const isPass = (resData.status === true && resData.code === 200 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '9 / 18',
            action: 'Submit Presensi di Dalam Radius ke PHP Origin (is_strict_location=1)',
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
        expect(resData.message).toBe('Absen sudah terkirim.');
    });

    test('10. Test submit presensi di dalam radius (is_strict_location=1) ke Worker Edge -> Sukses 200', async () => {
        if (!WORKER_URL) {
            printLog('[SKIPPED] Test 10 dilewati karena WORKER_URL tidak diset.');
            return;
        }

        const targetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: KOORDINAT_PUSAT,
            lat: -0.626411,
            lng: 100.124588,
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

        const expectedOutput = { status: true, code: 200, message: 'Absen sudah terkirim.' };
        const isPass = (resData.status === true && resData.code === 200 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '10 / 18',
            action: 'Submit Presensi di Dalam Radius ke Worker Edge (is_strict_location=1)',
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

        expect(resData.status).toBe(true);
        expect(resData.code).toBe(200);
        expect(resData.message).toBe('Absen sudah terkirim.');
    });

    // =========================================================================
    // SKENARIO 6: TEST QR CODE TOKEN DYNAMIC (VALID)
    // =========================================================================
    test('11. Test submit presensi dengan QR Token Valid ke PHP Origin -> Sukses 200', async () => {
        expect(adminToken).toBeDefined();

        const qrUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal/generate-token/${dynamicKodeAkses}?cb=${Date.now()}`);
        const qrRes = await sendHttpRequest(qrUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const qrData = await qrRes.json();
        const validQrToken = qrData?.data?.token;
        expect(validQrToken).toBeDefined();

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: KOORDINAT_PUSAT,
            lat: -0.626411,
            lng: 100.124588,
            foto_absensi: VALID_SMALL_BASE64_PHOTO,
            qr_token: validQrToken
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

        const expectedOutput = { status: true, code: 200, message: 'Absen sudah terkirim.' };
        const isPass = (resData.status === true && resData.code === 200 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '11 / 18',
            action: 'Submit Presensi Membawa QR Token Valid ke PHP Origin',
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
        expect(resData.message).toBe('Absen sudah terkirim.');
    });

    test('12. Test submit presensi dengan QR Token Valid ke Worker Edge -> Sukses 200', async () => {
        if (!WORKER_URL) {
            printLog('[SKIPPED] Test 12 dilewati karena WORKER_URL tidak diset.');
            return;
        }

        const qrUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal/generate-token/${dynamicKodeAkses}?cb=${Date.now()}`);
        const qrRes = await sendHttpRequest(qrUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const qrData = await qrRes.json();
        const validQrToken = qrData?.data?.token;
        expect(validQrToken).toBeDefined();

        const targetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: KOORDINAT_PUSAT,
            lat: -0.626411,
            lng: 100.124588,
            foto_absensi: VALID_SMALL_BASE64_PHOTO,
            qr_token: validQrToken
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

        const expectedOutput = { status: true, code: 200, message: 'Absen sudah terkirim.' };
        const isPass = (resData.status === true && resData.code === 200 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '12 / 18',
            action: 'Submit Presensi Membawa QR Token Valid ke Worker Edge',
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

        expect(resData.status).toBe(true);
        expect(resData.code).toBe(200);
        expect(resData.message).toBe('Absen sudah terkirim.');
    });

    // =========================================================================
    // SKENARIO 7: TEST QR CODE TOKEN INVALID / PALSU
    // =========================================================================
    test('13. Test submit presensi dengan QR Token Invalid/Palsu ke PHP Origin -> Ditolak 401', async () => {
        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: KOORDINAT_PUSAT,
            lat: -0.626411,
            lng: 100.124588,
            foto_absensi: VALID_SMALL_BASE64_PHOTO,
            qr_token: 'INVALID_OR_TAMPERED_QR_TOKEN_STRING'
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
            code: 401,
            message: 'Token QR Code tidak valid atau sudah kedaluwarsa.'
        };
        const isPass = (resData.status === false && resData.code === 401 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '13 / 18',
            action: 'Submit Presensi dengan QR Token Invalid ke PHP Origin',
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
        expect(resData.code).toBe(401);
        expect(resData.message).toBe('Token QR Code tidak valid atau sudah kedaluwarsa.');
    });

    test('14. Test submit presensi dengan QR Token Invalid/Palsu ke Worker Edge -> Ditolak 401', async () => {
        if (!WORKER_URL) {
            printLog('[SKIPPED] Test 14 dilewati karena WORKER_URL tidak diset.');
            return;
        }

        const targetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: KOORDINAT_PUSAT,
            lat: -0.626411,
            lng: 100.124588,
            foto_absensi: VALID_SMALL_BASE64_PHOTO,
            qr_token: 'INVALID_OR_TAMPERED_QR_TOKEN_STRING'
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
            code: 401,
            message: 'Token QR Code tidak valid atau sudah kedaluwarsa.'
        };
        const isPass = (resData.status === false && resData.code === 401 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '14 / 18',
            action: 'Submit Presensi dengan QR Token Invalid ke Worker Edge',
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
        expect(resData.code).toBe(401);
        expect(resData.message).toBe('Token QR Code tidak valid atau sudah kedaluwarsa.');
    });

    // =========================================================================
    // SKENARIO 8: TEST VALIDASI GPS WAJIB UNTUK STATUS HADIR (422)
    // =========================================================================
    test('15. Test submit Hadir tanpa koordinat GPS valid ke PHP Origin -> Error 422', async () => {
        await updateJadwalConfig({
            jam_mulai: formatTimeOffset(-60),
            jam_selesai: formatTimeOffset(120),
            is_strict_time: 0,
            is_strict_location: 0,
            radius_meter: 50000
        });

        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: '',
            lat: 0,
            lng: 0,
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
            code: 422,
            message: 'Lokasi GPS wajib diisi untuk presensi Hadir.'
        };
        const isPass = (resData.status === false && resData.code === 422 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '15 / 18',
            action: 'Validasi GPS Wajib Diisi untuk Status Hadir ke PHP Origin (lat/lng = 0)',
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
        expect(resData.code).toBe(422);
        expect(resData.message).toBe('Lokasi GPS wajib diisi untuk presensi Hadir.');
    });

    test('16. Test submit Hadir tanpa koordinat GPS valid ke Worker Edge -> Error 422', async () => {
        if (!WORKER_URL) {
            printLog('[SKIPPED] Test 16 dilewati karena WORKER_URL tidak diset.');
            return;
        }

        const targetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: '',
            lat: 0,
            lng: 0,
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
            code: 422,
            message: 'Lokasi GPS wajib diisi untuk presensi Hadir.'
        };
        const isPass = (resData.status === false && resData.code === 422 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '16 / 18',
            action: 'Validasi GPS Wajib Diisi untuk Status Hadir ke Worker Edge (lat/lng = 0)',
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
        expect(resData.code).toBe(422);
        expect(resData.message).toBe('Lokasi GPS wajib diisi untuk presensi Hadir.');
    });

    // =========================================================================
    // SKENARIO 9: TEST VALIDASI UKURAN FOTO OVERSIZE (422)
    // =========================================================================
    test('17. Test submit presensi foto > 100 KB ke PHP Origin -> Error 422', async () => {
        const targetUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: KOORDINAT_PUSAT,
            lat: -0.626411,
            lng: 100.124588,
            foto_absensi: OVERSIZE_BASE64_PHOTO
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
            code: 422,
            message: 'Ukuran foto terlalu besar. Maksimal 100 KB.'
        };
        const isPass = (resData.status === false && resData.code === 422 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '17 / 18',
            action: 'Validasi Ukuran Foto Absensi > 100 KB ke PHP Origin',
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
        expect(resData.code).toBe(422);
        expect(resData.message).toBe('Ukuran foto terlalu besar. Maksimal 100 KB.');
    });

    test('18. Test submit presensi foto > 100 KB ke Worker Edge -> Error 422', async () => {
        if (!WORKER_URL) {
            printLog('[SKIPPED] Test 18 dilewati karena WORKER_URL tidak diset.');
            return;
        }

        const targetUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const payload = {
            kode_akses: dynamicKodeAkses,
            status_kehadiran: 'Hadir',
            lokasi: KOORDINAT_PUSAT,
            lat: -0.626411,
            lng: 100.124588,
            foto_absensi: OVERSIZE_BASE64_PHOTO
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
            code: 422,
            message: 'Ukuran foto terlalu besar. Maksimal 100 KB.'
        };
        const isPass = (resData.status === false && resData.code === 422 && resData.message === expectedOutput.message);

        logTestDetail({
            step: '18 / 18',
            action: 'Validasi Ukuran Foto Absensi > 100 KB ke Worker Edge',
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
        expect(resData.code).toBe(422);
        expect(resData.message).toBe('Ukuran foto terlalu besar. Maksimal 100 KB.');
    });
});
