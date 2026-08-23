/**
 * Cloudflare Worker untuk Antrian (Queue) dan Cache Login ASN
 *
 * Worker ini memiliki beberapa fungsi utama:
 * 1. Login Handler (dengan KV Cache): Mencegat request login. Jika data ada di cache (Cache HIT),
 *    langsung memberikan token JWT. Jika tidak ada (Cache MISS), worker akan mengembalikan
 *    error 404 agar PWA bisa mencoba login ke server utama (fallback).
 * 2. Cache Invalidation Handler: Menerima sinyal dari server PHP untuk menghapus cache pegawai di KV.
 * 3. Absen Submit Handler (Producer): Menerima request absensi dari PWA, memasukkannya ke
 *    dalam antrian (Queue), dan memberikan respon sukses ke pengguna.
 * 4. Queue Handler (Consumer): Mengambil data dari antrian dan mengirimkannya ke server PHP.
 *
 * Pastikan Anda sudah mengatur route di Cloudflare Dashboard agar request ke
 * /api/absen/submit diarahkan ke Worker ini.
 */

import { jwtVerify, SignJWT } from 'jose';
import bcrypt from 'bcryptjs';

// Definisikan header CORS di satu tempat agar mudah dikelola.
// Ini mengizinkan semua origin ('*'), yang cukup untuk pengembangan.
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

const ALLOWED_ISSUERS = ['bais-pariaman-apps', 'bais-balad-apps', 'bais-pariaman-apps-admin', 'bais-pariaman-apps-jadwal'];
const DEFAULT_ISSUER = 'bais-pariaman-apps';

// Helper untuk mengubah data URI (base64) menjadi Blob, agar bisa dikirim sebagai file.
function dataURItoBlob(dataURI) {
	const byteString = atob(dataURI.split(',')[1]);
	const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
	const ab = new ArrayBuffer(byteString.length);
	const ia = new Uint8Array(ab);
	for (let i = 0; i < byteString.length; i++) {
		ia[i] = byteString.charCodeAt(i);
	}
	return new Blob([ab], { type: mimeString });
}

function haversineDistance(lat1, lon1, lat2, lon2) {
	if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
	const R = 6371e3; // metres
	const p1 = lat1 * Math.PI / 180;
	const p2 = lat2 * Math.PI / 180;
	const dp = (lat2 - lat1) * Math.PI / 180;
	const dl = (lon2 - lon1) * Math.PI / 180;

	const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
		Math.cos(p1) * Math.cos(p2) *
		Math.sin(dl / 2) * Math.sin(dl / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c; // in metres
}

// Helper untuk format JSON Response terstandarisasi dengan status header 200 (kecuali server error >= 500)
function jsonResponse(success, statusCode, message, data = null, customHeaders = {}) {
	const isServerError = statusCode >= 500;
	const httpStatus = isServerError ? statusCode : 200;
	const body = {
		status: success,
		code: statusCode,
		message: message,
		...(data !== null && { data })
	};
	return new Response(JSON.stringify(body), {
		status: httpStatus,
		headers: {
			'Content-Type': 'application/json',
			...corsHeaders,
			...customHeaders
		}
	});
}

export default {
	/**
	 * Fetch handler: Berperan sebagai PRODUCER untuk queue.
	 * Menerima request absensi awal dari perangkat pengguna.
	 * @param {Request} request
	 * @param {object} env
	 * @param {ExecutionContext} ctx
	 * @returns {Response}
	 */
	async fetch(request, env, ctx) {
		// --- PENANGANAN CORS PREFLIGHT REQUEST (Berlaku untuk semua rute) ---
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: corsHeaders,
			});
		}

		const url = new URL(request.url);
		const pathname = url.pathname;

		// Helper validasi jadwal
		const validateJadwalAbsen = async (kodeAkses, payload) => {
			if (!kodeAkses || !env.JADWAL_KV) return null;
			const cachedJadwal = await env.JADWAL_KV.get(`jadwal:${kodeAkses}`, 'json');
			if (!cachedJadwal) return null;

			const now = new Date();
			const todayYMD = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
			if (cachedJadwal.tanggal !== todayYMD) {
				return { error: true, code: 403, message: "Gagal: Jadwal ini tidak berlaku untuk hari ini." };
			}

			const startTime = new Date(`${cachedJadwal.tanggal}T${cachedJadwal.jam_mulai}+07:00`);
			if (now < startTime) {
				return { error: true, code: 403, message: `Gagal: Absensi belum dibuka. Silakan tunggu hingga pukul ${cachedJadwal.jam_mulai} WIB.` };
			}

			const status = (payload.status_kehadiran || "hadir").toLowerCase();
			let isTerlambat = false;
			let isLuarRadius = false;

			const endTime = new Date(`${cachedJadwal.tanggal}T${cachedJadwal.jam_selesai}+07:00`);
			if (now > endTime) {
				isTerlambat = true;
			}

			if (cachedJadwal.koordinat && cachedJadwal.koordinat !== "-") {
				const parts = cachedJadwal.koordinat.replace(/'/g, '').split(',');
				if (parts.length === 2) {
					const tLat = parseFloat(parts[0]);
					const tLng = parseFloat(parts[1]);
					const pLat = parseFloat(payload.lat);
					const pLng = parseFloat(payload.lng);
					const radius = parseFloat(cachedJadwal.radius_meter) || 0;

					const jarak = haversineDistance(pLat, pLng, tLat, tLng);
					if (jarak > radius) {
						isLuarRadius = true;
					}
				}
			}

			// Jika pegawai mencoba Hadir murni (bukan Izin/Sakit/Cuti)
			if (status === "hadir") {
				// Validasi Strict Time
				if (cachedJadwal.is_strict_time && cachedJadwal.is_strict_time == 1 && isTerlambat) {
					return { error: true, code: 403, message: "Gagal: Waktu Berakhir. Anda hanya bisa mengirim Izin/Keterangan karena Aturan Waktu Berlaku aktif." };
				}

				// Validasi Strict Location
				if (cachedJadwal.is_strict_location && cachedJadwal.is_strict_location == 1 && isLuarRadius) {
					return { error: true, code: 403, message: `Gagal: Anda di luar lokasi. Anda hanya bisa mengirim Izin/Keterangan karena Aturan Wajib Sesuai Lokasi aktif.` };
				}
			}

			const pLat = parseFloat(payload.lat);
			const pLng = parseFloat(payload.lng);
			const isGpsError = (isNaN(pLat) || isNaN(pLng) || pLat === 0 || pLng === 0 || (payload.lokasi && payload.lokasi.toLowerCase().includes('gps')));

			// Jika pegawai terlambat, di luar lokasi, GPS error, atau tidak hadir (izin dll)
			if (status !== "hadir" || isTerlambat || isLuarRadius || isGpsError) {
				if (payload.status_verifikasi !== "Terverifikasi Oleh Admin") {
					payload.status_verifikasi = "Menunggu Verifikasi Admin";
				}
			}

			return null;
		};

		// =================================================================
		// RUTE LOGIN ASN (DENGAN KV CACHE)
		// =================================================================
		if (pathname.endsWith('/api/login-asn')) {

			if (request.method !== 'POST') {
				return jsonResponse(false, 405, 'Metode request yang diharapkan adalah POST');
			}

			// Validasi environment variables yang dibutuhkan untuk rute ini
			if (!env.PEGAWAI_KV || !env.JWT_SECRET || !env.ORIGIN_API_URL || !env.WORKER_SECRET) {
				console.error("Konfigurasi worker tidak lengkap. 'PEGAWAI_KV', 'JWT_SECRET', 'ORIGIN_API_URL', 'WORKER_SECRET' harus diatur.");
				return jsonResponse(false, 500, 'Konfigurasi server worker tidak lengkap.');
			}

			try {
				// Clone request SEBELUM membaca body. Ini penting untuk menghindari error "stream disturbed".
				const requestClone = request.clone();
				const { nip, nik } = await request.json(); // Body dibaca di sini.
				if (!nip || !nik) {
					return jsonResponse(false, 400, 'NIP dan NIK wajib diisi');
				}

				const kvKey = `pegawai:${nip}`;
				const cachedPegawai = await env.PEGAWAI_KV.get(kvKey, 'json');

				// --- CACHE HIT ---
				if (cachedPegawai) {
					// Pengecekan bcrypt NIK secara sinkron (karena bcryptjs mendukung di edge)
					if (bcrypt.compareSync(nik, cachedPegawai.nik)) {
						console.log(`[Login Cache] Cache HIT for NIP: ${nip}`);
						const secret = new TextEncoder().encode(env.JWT_SECRET);
						const issuedAt = Math.floor(Date.now() / 1000);
						const expirationTime = issuedAt + 3600 * 24 * 30; // 30 hari

						const payload = {
							data: {
								nip: cachedPegawai.nip,
								nama: cachedPegawai.nama_pegawai,
								opd: cachedPegawai.perangkat_daerah,
								jabatan: cachedPegawai.jabatan,
								role: cachedPegawai.role || ['asn'],
								jenis_asn: cachedPegawai.jenis_asn
							},
						};

						const jwtToken = await new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt(issuedAt).setExpirationTime(expirationTime).setIssuer(DEFAULT_ISSUER).sign(secret);

						const responseData = { token: jwtToken, user: { nama: cachedPegawai.nama_pegawai, jabatan: cachedPegawai.jabatan, opd: cachedPegawai.perangkat_daerah } };

						return jsonResponse(true, 200, 'Login Berhasil (dari Cache)', responseData);
					} else {
						// NIK tidak cocok. Jangan hapus cache, cukup perlakukan sebagai cache miss.
						console.log(`[Login Cache] NIK mismatch for NIP: ${nip}. Treating as Cache MISS.`);
						// Tidak ada 'delete' di sini. Biarkan PWA melakukan fallback ke server utama.
						// Lanjutkan ke logika CACHE MISS di bawah.
					}
				}

				// --- CACHE MISS atau NIK mismatch setelah cache invalidation ---
				console.log(`[Login Cache] Cache MISS or NIK mismatch for NIP: ${nip}. Returning 404 to PWA.`);
				// Explicitly return 404 to signal PWA to try origin
				return jsonResponse(false, 404, 'Data login tidak ditemukan di cache. Mencoba ke server utama.');

			} catch (error) {
				// Log error yang lebih detail untuk debugging di dashboard Cloudflare
				console.error('Error di login handler worker:', error.message, error.stack);
				return jsonResponse(false, 500, 'Server worker error: Gagal memproses login.');
			}
		}

		// =================================================================
		// RUTE GET JADWAL BY KODE (DIPANGGIL OLEH PWA UNTUK INPUT MANUAL)
		// Pola: GET /api/jadwal-by-kode/:kode_akses
		// =================================================================
		const jadwalByKodeMatch = pathname.match(/^\/api\/jadwal-by-kode\/([a-zA-Z0-9_.-]+)\/?$/);
		if (jadwalByKodeMatch && request.method === 'GET') {
			// Validasi environment variables yang dibutuhkan
			if (!env.JADWAL_KV) {
				console.error("Konfigurasi worker tidak lengkap. 'JADWAL_KV' harus diatur.");
				return jsonResponse(false, 500, 'Konfigurasi server worker tidak lengkap.');
			}

			const kodeAkses = jadwalByKodeMatch[1];
			const kvKey = `jadwal:${kodeAkses}`;
			const cachedJadwal = await env.JADWAL_KV.get(kvKey, 'json');

			// --- CACHE HIT ---
			if (cachedJadwal) {
				// Validasi tanggal di sisi worker untuk memberikan feedback cepat.
				// 'sv-SE' locale menghasilkan format YYYY-MM-DD.
				const todayYMD = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

				if (cachedJadwal.tanggal !== todayYMD) {
					// Jadwal tidak berlaku hari ini. Kembalikan error yang akan ditampilkan di PWA, BUKAN 404.
					// Status 200 dengan `status: false` akan mencegah PWA melakukan fallback yang tidak perlu.
					return jsonResponse(false, 403, 'Jadwal ini tidak berlaku untuk hari ini.', null, { 'Cache-Control': 'no-store' });
				}

				// --- LOGIKA BARU: Validasi Waktu Mulai ---
				// Cek apakah waktu saat ini sudah melewati jam mulai.
				const now = new Date(); // Waktu saat ini di UTC
				// Buat objek Date untuk waktu mulai dengan menentukan timezone Asia/Jakarta (UTC+7)
				// Format: YYYY-MM-DDTHH:mm:ss+07:00
				const startTime = new Date(`${cachedJadwal.tanggal}T${cachedJadwal.jam_mulai}+07:00`);

				if (now < startTime) {
					// Jika waktu saat ini belum mencapai waktu mulai, kembalikan error.
					// Status 200 dengan status:false untuk mencegah PWA melakukan fallback.
					return jsonResponse(false, 403, `Absensi untuk kegiatan ini belum dibuka. Silakan coba lagi pada atau setelah pukul ${cachedJadwal.jam_mulai} WIB.`, null, { 'Cache-Control': 'no-store' });
				}

				const endTime = new Date(`${cachedJadwal.tanggal}T${cachedJadwal.jam_selesai}+07:00`);
				const isTerlambat = now > endTime;

				const responseData = {
					...cachedJadwal,
					is_terlambat: isTerlambat,
					server_time: now.toISOString()
				};

				// Jadwal valid, kembalikan data.
				return jsonResponse(true, 200, 'Jadwal ditemukan di cache.', responseData, { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' });
			}
			// --- CACHE MISS ---
			else {
				// Jadwal tidak ditemukan di cache. Kembalikan 404 untuk memicu fallback di PWA.
				return jsonResponse(false, 404, 'Jadwal tidak ditemukan.', null, { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' });
			}
		}

		// =================================================================
		// RUTE OPD LIST (DIPANGGIL OLEH PWA)
		// =================================================================
		if (pathname.endsWith('/api/opd/list')) {
			// Validasi environment variables yang dibutuhkan
			if (!env.OPD_KV) {
				console.error("Konfigurasi worker tidak lengkap. 'OPD_KV' harus diatur.");
				return jsonResponse(false, 500, 'Konfigurasi server worker tidak lengkap.');
			}

			const cachedOpdList = await env.OPD_KV.get('opd_list', 'json');

			if (cachedOpdList) {
				console.log('[OPD Cache] Cache HIT for opd_list.');
				return jsonResponse(true, 200, 'Daftar OPD dari cache.', cachedOpdList);
			} else {
				console.log('[OPD Cache] Cache MISS for opd_list. Returning 404 to PWA.');
				return jsonResponse(false, 404, 'Daftar OPD tidak ditemukan di cache.');
			}
		}

		// =================================================================
		// RUTE SINKRONISASI OPD LIST (DIPANGGIL OLEH ADMIN PANEL VIA PHP)
		// =================================================================
		if (pathname.endsWith('/api/opd-list/sync') && request.method === 'PUT') {
			if (!env.OPD_KV || !env.WORKER_SECRET) {
				return jsonResponse(false, 500, 'Konfigurasi worker tidak lengkap (OPD_KV, WORKER_SECRET).');
			}
			if (request.headers.get('X-Worker-Secret') !== env.WORKER_SECRET) {
				return jsonResponse(false, 403, 'Akses ditolak.');
			}
			const opdList = await request.json();
			await env.OPD_KV.put('opd_list', JSON.stringify(opdList));
			return jsonResponse(true, 200, 'Daftar OPD berhasil disinkronkan ke KV.');
		}

		// =================================================================
		// RUTE CRUD JADWAL (DIPANGGIL OLEH ADMIN PANEL VIA PHP)
		// Pola: /api/jadwal/:kode_akses?
		// =================================================================
		const jadwalMatch = pathname.match(/^\/api\/jadwal\/?([a-zA-Z0-9_.-]+)?\/?$/);
		if (jadwalMatch) {
			// Validasi environment variables yang dibutuhkan untuk rute ini
			if (!env.JADWAL_KV || !env.WORKER_SECRET) {
				console.error("Konfigurasi worker tidak lengkap. 'JADWAL_KV' dan 'WORKER_SECRET' harus diatur.");
				return jsonResponse(false, 500, 'Konfigurasi server worker tidak lengkap.');
			}

			// Validasi secret dari server PHP
			const requestSecret = request.headers.get('X-Worker-Secret');
			if (requestSecret !== env.WORKER_SECRET) {
				return jsonResponse(false, 403, 'Akses ditolak. Invalid secret.');
			}

			const kodeAkses = jadwalMatch[1]; // Bisa undefined jika path-nya hanya /api/jadwal

			// --- CREATE / UPDATE JADWAL (POST atau PUT) ---
			if (request.method === 'POST' || request.method === 'PUT') {
				try {
					const jadwalData = await request.json();
					const effectiveKodeAkses = kodeAkses || jadwalData.kode_akses;
					if (!effectiveKodeAkses) {
						return jsonResponse(false, 400, 'Kode akses tidak ditemukan di URL atau payload.');
					}
					const kvKey = `jadwal:${effectiveKodeAkses}`;
					// Lakukan operasi put secara blocking (await) untuk memastikan data benar-benar tersimpan.
					await env.JADWAL_KV.put(kvKey, JSON.stringify(jadwalData));
					return jsonResponse(true, 200, `Jadwal ${effectiveKodeAkses} berhasil disimpan/diperbarui di cache.`);
				} catch (e) {
					console.error(`[KV JADWAL PUT Error] Gagal menyimpan jadwal:`, e);
					const status = e instanceof SyntaxError ? 400 : 503;
					const message = status === 400 ? `Gagal memproses request: ${e.message}` : `Gagal menyimpan data jadwal ke KV. Error: ${e.message}`;
					return jsonResponse(false, status, message);
				}
			}

			// --- DELETE JADWAL ---
			if (request.method === 'DELETE' && kodeAkses) {
				try {
					const kvKey = `jadwal:${kodeAkses}`;
					await env.JADWAL_KV.delete(kvKey);
					return jsonResponse(true, 200, `Jadwal ${kodeAkses} berhasil dihapus dari cache.`);
				} catch (e) {
					console.error(`[KV JADWAL DELETE Error] Gagal menghapus jadwal ${kodeAkses}:`, e);
					return jsonResponse(false, 503, `Gagal menghapus data jadwal dari KV. Error: ${e.message}`);
				}
			}

			return jsonResponse(false, 405, 'Metode tidak valid untuk rute /api/jadwal.');
		}

		// =================================================================
		// RUTE BARU: REFRESH TOKEN (DIPANGGIL OLEH PWA)
		// =================================================================
		if (pathname.endsWith('/api/profil/refresh-token')) {
			if (request.method !== 'POST') {
				return jsonResponse(false, 405, 'Metode request yang diharapkan adalah POST');
			}

			// 1. Validasi token JWT dari PWA
			const authHeader = request.headers.get('Authorization');
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
			}
			const token = authHeader.substring(7);
			const secret = new TextEncoder().encode(env.JWT_SECRET);
			let decodedToken;
			try {
				const { payload } = await jwtVerify(token, secret, { issuer: ALLOWED_ISSUERS });
				decodedToken = payload;
			} catch (err) {
				return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
			}

			try {
				const nip = decodedToken.data.nip;
				const kvKey = `pegawai:${nip}`;
				const profilKv = await env.PEGAWAI_KV.get(kvKey, 'json');

				// 2. Jika data ada di cache (Cache HIT)
				if (profilKv) {
					console.log(`[Profil Refresh Token] Cache HIT untuk NIP ${nip}. Membuat token baru.`);

					const issuedAt = Math.floor(Date.now() / 1000);
					const expirationTime = issuedAt + 3600 * 24 * 30; // 30 hari
					const payload = {
						data: {
							nip: profilKv.nip,
							nama: profilKv.nama_pegawai,
							opd: profilKv.perangkat_daerah,
							jabatan: profilKv.jabatan,
							role: profilKv.role || ['asn'],
							jenis_asn: profilKv.jenis_asn
						},
					};
					const newJwt = await new SignJWT(payload)
						.setProtectedHeader({ alg: 'HS256' })
						.setIssuedAt(issuedAt)
						.setExpirationTime(expirationTime)
						.setIssuer(DEFAULT_ISSUER)
						.sign(secret);

					const responseData = {
						token: newJwt,
					};

					return jsonResponse(true, 200, 'Token berhasil diperbarui dari cache.', responseData);
				}

				// 3. Jika data tidak ada di cache (Cache MISS), panggil server PHP
				console.log(`[Profil Refresh Token] Cache MISS untuk NIP ${nip}. Memanggil PHP.`);
				const phpResponse = await fetch(`${env.ORIGIN_API_URL}/profil/refresh-token`, {
					method: 'POST',
					headers: { 'Authorization': `Bearer ${token}` },
				});

				const phpResult = await phpResponse.json();

				// Kembalikan hasil dari PHP
				const isSuccess = phpResponse.ok && (phpResult.status === true || phpResult.status === 'success');
				return jsonResponse(isSuccess, phpResponse.status, phpResult.message || (isSuccess ? 'Sukses' : 'Gagal'), phpResult.data || null);

			} catch (error) {
				console.error('Error di worker /api/profil/refresh-token:', error.message, error.stack);
				return jsonResponse(false, 500, 'Server worker error: Gagal memperbarui token.');
			}
		}

		// =================================================================
		// RUTE SINKRONISASI PROFIL (DIPANGGIL OLEH PWA)
		// Sesuai permintaan: PWA "menarik" data terbaru dari cache. Worker akan:
		// 1. Mengambil data dari KV.
		// 2. Jika ada, buat token baru dan kirim kembali.
		// 3. Jika tidak ada (cache miss), fallback ke server PHP, simpan ke KV, lalu kirim kembali.
		// =================================================================
		if (pathname.endsWith('/api/profil/sync')) {
			if (request.method !== 'POST') {
				return jsonResponse(false, 405, 'Metode request yang diharapkan adalah POST');
			}

			// 1. Validasi token JWT dari PWA
			const authHeader = request.headers.get('Authorization');
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
			}
			const token = authHeader.substring(7);
			const secret = new TextEncoder().encode(env.JWT_SECRET);
			let decodedToken;
			try {
				const { payload } = await jwtVerify(token, secret, { issuer: ALLOWED_ISSUERS });
				decodedToken = payload;
			} catch (err) {
				console.error(`[Profil Refresh Token] Gagal validasi token: ${err.message}`);
				return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
			}

			try {
				const nip = decodedToken.data.nip;
				const kvKey = `pegawai:${nip}`;
				const profilKv = await env.PEGAWAI_KV.get(kvKey, 'json');

				// 2. Jika data ada di cache (Cache HIT)
				if (profilKv) {
					console.log(`[Profil Sync] Cache HIT untuk NIP ${nip}. Membuat token baru dari data KV.`);

					// Buat token baru dari data KV
					const issuedAt = Math.floor(Date.now() / 1000);
					const expirationTime = issuedAt + 3600 * 24 * 30; // 30 hari
					const payload = {
						data: {
							nip: profilKv.nip,
							nama: profilKv.nama_pegawai,
							opd: profilKv.perangkat_daerah,
							jabatan: profilKv.jabatan,
							role: profilKv.role || ['asn'],
							jenis_asn: profilKv.jenis_asn
						},
					};
					const newJwt = await new SignJWT(payload)
						.setProtectedHeader({ alg: 'HS256' })
						.setIssuedAt(issuedAt)
						.setExpirationTime(expirationTime)
						.setIssuer(DEFAULT_ISSUER)
						.sign(secret);

					const responseData = {
						token: newJwt,
						user: {
							nama: profilKv.nama_pegawai,
							jabatan: profilKv.jabatan,
							opd: profilKv.perangkat_daerah
						}
					};

					return jsonResponse(true, 200, 'Profil berhasil disinkronkan.', responseData);
				}

				// 3. Jika data tidak ada di cache (Cache MISS), panggil server PHP
				console.log(`[Profil Sync] Cache MISS untuk NIP ${nip}. Memanggil PHP untuk sinkronisasi.`);
				const cacheBuster = `?v=${Date.now()}`;
				const phpResponse = await fetch(`${env.ORIGIN_API_URL}/profil/refresh${cacheBuster}`, {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${token}` },
				});

				const phpResult = await phpResponse.json();

				// 4. Jika panggilan PHP berhasil dan ada data untuk di-cache, lakukan update KV
				if (phpResponse.ok && phpResult.status && phpResult.data.pegawai_to_cache) {
					ctx.waitUntil(env.PEGAWAI_KV.put(kvKey, JSON.stringify(phpResult.data.pegawai_to_cache)));
					delete phpResult.data.pegawai_to_cache; // Hapus dari respons ke PWA
				}

				const isSuccess = phpResponse.ok && (phpResult.status === true || phpResult.status === 'success');
				return jsonResponse(isSuccess, phpResponse.status, phpResult.message || (isSuccess ? 'Sukses' : 'Gagal'), phpResult.data || null);
			} catch (error) {
				console.error('Error di worker /api/profil/sync:', error.message, error.stack);
				return jsonResponse(false, 500, 'Server worker error: Gagal memproses sinkronisasi profil.');
			}
		}

		// =================================================================
		// RUTE BARU: GENERATE TEMPORARY TOKEN (DIPANGGIL OLEH PWA)
		// =================================================================
		if (pathname.endsWith('/api/token/generate-temporary')) {
			if (request.method !== 'POST') {
				return jsonResponse(false, 405, 'Metode request yang diharapkan adalah POST');
			}

			// Validasi environment variables
			if (!env.JWT_SECRET) {
				console.error("Secret 'JWT_SECRET' belum diatur di Cloudflare.");
				return jsonResponse(false, 500, 'Konfigurasi server worker tidak lengkap.');
			}

			// Validasi token dari PWA
			const authHeader = request.headers.get('Authorization');
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
			}

			const token = authHeader.substring(7);
			const secret = new TextEncoder().encode(env.JWT_SECRET);
			let decodedToken;

			try {
				const { payload } = await jwtVerify(token, secret, { issuer: ALLOWED_ISSUERS });
				decodedToken = payload;
			} catch (err) {
				return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
			}

			try {
				// Buat JWT baru dengan masa berlaku singkat
				const issuedAt = Math.floor(Date.now() / 1000);
				const expirationTime = issuedAt + 180; // Berlaku 3 menit (180 detik)
				const pegawaiData = decodedToken.data;

				const tempPayload = {
					data: {
						nip: pegawaiData.nip,
						nama: pegawaiData.nama,
						opd: pegawaiData.opd,
						jabatan: pegawaiData.jabatan,
						role: pegawaiData.role || ['asn'],
						jenis_asn: pegawaiData.jenis_asn
					}
				};

				const tempJwt = await new SignJWT(tempPayload).setProtectedHeader({ alg: 'HS256' }).setExpirationTime(expirationTime).sign(secret);
				const prefixedToken = "BB:" + tempJwt;

				return jsonResponse(true, 200, 'Token sementara berhasil dibuat via worker', { token: prefixedToken });

			} catch (error) {
				console.error('Error di worker /api/token/generate-temporary:', error.message, error.stack);
				return jsonResponse(false, 500, 'Server worker error: Gagal membuat token sementara.');
			}
		}

		// =================================================================
		// RUTE CRUD PEGAWAI (DIPANGGIL OLEH ADMIN PANEL VIA PHP)
		// Pola: /api/pegawai/:nip
		// =================================================================
		const pegawaiMatch = pathname.match(/^\/api\/pegawai\/(\d{18})$/);
		if (pegawaiMatch) {
			// Validasi environment variables
			if (!env.PEGAWAI_KV || !env.WORKER_SECRET) {
				console.error("CRUD Pegawai Error: PEGAWAI_KV or WORKER_SECRET not configured.");
				return jsonResponse(false, 500, 'Konfigurasi worker tidak lengkap.');
			}

			// Validasi secret dari server PHP
			const requestSecret = request.headers.get('X-Worker-Secret');
			if (requestSecret !== env.WORKER_SECRET) {
				return jsonResponse(false, 403, 'Akses ditolak. Invalid secret.');
			}

			const nip = pegawaiMatch[1];
			const kvKey = `pegawai:${nip}`;

			// --- CREATE / UPDATE PEGAWAI (PUT) ---
			if (request.method === 'PUT') {
				try {
					const pegawaiData = await request.json();
					// Jika NIK kosong/tidak diubah, pertahankan NIK hash lama yang ada di KV
					if (!pegawaiData.nik) {
						const existing = await env.PEGAWAI_KV.get(kvKey, 'json');
						if (existing && existing.nik) {
							pegawaiData.nik = existing.nik;
						}
					}
					// Lakukan operasi put secara blocking (await) untuk memastikan data benar-benar tersimpan.
					// Jangan gunakan ctx.waitUntil() karena kita butuh konfirmasi sukses/gagal. Hapus TTL agar data permanen.
					await env.PEGAWAI_KV.put(kvKey, JSON.stringify(pegawaiData));
					return jsonResponse(true, 200, `Cache untuk NIP ${nip} berhasil disimpan/diperbarui.`);
				} catch (e) {
					console.error(`[KV PEGAWAI PUT Error] Gagal menyimpan NIP ${nip}:`, e);
					const status = e instanceof SyntaxError ? 400 : 503;
					const message = status === 400 ? `Gagal memproses request: ${e.message}` : `Gagal menyimpan data ke KV. Error: ${e.message}`;
					return jsonResponse(false, status, message);
				}
			}

			// --- DELETE PEGAWAI (DELETE) ---
			if (request.method === 'DELETE') {
				try {
					await env.PEGAWAI_KV.delete(kvKey);
					return jsonResponse(true, 200, `Cache untuk NIP ${nip} berhasil dihapus.`);
				} catch (e) {
					console.error(`[KV PEGAWAI DELETE Error] Gagal menghapus NIP ${nip}:`, e);
					return jsonResponse(false, 503, `Gagal menghapus data dari KV. Error: ${e.message}`);
				}
			}

			return jsonResponse(false, 405, 'Metode tidak valid untuk rute /api/pegawai.');
		}

		// =================================================================
		// RUTE BULK UPDATE PEGAWAI (DIPANGGIL OLEH SKRIP CLI)
		// Pola: POST /api/pegawai/bulk
		// =================================================================
		if (pathname.endsWith('/api/pegawai/bulk')) {
			// Validasi environment variables
			if (!env.PEGAWAI_KV || !env.WORKER_SECRET) {
				console.error("Bulk Update Pegawai Error: PEGAWAI_KV or WORKER_SECRET not configured.");
				return jsonResponse(false, 500, 'Konfigurasi worker tidak lengkap.');
			}

			// Validasi secret dari server PHP
			const requestSecret = request.headers.get('X-Worker-Secret');
			if (requestSecret !== env.WORKER_SECRET) {
				return jsonResponse(false, 403, 'Akses ditolak. Invalid secret.');
			}

			// Hanya izinkan metode POST
			if (request.method !== 'POST') {
				return jsonResponse(false, 405, 'Metode tidak valid untuk rute /api/pegawai/bulk. Gunakan POST.');
			}

			try {
				const pegawaiList = await request.json();
				if (!Array.isArray(pegawaiList)) {
					return jsonResponse(false, 400, 'Payload harus berupa array data pegawai.');
				}

				// Lakukan operasi put secara blocking (await) untuk memastikan data benar-benar tersimpan.
				const bulkPutPromises =
					pegawaiList
						.filter(p => p && p.nip) // Abaikan item yang tidak valid
						.map(pegawaiData => {
							const kvKey = `pegawai:${pegawaiData.nip}`;
							// Simpan secara permanen (tanpa TTL)
							return env.PEGAWAI_KV.put(kvKey, JSON.stringify(pegawaiData));
						});

				await Promise.all(bulkPutPromises);

				return jsonResponse(true, 200, `${pegawaiList.length} data pegawai berhasil disinkronkan.`);
			} catch (e) {
				console.error(`[KV PEGAWAI BULK PUT Error] Gagal menyimpan batch:`, e);
				return jsonResponse(false, 503, `Gagal menyimpan sebagian atau semua data ke KV. Error: ${e.message}`);
			}
		}

		// =================================================================
		// RUTE 2: ENDPOINT UNTUK MENGUJI KONEKSI KV
		// =================================================================
		if (pathname.endsWith('/api/test-kv')) {
			// Pastikan binding PEGAWAI_KV sudah ada
			if (!env.PEGAWAI_KV) {
				return jsonResponse(false, 500, "KV Namespace 'PEGAWAI_KV' tidak terkonfigurasi.");
			}

			// Metode POST: untuk menulis data ke KV
			if (request.method === 'POST') {
				try {
					const { key, value } = await request.json();
					// Simpan data ke KV. `put` tidak mengembalikan nilai.
					// Kita gunakan ctx.waitUntil agar proses penyimpanan tidak memblokir response.
					ctx.waitUntil(env.PEGAWAI_KV.put(key, JSON.stringify(value)));
					return jsonResponse(true, 200, `OK. Data untuk kunci '${key}' sedang disimpan.`);
				} catch (e) {
					return jsonResponse(false, 400, `Gagal memproses request: ${e.message}`);
				}
			}

			// Metode GET: untuk membaca data dari KV
			if (request.method === 'GET') {
				const key = url.searchParams.get('key');
				if (!key) {
					return jsonResponse(false, 400, "Parameter 'key' dibutuhkan.");
				}
				// Ambil data dari KV. Parameter kedua 'json' akan otomatis mem-parsing hasilnya.
				const value = await env.PEGAWAI_KV.get(key, 'json');
				if (value) {
					return jsonResponse(true, 200, 'Data ditemukan.', value);
				} else {
					return jsonResponse(false, 404, `Data untuk kunci '${key}' tidak ditemukan.`);
				}
			}

			return jsonResponse(false, 405, 'Metode tidak diizinkan untuk /api/test-kv. Gunakan GET atau POST.');
		}

		// =================================================================
		// RUTE BARU: SUBMIT ABSENSI CEPAT (PRODUSER QUEUE)
		// =================================================================
		if (pathname.endsWith('/api/absen-cepat/submit')) {
			if (request.method !== 'POST') {
				return jsonResponse(false, 405, 'Metode request yang diharapkan adalah POST');
			}

			// Validasi token admin dari header
			if (!env.JWT_SECRET) {
				console.error("Secret 'JWT_SECRET' belum diatur di Cloudflare.");
				return jsonResponse(false, 500, 'Konfigurasi server worker tidak lengkap.');
			}

			const authHeader = request.headers.get('Authorization');
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
			}

			const adminToken = authHeader.substring(7);
			const secret = new TextEncoder().encode(env.JWT_SECRET);
			let decodedPayload;

			try {
				// Verifikasi token admin
				const { payload } = await jwtVerify(adminToken, secret, { issuer: ALLOWED_ISSUERS });
				decodedPayload = payload;
			} catch (err) {
				return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
			}

			// Otorisasi: Pastikan pengguna yang melakukan request memiliki peran 'admin' atau 'super admin'
			const userRoles = Array.isArray(decodedPayload?.data?.role) ? decodedPayload.data.role : (decodedPayload?.data?.role ? [decodedPayload.data.role] : []);
			const hasAdminRole = userRoles.some(r => ['admin', 'super admin'].includes(String(r).trim().toLowerCase()));
			if (!hasAdminRole) {
				return jsonResponse(false, 403, 'Hak akses ditolak.');
			}

			try {
				// Ambil payload dari body, yang berisi data absensi dan token user
				const payload = await request.json();
				const userToken = payload.user_token;

				if (!userToken) {
					return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
				}

				// Validasi aturan ketat (waktu dan lokasi)
				const validationError = await validateJadwalAbsen(payload.kode_akses, payload);
				if (validationError) {
					return jsonResponse(false, validationError.code, validationError.message);
				}

				// Hapus user_token dari payload utama agar tidak terkirim ke PHP jika ada fallback
				delete payload.user_token;

				// Buat payload untuk antrian, gunakan token user dari body dan set keterangan_verifikasi
				const keteranganAdmin = payload.keterangan_verifikasi || payload.keterangan || 'Absensi Cepat oleh Admin';
				const queuePayload = {
					...payload,
					keterangan_verifikasi: keteranganAdmin,
					jwt_token: userToken,
					submittedAt: new Date().toISOString()
				};
				delete queuePayload.keterangan; // Jangan timpa kolom keterangan pegawai
				await env.MY_QUEUE.send(queuePayload);

				return jsonResponse(true, 202, 'Absensi Cepat telah diterima dan akan segera diproses.');
			} catch (error) {
				console.error('Error di fetch handler (producer absen-cepat) worker:', error);
				return jsonResponse(false, 500, 'Server worker error: Gagal memproses permintaan Absensi Cepat Anda.');
			}
		}

		// =================================================================
		// RUTE 4: SUBMIT ABSENSI (PRODUSER QUEUE) - Logika yang sudah ada
		// =================================================================
		if (pathname.endsWith('/api/absen/submit')) {
			if (request.method !== 'POST') {
				return jsonResponse(false, 405, 'Metode request yang diharapkan adalah POST');
			}

			if (!env.JWT_SECRET) {
				console.error("Secret 'JWT_SECRET' belum diatur di Cloudflare.");
				return jsonResponse(false, 500, 'Konfigurasi server worker tidak lengkap.');
			}

			const authHeader = request.headers.get('Authorization');
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
			}

			const token = authHeader.substring(7);
			const secret = new TextEncoder().encode(env.JWT_SECRET);

			try {
				await jwtVerify(token, secret, { issuer: ALLOWED_ISSUERS });
			} catch (err) {
				return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
			}

			try {
				const payload = await request.json();

				// Validasi jadwal (waktu mulai, strict time, strict location)
				const validationError = await validateJadwalAbsen(payload.kode_akses, payload);
				if (validationError) {
					return jsonResponse(false, validationError.code, validationError.message);
				}

				const queuePayload = { ...payload, jwt_token: token, submittedAt: new Date().toISOString() };
				await env.MY_QUEUE.send(queuePayload);

				const pesanSukses = (payload.status_verifikasi === 'Menunggu Verifikasi Admin')
					? 'Absen sudah terkirim. BKPSDM Kota Pariaman akan melakukan verifikasi absen Anda.'
					: 'Absensi Anda telah diterima dan akan segera diproses.';

				return jsonResponse(true, 202, pesanSukses, { waktu: new Date().toISOString() });
			} catch (error) {
				console.error('Error di fetch handler (producer) worker:', error);
				return jsonResponse(false, 500, 'Server worker error: Gagal memproses permintaan Anda.');
			}
		}

		// Fallback untuk rute yang tidak dikenal
		return jsonResponse(false, 404, 'Endpoint tidak ditemukan di worker.');
	},

	/**
	 * Queue handler: Berperan sebagai CONSUMER.
	 * Menerima pesan dari antrian dan meneruskannya ke server PHP origin.
	 * @param {MessageBatch} batch
	 * @param {object} env
	 * @param {ExecutionContext} ctx
	 */
	async queue(batch, env) {
		// 1. Validasi environment variables untuk mode bulk
		if (!env.ORIGIN_API_BULK_URL || !env.WORKER_SECRET) {
			console.error("Secrets 'ORIGIN_API_BULK_URL' and 'WORKER_SECRET' must be set for bulk processing.");
			// Coba lagi semua pesan di batch ini nanti, berharap konfigurasi sudah diperbaiki.
			batch.retryAll({ delaySeconds: 300 }); // Coba lagi setelah 5 menit
			return;
		}

		// 2. Kumpulkan semua pesan dari batch untuk dikirim sekaligus.
		const messagesToSend = batch.messages.map(msg => ({
			id: msg.id,
			body: msg.body
		}));

		if (messagesToSend.length === 0) {
			console.log("[Queue Consumer] Batch kosong, tidak ada yang diproses.");
			return;
		}

		console.log(`[Queue Consumer] Memproses batch berisi ${messagesToSend.length} pesan.`);

		try {
			// 3. Kirim seluruh batch sebagai satu request POST.
			const response = await fetch(env.ORIGIN_API_BULK_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Worker-Secret': env.WORKER_SECRET
				},
				body: JSON.stringify(messagesToSend),
				signal: AbortSignal.timeout(60000) // Timeout lebih lama (60 detik) untuk proses bulk
			});

			// 4. Tangani response dari endpoint bulk.
			if (response.ok) {
				// HTTP 200-299: Sukses. Pesan akan otomatis dihapus dari antrian.
				const responseData = await response.json();
				console.log(`[Queue Consumer] Batch SUKSES. Respon server:`, responseData.message);
				// LOGIKA BARU: Tambahkan logging untuk error yang dilaporkan oleh PHP
				if (responseData.errors && responseData.errors.length > 0) {
					console.error(`[Queue Consumer] Detail kegagalan dari server PHP:`, JSON.stringify(responseData.errors, null, 2));
				}
			} else {
				// HTTP 4xx atau 5xx: Gagal. Seluruh batch akan dicoba lagi.
				const errorText = await response.text();
				console.error(`[Queue Consumer] Batch GAGAL. Server merespon dengan status ${response.status}: ${errorText}. Data yang gagal: ${JSON.stringify(messagesToSend)}. Mencoba ulang seluruh batch...`);
				batch.retryAll({ delaySeconds: 120 }); // Coba lagi setelah 2 menit
			}

		} catch (error) {
			// Error jaringan atau exception lain saat fetch.
			console.error(`[Queue Consumer] Error jaringan saat memproses batch:`, error, `Data yang gagal: ${JSON.stringify(messagesToSend)}`);
			// Coba lagi seluruh batch.
			batch.retryAll();
		}
	},
};