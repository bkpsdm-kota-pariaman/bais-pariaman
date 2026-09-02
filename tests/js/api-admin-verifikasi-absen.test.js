/**
 * Test Uji Coba Integration API Verifikasi Presensi oleh Admin (/api/admin/verifikasi)
 * Sesuai Standar Logging Seksi 25 .agents/TESTING.md, Looping Pengiriman Berurutan & Verifikasi Berurutan dengan Auto-Retry
 * File: tests/js/api-admin-verifikasi-absen.test.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const WORKER_URL = process.env.WORKER_URL;
const ORIGIN_URL = process.env.ORIGIN_URL || process.env.PHP_URL;
const TEST_ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME || process.env.ADMIN_USER || 'admin';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || process.env.ADMIN_PASS || 'admin123';
const LIMIT_PEGAWAI = parseInt(process.env.LIMIT_PEGAWAI || '120', 10);

const VALID_SMALL_PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

// Persistent Keep-Alive HTTP Agents untuk koneksi efisien & mencegah socket timeout
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 25, timeout: 30000 });
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 25, timeout: 30000 });

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

/**
 * Native Helper untuk Membuat Payload Multipart Form-Data (Termasuk Upload File)
 */
function createMultipartPayload(fields = {}, fileFieldName = null, fileName = null, fileBuffer = null, mimeType = 'image/jpeg') {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 12);
    const parts = [];

    for (const [key, val] of Object.entries(fields)) {
        parts.push(Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`
        ));
    }

    if (fileFieldName && fileName && fileBuffer) {
        parts.push(Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${fileFieldName}"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`
        ));
        parts.push(Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer));
        parts.push(Buffer.from('\r\n'));
    }

    parts.push(Buffer.from(`--${boundary}--\r\n`));

    return {
        boundary,
        bodyBuffer: Buffer.concat(parts)
    };
}

/**
 * Native HTTP Request Helper dengan Persistent Keep-Alive & Auto-Retry
 */
async function sendHttpRequest(targetUrl, options = {}, retries = 2) {
    const parsedUrl = new URL(targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    const postData = options.body || '';

    const reqHeaders = { ...(options.headers || {}) };
    reqHeaders['Connection'] = 'keep-alive';
    if (options.method && options.method.toUpperCase() !== 'GET' && postData) {
        reqHeaders['Content-Length'] = Buffer.isBuffer(postData) ? postData.length : Buffer.byteLength(postData);
    }

    const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: options.method || 'GET',
        headers: reqHeaders,
        agent: isHttps ? httpsAgent : httpAgent,
        timeout: 30000
    };

    return new Promise((resolve, reject) => {
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
                            throw new Error(`Response bukan JSON valid (HTTP ${res.statusCode}): ${rawData}`);
                        }
                    },
                    text: async () => rawData
                });
            });
        });

        req.on('timeout', () => {
            req.destroy(new Error(`Socket connection timeout to ${parsedUrl.hostname}`));
        });

        req.on('error', async (err) => {
            if (retries > 0) {
                await delay(300);
                try {
                    const retryRes = await sendHttpRequest(targetUrl, options, retries - 1);
                    resolve(retryRes);
                } catch (retryErr) {
                    reject(retryErr);
                }
            } else {
                reject(err);
            }
        });

        if (postData) req.write(postData);
        req.end();
    });
}

function loadAsnCredentials(limit = 120) {
    const csvPath = path.resolve(__dirname, '../fixtures/credentials.csv');
    if (!fs.existsSync(csvPath)) {
        throw new Error(`File fixture credentials.csv tidak ditemukan di: ${csvPath}`);
    }

    const fileContent = fs.readFileSync(csvPath, 'utf8');
    const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');
    
    const asnList = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(';');
        if (parts.length >= 3) {
            const nip = parts[0].trim();
            const nama = parts[1].trim();
            const nik = parts[2].trim();
            const role = (parts[3] || 'asn').trim().toLowerCase();

            if (role === 'asn' && nip && nik) {
                asnList.push({ nip, nama, nik });
            }
        }
        if (asnList.length >= limit) break;
    }

    return asnList;
}

describe('Uji Coba Integration API Verifikasi Presensi oleh Admin (/api/admin/verifikasi)', () => {
    let superAdminToken = null;
    let testKodeAkses = null;
    let testAsnList = [];

    beforeAll(async () => {
        printLog('\n=================================================================');
        printLog(`PROSES SETUP FIXTURE TEST VERIFIKASI ABSENSI (LIMIT = ${LIMIT_PEGAWAI} PEGAWAI)`);
        printLog('=================================================================');

        if (!ORIGIN_URL) {
            throw new Error('Environment variable ORIGIN_URL / PHP_URL wajib diatur.');
        }

        if (!WORKER_URL) {
            throw new Error('Environment variable WORKER_URL wajib diatur untuk pengujian Worker Queue!');
        }

        // 1. Load Kredensial ASN dari File Fixture CSV
        testAsnList = loadAsnCredentials(LIMIT_PEGAWAI);
        if (testAsnList.length < 3) {
            throw new Error(`Data ASN di credentials.csv minimal 3 akun (Ditemukan: ${testAsnList.length}).`);
        }

        // 2. Login Super Admin Direct PHP Origin
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

        // 3. Login Batch Seluruh Akun ASN dengan Persistent Keep-Alive & Retry
        printLog(`Melakukan login untuk ${testAsnList.length} akun ASN...`);
        const BATCH_SIZE = 5;
        for (let i = 0; i < testAsnList.length; i += BATCH_SIZE) {
            const batch = testAsnList.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (asn) => {
                const loginAsnUrl = buildTargetUrl(ORIGIN_URL, `/api/login-asn?cb=${Date.now()}`);
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        const asnRes = await sendHttpRequest(loginAsnUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ nip: asn.nip, nik: asn.nik })
                        });
                        const asnData = await asnRes.json();
                        asn.token = asnData?.data?.access_token || asnData?.data?.token;
                        if (asn.token) break;
                    } catch (err) {
                        await delay(300);
                    }
                }
            }));
            await delay(40);
        }

        // 4. Admin Membuat Jadwal Kegiatan Uji Dinamis Direct PHP Origin
        const todayYMD = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
        const createJadwalUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/jadwal?cb=${Date.now()}`);
        const createJadwalRes = await sendHttpRequest(createJadwalUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${superAdminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                judul: `Jadwal Uji Verifikasi ${Date.now()}`,
                kategori: 'Apel Pagi',
                tanggal: todayYMD,
                jam_mulai: '00:00',
                jam_selesai: '23:59',
                koordinat: '-0.626411,100.124588',
                radius_meter: 5000,
                is_strict_time: 0,
                is_strict_location: 0,
                aktifkan_antrian: 1
            })
        });

        const jadwalResData = await createJadwalRes.json();
        testKodeAkses = jadwalResData?.data?.kode_akses || jadwalResData?.kode_akses;
        if (!testKodeAkses || !jadwalResData.status) {
            throw new Error(`Gagal membuat Jadwal Kegiatan Uji: ${jadwalResData.message || 'Kode akses tidak ditemukan di response'}`);
        }

        printLog(`SETUP SELESAI: Kode Akses = ${testKodeAkses}`);
        printLog(`- WORKER URL : ${WORKER_URL}`);
        printLog(`- ORIGIN URL : ${ORIGIN_URL}`);
        printLog(`- Total ASN Siap Uji: ${testAsnList.length} pegawai`);
    }, 90000);

    afterAll(async () => {
        // PERMINTAAN USER: Data jadwal dan presensi uji TIDAK DIHAPUS agar dapat diperiksa langsung di database/admin panel.
        printLog('\n=================================================================');
        printLog(`PRESERVE FIXTURE DATA: Jadwal Uji ${testKodeAkses} dan seluruh data presensi dipertahankan di database.`);
        printLog('=================================================================');
    });

    test('Langkah 1 & 2: Pengiriman Presensi Pegawai Berurutan (Looping) & Verifikasi Admin Berurutan', async () => {
        const submitWorkerQueueUrl = buildTargetUrl(WORKER_URL, `/api/absen/submit?cb=${Date.now()}`);
        const submitOriginUrl = buildTargetUrl(ORIGIN_URL, `/api/absen/submit?cb=${Date.now()}`);
        const verifikasiUrl = buildTargetUrl(ORIGIN_URL, `/api/admin/verifikasi?cb=${Date.now()}`);

        const antreanVerifikasi = [];
        const variasiStatusTidakHadir = ['Izin', 'Sakit', 'Cuti', 'Dinas Luar'];

        printLog(`\n=================================================================`);
        printLog(`[LANGKAH 1] PENGIRIMAN PRESENSI BERURUTAN (REAL-TIME LOG ${testAsnList.length} PEGAWAI)`);
        printLog(`=================================================================`);

        let suksesKirimCount = 0;
        let sampleSubmitLog = null;

        for (let i = 0; i < testAsnList.length; i++) {
            const asn = testAsnList[i];
            const patternIndex = i % 3;

            let targetUrl;
            let serverLabel;
            let payload;

            if (patternIndex === 0) {
                // Pola 0: Hadir Tepat Waktu & Dalam Radius -> CLOUDFLARE WORKER QUEUE
                targetUrl = submitWorkerQueueUrl;
                serverLabel = 'WORKER QUEUE';
                payload = {
                    kode_akses: testKodeAkses,
                    status_kehadiran: 'Hadir',
                    lat: '-0.626411',
                    lng: '100.124588',
                    lokasi: 'Kantor Walikota Pariaman',
                    foto_absensi: VALID_SMALL_PHOTO,
                    keterangan: 'Hadir tepat waktu'
                };
            } else if (patternIndex === 1) {
                // Pola 1: Hadir Terlambat / Di Luar Radius -> CLOUDFLARE WORKER QUEUE
                targetUrl = submitWorkerQueueUrl;
                serverLabel = 'WORKER QUEUE';
                payload = {
                    kode_akses: testKodeAkses,
                    status_kehadiran: 'Hadir',
                    lat: '-6.208763', // Luar radius
                    lng: '106.845599',
                    lokasi: 'Luar Radius Kantor (Dinas Luar)',
                    foto_absensi: VALID_SMALL_PHOTO,
                    keterangan: 'Hadir dinas luar kota'
                };
                antreanVerifikasi.push({ asn, jenis: 'Hadir Luar Radius' });
            } else {
                // Pola 2: Opsi Tidak Hadir Bervariasi -> PHP ORIGIN DIRECT
                const statusPilihan = variasiStatusTidakHadir[Math.floor(i / 3) % variasiStatusTidakHadir.length];
                targetUrl = submitOriginUrl;
                serverLabel = 'DIRECT PHP';
                payload = {
                    kode_akses: testKodeAkses,
                    status_kehadiran: statusPilihan,
                    lat: '-0.626411',
                    lng: '100.124588',
                    lokasi: 'Pariaman',
                    foto_absensi: VALID_SMALL_PHOTO,
                    keterangan: `Pengajuan ${statusPilihan} keperluan resmi`
                };
                antreanVerifikasi.push({ asn, jenis: statusPilihan });
            }

            let isSuccess = false;
            let res;
            let data;

            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    res = await sendHttpRequest(targetUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${asn.token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    data = await res.json();

                    if (res.status === 200 && data.status === true && data.code === 200) {
                        isSuccess = true;
                        break;
                    } else {
                        await delay(250);
                    }
                } catch (err) {
                    await delay(250);
                }
            }

            if (isSuccess) {
                suksesKirimCount++;
                printLog(`[KIRIM ${i + 1}/${testAsnList.length}] NIP: ${asn.nip} | ${asn.nama} | Status: ${payload.status_kehadiran} | ${serverLabel} -> HTTP ${res.status} [OK]: ${data.message || 'Sukses'}`);
            } else {
                printLog(`❌ [GAGAL KIRIM ${i + 1}/${testAsnList.length}] NIP: ${asn.nip} | ${asn.nama} | ${serverLabel} -> HTTP ${res ? res.status : 'ERR'} [FAIL]: ${JSON.stringify(data || {})}`);
            }

            sampleSubmitLog = {
                target: serverLabel,
                url: targetUrl,
                status: res ? res.status : 500,
                payloadSample: payload,
                body: data
            };

            await delay(30);
        }

        const isPass1 = suksesKirimCount === testAsnList.length;
        logTestDetail({
            step: '1 / 2',
            action: `Pengiriman Presensi Seluruh ASN secara Berurutan (${testAsnList.length} Pegawai)`,
            serverTarget: 'HYBRID (Worker Queue & PHP Origin)',
            method: 'POST',
            endpointUrl: `Worker: ${submitWorkerQueueUrl} | PHP: ${submitOriginUrl}`,
            payload: { ...sampleSubmitLog?.payloadSample, note: `Terkirim berurutan dalam loop untuk ${testAsnList.length} pegawai` },
            resStatus: sampleSubmitLog?.status || 200,
            resBody: sampleSubmitLog?.body,
            expectedOutput: { success_count: `${testAsnList.length} / ${testAsnList.length} berhasil`, status: true, code: 200 },
            actualOutput: { success_count: `${suksesKirimCount} / ${testAsnList.length} berhasil`, status: isPass1, code: sampleSubmitLog?.body?.code || 200 },
            isPass: isPass1
        });
        expect(isPass1).toBe(true);

        printLog(`\n=================================================================`);
        printLog(`[LANGKAH 2] VERIFIKASI ADMIN BERURUTAN (REAL-TIME LOG ${antreanVerifikasi.length} PEGAWAI)`);
        printLog(`=================================================================`);

        let suksesVerifCount = 0;
        let sampleVerifLog = null;
        const dummyFileBuffer = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", 'base64');

        for (let idx = 0; idx < antreanVerifikasi.length; idx++) {
            const item = antreanVerifikasi[idx];
            const targetAsn = item.asn;
            const jenisPresensi = item.jenis;

            let statusVerif = 'Terverifikasi Oleh Admin';
            let ketAdmin = `Absensi [${jenisPresensi}] ASN ${targetAsn.nama} disetujui dan diverifikasi admin.`;
            let useMultipart = false;

            if (idx === 0) {
                // Sampel Verifikasi Ditolak
                statusVerif = 'Ditolak Oleh Admin';
                ketAdmin = `Pengajuan [${jenisPresensi}] ASN ${targetAsn.nama} ditolak karena berkas tidak lengkap.`;
            } else if (idx === 1) {
                // Sampel Verifikasi Disetujui dengan Upload Bukti Dukung
                useMultipart = true;
                ketAdmin = `Disetujui admin dengan lampiran surat pendukung resmi.`;
            }

            let isVerifSuccess = false;
            let res;
            let data;
            let payloadSent;

            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    if (useMultipart) {
                        const multipartData = createMultipartPayload(
                            {
                                kode_akses: testKodeAkses,
                                nip: targetAsn.nip,
                                status_verifikasi: statusVerif,
                                status_kehadiran: 'Izin',
                                keterangan: ketAdmin
                            },
                            'bukti_dukung',
                            'surat_pendukung.jpg',
                            dummyFileBuffer,
                            'image/jpeg'
                        );
                        payloadSent = {
                            kode_akses: testKodeAkses,
                            nip: targetAsn.nip,
                            status_verifikasi: statusVerif,
                            status_kehadiran: 'Izin',
                            keterangan: ketAdmin,
                            file_bukti_dukung: 'surat_pendukung.jpg'
                        };
                        res = await sendHttpRequest(verifikasiUrl, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${superAdminToken}`,
                                'Content-Type': `multipart/form-data; boundary=${multipartData.boundary}`
                            },
                            body: multipartData.bodyBuffer
                        });
                    } else {
                        payloadSent = {
                            kode_akses: testKodeAkses,
                            nip: targetAsn.nip,
                            status_verifikasi: statusVerif,
                            keterangan: ketAdmin
                        };
                        res = await sendHttpRequest(verifikasiUrl, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${superAdminToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(payloadSent)
                        });
                    }

                    data = await res.json();
                    if (res.status === 200 && data.status === true && data.code === 200) {
                        isVerifSuccess = true;
                        break;
                    } else {
                        await delay(250);
                    }
                } catch (err) {
                    await delay(250);
                }
            }

            if (isVerifSuccess) {
                suksesVerifCount++;
                printLog(`[VERIFIKASI ${idx + 1}/${antreanVerifikasi.length}] NIP: ${targetAsn.nip} | ${targetAsn.nama} | Set: ${statusVerif} -> HTTP ${res.status} [OK]: ${data.message || 'Sukses'}`);
            } else {
                printLog(`❌ [GAGAL VERIFIKASI ${idx + 1}/${antreanVerifikasi.length}] NIP: ${targetAsn.nip} | ${targetAsn.nama} -> HTTP ${res ? res.status : 'ERR'} [FAIL]: ${JSON.stringify(data || {})}`);
            }

            sampleVerifLog = {
                status: res ? res.status : 500,
                payload: payloadSent,
                body: data
            };

            await delay(30);
        }

        const isPass2 = suksesVerifCount === antreanVerifikasi.length;
        logTestDetail({
            step: '2 / 2',
            action: `Admin Verifikasi Presensi secara Berurutan (${antreanVerifikasi.length} Pegawai)`,
            serverTarget: 'PHP ORIGIN DIRECT',
            method: 'POST',
            endpointUrl: verifikasiUrl,
            payload: { ...sampleVerifLog?.payload, note: `Diverifikasi berurutan dalam loop untuk ${antreanVerifikasi.length} pegawai` },
            resStatus: sampleVerifLog?.status || 200,
            resBody: sampleVerifLog?.body,
            expectedOutput: { success_count: `${antreanVerifikasi.length} / ${antreanVerifikasi.length} berhasil`, status: true, code: 200, message: 'Status absensi berhasil diperbarui.' },
            actualOutput: { success_count: `${suksesVerifCount} / ${antreanVerifikasi.length} berhasil diverifikasi`, status: isPass2, code: sampleVerifLog?.body?.code || 200 },
            isPass: isPass2
        });
        expect(isPass2).toBe(true);
    }, 450000);
});
