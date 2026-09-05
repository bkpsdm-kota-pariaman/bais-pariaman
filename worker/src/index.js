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

// Helper Hashing WebCrypto SHA-256 (Cepat & hemat CPU < 0.1ms untuk Edge Worker)
async function hashSha256(text) {
	const encoder = new TextEncoder();
	const data = encoder.encode(text);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyNikPassword(input, storedNik) {
	if (!storedNik || !input) return false;
	const cleanInput = String(input).trim();
	const cleanStored = String(storedNik).trim();

	// 1. Match SHA-256 Hash (64 karakter hex)
	if (cleanStored.length === 64 && /^[0-9a-f]{64}$/i.test(cleanStored)) {
		const hashedInput = await hashSha256(cleanInput);
		return hashedInput.toLowerCase() === cleanStored.toLowerCase();
	}

	// 2. Match plain text
	if (cleanStored === cleanInput) return true;

	return false;
}

// Definisikan header CORS di satu tempat agar mudah dikelola.
// Ini mengizinkan semua origin ('*'), yang cukup untuk pengembangan.
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

const ALLOWED_ISSUERS = ['bais-pariaman-apps', 'bais-pariaman-apps', 'bais-pariaman-apps-admin', 'bais-pariaman-apps-jadwal'];
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

// Helper AES-256-GCM untuk Token QR Code Profil Sementara (Prefix BP:)
async function encryptBpToken(nip, exp, secretStr) {
	const encoder = new TextEncoder();
	const secretBytes = encoder.encode(secretStr);
	const keyHash = await crypto.subtle.digest('SHA-256', secretBytes);
	const key = await crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM' }, false, ['encrypt']);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const plaintext = encoder.encode(`${nip}:${exp}`);
	const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, tagLength: 128 }, key, plaintext);
	const encryptedArray = new Uint8Array(encrypted);
	const combined = new Uint8Array(iv.length + encryptedArray.length);
	combined.set(iv, 0);
	combined.set(encryptedArray, iv.length);

	let binaryString = '';
	for (let i = 0; i < combined.length; i++) {
		binaryString += String.fromCharCode(combined[i]);
	}
	const base64 = btoa(binaryString);
	const base64Url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	return 'BP:' + base64Url;
}

async function decryptBpToken(token, secretStr) {
	if (!token || typeof token !== 'string') return null;
	if (!token.startsWith('BP:')) return null;
	try {
		const b64Url = token.substring(3);
		let b64 = b64Url.replace(/-/g, '+').replace(/_/g, '/');
		while (b64.length % 4) b64 += '=';
		const binaryStr = atob(b64);
		const combined = new Uint8Array(binaryStr.length);
		for (let i = 0; i < binaryStr.length; i++) {
			combined[i] = binaryStr.charCodeAt(i);
		}
		if (combined.length < 29) return null;
		const iv = combined.subarray(0, 12);
		const ciphertextWithTag = combined.subarray(12);

		const encoder = new TextEncoder();
		const secretBytes = encoder.encode(secretStr);
		const keyHash = await crypto.subtle.digest('SHA-256', secretBytes);
		const key = await crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM' }, false, ['decrypt']);
		const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv, tagLength: 128 }, key, ciphertextWithTag);
		const text = new TextDecoder().decode(decrypted);
		const parts = text.split(':');
		if (parts.length < 2) return null;
		const nip = parts[0];
		const exp = parseInt(parts[1], 10);
		if (Math.floor(Date.now() / 1000) > exp) return null;
		return { nip, exp };
	} catch (e) {
		return null;
	}
}

// Helper untuk format JSON Response terstandarisasi.
// PENTING: Selalu mengembalikan HTTP status 200 di tingkat protokol HTTP agar browser tidak menampilkan log error merah di DevTools Console.
// Status keberhasilan (true/false) dan kode error riil (400, 401, 403, 500, dll) dikirim melalui body JSON (status & code).
function jsonResponse(success, statusCode, message, data = null, customHeaders = {}) {
	const body = {
		status: success,
		code: statusCode,
		message: message,
		data: data
	};
	const actualHttpStatus = statusCode >= 500 ? 500 : 200;
	return new Response(JSON.stringify(body), {
		status: actualHttpStatus,
		headers: {
			'Content-Type': 'application/json',
			...corsHeaders,
			...customHeaders
		}
	});
}

// Helper untuk verifikasi token admin/super admin dari header Authorization
async function verifyAdminToken(request, env) {
	if (!env.JWT_SECRET) return null;
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
	const token = authHeader.substring(7);
	try {
		const secret = new TextEncoder().encode(env.JWT_SECRET);
		const { payload } = await jwtVerify(token, secret, { issuer: ALLOWED_ISSUERS });
		const userRoles = Array.isArray(payload?.data?.role) ? payload.data.role : (payload?.data?.role ? [payload.data.role] : []);
		const isAdmin = userRoles.some(r => ['admin', 'super admin'].includes(String(r).trim().toLowerCase()));
		if (!isAdmin) return null;
		return payload;
	} catch (e) {
		return null;
	}
}

// Helper untuk verifikasi token KHUSUS super admin dari header Authorization
async function verifySuperAdminToken(request, env) {
	if (!env.JWT_SECRET) return null;
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
	const token = authHeader.substring(7);
	try {
		const secret = new TextEncoder().encode(env.JWT_SECRET);
		const { payload } = await jwtVerify(token, secret, { issuer: ALLOWED_ISSUERS });
		const userRoles = Array.isArray(payload?.data?.role) ? payload.data.role : (payload?.data?.role ? [payload.data.role] : []);
		const isSuperAdmin = userRoles.some(r => String(r).trim().toLowerCase() === 'super admin');
		if (!isSuperAdmin) return null;
		return payload;
	} catch (e) {
		return null;
	}
}

/**
 * Helper terpusat pemroses data absensi (Mandiri / Cepat) per-record item (PRD 4.4).
 * Mengembalikan object 1:1 sesuai kolom tabel app_absensi_data_absensi.
 */
function resolveAbsensiRecord(mode, userAuth, pegawai, jadwal, lat, lng, lokasi, foto, keteranganPegawai, keteranganVerifikasi, statusKehadiranInput = 'Hadir', statusVerifikasiInput = null) {
	const now = new Date();
	const waktuSekarang = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }) + ' ' + now.toLocaleTimeString('sv-SE', { timeZone: 'Asia/Jakarta' });
	let namaFileFoto = 'NO_PHOTO_ADMIN_FAST_INPUT.jpg';
	let statusKehadiran = statusKehadiranInput || 'Hadir';
	let statusVerifikasi = 'Terverifikasi Oleh Sistem';
	let finalKeterangan = '-';
	let finalKeteranganVerifikasi = '-';

	if (mode === 'absen_cepat') {
		const userRole = String(userAuth?.data?.role || userAuth?.role || '').toLowerCase();
		const isUserAdmin = ['admin', 'super admin', 'superadmin'].includes(userRole);
		if (!isUserAdmin) {
			const err = new Error("Akses ditolak. Fitur ini hanya untuk Admin.");
			err.code = 403;
			throw err;
		}

		const cleanVerif = String(keteranganVerifikasi || '').trim();
		if (!cleanVerif) {
			const err = new Error("Keterangan verifikasi wajib diisi oleh Admin.");
			err.code = 422;
			throw err;
		}

		statusKehadiran = statusKehadiranInput || 'Hadir';
		statusVerifikasi = statusVerifikasiInput || 'Terverifikasi Oleh Admin';
		finalKeterangan = String(keteranganPegawai || '').trim() || cleanVerif;
		finalKeteranganVerifikasi = cleanVerif;

		if (foto) {
			const ext = (typeof foto === 'string' && foto.includes('application/pdf')) ? 'pdf' : 'jpg';
			const timestamp = Math.floor(Date.now() / 1000);
			const randomHex = Math.random().toString(36).substring(2, 8);
			namaFileFoto = `${pegawai.nip || 'PEGAWAI'}_${jadwal.kode_akses || 'JADWAL'}_${timestamp}_${randomHex}.${ext}`;
		}
	} else if (mode === 'absen_mandiri') {
		if (!userAuth || (!userAuth.nip && !userAuth?.data?.nip)) {
			const err = new Error("Token tidak valid atau sesi berakhir.");
			err.code = 401;
			throw err;
		}

		if (!foto) {
			const err = new Error("Foto / bukti dukung presensi wajib diisi.");
			err.code = 422;
			throw err;
		}

		statusKehadiran = statusKehadiranInput || 'Hadir';

		if (statusKehadiran === 'Hadir') {
			const latNum = parseFloat(lat || 0);
			const lngNum = parseFloat(lng || 0);
			const lokasiClean = String(lokasi || '').trim();
			const gpsInvalid = (!latNum || !lngNum || !lokasiClean || lokasiClean.toLowerCase().includes('gps'));

			let jarakMeter = 999999;
			if (!gpsInvalid && jadwal.koordinat) {
				const parts = String(jadwal.koordinat).split(',');
				if (parts.length >= 2) {
					jarakMeter = haversineDistance(latNum, lngNum, parseFloat(parts[0].trim()), parseFloat(parts[1].trim()));
				}
			}

			const radiusMeter = parseFloat(jadwal.radius_meter || 0);
			const isLuarRadius = (gpsInvalid || (radiusMeter > 0 && jarakMeter > radiusMeter));

			let isTerlambat = false;
			if (jadwal.jam_mulai && jadwal.jam_selesai) {
				const todayYMD = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
				const startTime = new Date(`${todayYMD}T${jadwal.jam_mulai}+07:00`);
				const endTime = new Date(`${todayYMD}T${jadwal.jam_selesai}+07:00`);
				if (now < startTime || now > endTime) {
					isTerlambat = true;
				}
			}

			if (jadwal.is_strict_time && isTerlambat) {
				const err = new Error("Presensi ditolak. Waktu presensi di luar jadwal kegiatan.");
				err.code = 422;
				throw err;
			}
			if (jadwal.is_strict_location && isLuarRadius) {
				const err = new Error("Presensi ditolak. Lokasi berada di luar radius kegiatan.");
				err.code = 422;
				throw err;
			}

			const keteranganClean = String(keteranganPegawai || '').trim();
			if (isTerlambat || isLuarRadius) {
				if (!keteranganClean) {
					const err = new Error("Anda terlambat atau berada di luar radius lokasi. Kolom keterangan wajib diisi.");
					err.code = 422;
					throw err;
				}
				finalKeterangan = keteranganClean;
				statusVerifikasi = 'Menunggu Verifikasi Admin';
			} else {
				finalKeterangan = '-';
				statusVerifikasi = 'Terverifikasi Oleh Sistem';
			}

			const ext = (typeof foto === 'string' && foto.includes('application/pdf')) ? 'pdf' : 'jpg';
			const timestamp = Math.floor(Date.now() / 1000);
			const randomHex = Math.random().toString(36).substring(2, 8);
			namaFileFoto = `${pegawai.nip}_${jadwal.kode_akses}_${timestamp}_${randomHex}.${ext}`;
		} else {
			const keteranganClean = String(keteranganPegawai || '').trim();
			if (!keteranganClean) {
				const err = new Error("Keterangan alasan tidak hadir wajib diisi.");
				err.code = 422;
				throw err;
			}

			finalKeterangan = keteranganClean;
			statusVerifikasi = 'Menunggu Verifikasi Admin';
			finalKeteranganVerifikasi = '-';

			const ext = (typeof foto === 'string' && foto.includes('application/pdf')) ? 'pdf' : 'jpg';
			const timestamp = Math.floor(Date.now() / 1000);
			const randomHex = Math.random().toString(36).substring(2, 8);
			namaFileFoto = `${pegawai.nip}_${jadwal.kode_akses}_${timestamp}_${randomHex}.${ext}`;
		}
	} else {
		const err = new Error("Mode absensi tidak dikenali.");
		err.code = 400;
		throw err;
	}

	return {
		kode_akses:            jadwal.kode_akses || '',
		nip:                   pegawai.nip || '',
		nama_pegawai:          pegawai.nama_pegawai || '',
		opd:                   pegawai.opd || pegawai.perangkat_daerah || '',
		jabatan:               pegawai.jabatan || '',
		kategori:              jadwal.kategori || '',
		waktu:                 waktuSekarang,
		lokasi:                lokasi || '-',
		lat:                   parseFloat(lat || 0),
		lng:                   parseFloat(lng || 0),
		nama_file_foto:        namaFileFoto,
		keterangan:            finalKeterangan,
		keterangan_verifikasi: finalKeteranganVerifikasi,
		status_verifikasi:     statusVerifikasi,
		status_kehadiran:      statusKehadiran
	};
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

			try {
				const url = new URL(request.url);
				const pathname = url.pathname;

				// Helper validasi jadwal
				const validateJadwalAbsen = async (kodeAkses, payload, isAdminCepat = false) => {
					if (!kodeAkses || !env.JADWAL_KV) return null;
					const cachedJadwal = await env.JADWAL_KV.get(`jadwal:${kodeAkses}`, 'json');
					if (!cachedJadwal) return null;

					if (isAdminCepat) {
						payload.keterangan = payload.keterangan || payload.keterangan_verifikasi || 'Absensi Cepat oleh Admin';
					}

					const now = payload.submittedAt ? new Date(payload.submittedAt) : new Date();
					const todayYMD = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
					if (cachedJadwal.tanggal !== todayYMD) {
						if (todayYMD > cachedJadwal.tanggal) {
							return { error: true, code: 403, message: "Gagal: Jadwal kegiatan ini sudah berlalu." };
						} else {
							return { error: true, code: 403, message: "Gagal: Jadwal kegiatan ini belum dimulai." };
						}
					}

					const startTime = new Date(`${cachedJadwal.tanggal}T${cachedJadwal.jam_mulai}+07:00`);
					if (now < startTime) {
						return { error: true, code: 403, message: `Absensi untuk kegiatan ini belum dibuka. Silakan coba lagi pada atau setelah pukul ${String(cachedJadwal.jam_mulai).substring(0, 5)} WIB.` };
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

					// Validasi QR Code Token jika dikirim
					if (payload.qr_token && String(payload.qr_token).trim() !== '') {
						try {
							const secret = new TextEncoder().encode(env.JWT_SECRET);
							await jwtVerify(payload.qr_token, secret, { issuer: ALLOWED_ISSUERS });
						} catch (e) {
							return { error: true, code: 401, message: "Token QR Code tidak valid atau sudah kedaluwarsa." };
						}
					}

					// Jika pegawai mencoba Hadir murni (bukan Izin/Sakit/Cuti)
					if (status === "hadir") {
						// Validasi Strict Time
						if (cachedJadwal.is_strict_time && cachedJadwal.is_strict_time == 1 && isTerlambat) {
							return { error: true, code: 403, message: "Gagal: Waktu Berakhir. Anda melanggar Aturan Waktu Berlaku." };
						}

						// Validasi Strict Location
						if (cachedJadwal.is_strict_location && cachedJadwal.is_strict_location == 1 && isLuarRadius) {
							return { error: true, code: 403, message: "Gagal: Di Luar Lokasi. Anda melanggar Aturan Wajib Sesuai Lokasi." };
						}

						// Jika terlambat atau luar radius, keterangan wajib diisi (khusus ASN biasa)
						if (!isAdminCepat && (isTerlambat || isLuarRadius) && (!payload.keterangan || String(payload.keterangan).trim() === '')) {
							return { error: true, code: 422, message: "Anda terlambat atau berada di luar radius lokasi. Kolom keterangan wajib diisi." };
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
							return jsonResponse(false, 400, 'NIP dan NIK salah');
						}

						const kvKey = `pegawai:${nip}`;
						const cachedPegawai = await env.PEGAWAI_KV.get(kvKey, 'json');

						// --- CACHE HIT ---
						if (cachedPegawai) {
							// Pengecekan NIK aman & cepat via WebCrypto SHA-256 / plain
							const isPasswordMatch = await verifyNikPassword(nik, cachedPegawai.nik);
							if (isPasswordMatch) {
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

								const responseData = { access_token: jwtToken };

								return jsonResponse(true, 200, 'Login Berhasil', responseData);
							} else {
								// NIK tidak cocok. Biarkan PWA fallback ke server utama.
								console.log(`[Login Cache] NIK mismatch for NIP: ${nip}. Treating as Cache MISS.`);
							}
						}

						// --- CACHE MISS atau NIK mismatch setelah cache invalidation ---
						console.log(`[Login Cache] Cache MISS or NIK mismatch for NIP: ${nip}. Returning 401 to PWA.`);
						// Explicitly return 401 to signal PWA to try origin
						return jsonResponse(false, 401, 'Data login tidak ditemukan di cache. Mencoba ke server utama.');

					} catch (error) {
						// Log error yang lebih detail untuk debugging di dashboard Cloudflare
						console.error('Error di login handler worker:', error.message, error.stack);
						return jsonResponse(false, 500, 'Server worker error: Gagal memproses login.');
					}
				}

				// =================================================================
				// RUTE LOGIN ADMIN (DIPANGGIL OLEH ADMIN PANEL)
				// =================================================================
				if (pathname.endsWith('/api/admin/login') && request.method === 'POST') {
					try {
						const input = await request.json();
						const username = input.username ? String(input.username).trim() : '';
						const password = input.password ? String(input.password).trim() : '';

						if (!username || !password) {
							return jsonResponse(false, 401, 'Username dan Password salah.', null);
						}

						if (!env.PEGAWAI_KV || !env.JWT_SECRET) {
							console.error("Konfigurasi worker tidak lengkap (PEGAWAI_KV, JWT_SECRET).");
							return jsonResponse(false, 500, 'Konfigurasi server worker tidak lengkap.');
						}

						const kvKey = `pegawai:${username}`;
						const cachedPegawai = await env.PEGAWAI_KV.get(kvKey, 'json');

						if (cachedPegawai && cachedPegawai.nik) {
							const isPasswordMatch = await verifyNikPassword(password, cachedPegawai.nik);

							if (isPasswordMatch) {
								let roles = ['asn'];
								if (Array.isArray(cachedPegawai.role)) {
									roles = cachedPegawai.role;
								} else if (typeof cachedPegawai.role === 'string' && cachedPegawai.role.trim() !== '') {
									roles = cachedPegawai.role.split(',').map(r => r.trim());
								}

								const hasAdminRole = roles.some(r => ['admin', 'super admin'].includes(r.toLowerCase()));
								if (!hasAdminRole) {
									return jsonResponse(false, 403, 'Hak akses ditolak.', null);
								}

								const secret = new TextEncoder().encode(env.JWT_SECRET);
								const issuedAt = Math.floor(Date.now() / 1000);
								const expirationTime = issuedAt + (3600 * 8);

								const payload = {
									iss: 'bais-pariaman-apps-admin',
									iat: issuedAt,
									exp: expirationTime,
									data: {
										username: cachedPegawai.nip,
										nama: cachedPegawai.nama_pegawai,
										role: roles
									}
								};

								const jwtToken = await new SignJWT(payload)
									.setProtectedHeader({ alg: 'HS256' })
									.setIssuedAt(issuedAt)
									.setExpirationTime(expirationTime)
									.setIssuer('bais-pariaman-apps-admin')
									.sign(secret);

								const responseData = {
									access_token: jwtToken
								};

								return jsonResponse(true, 200, 'Login Admin Berhasil', responseData);
							} else {
								return jsonResponse(false, 401, 'Username dan Password salah.', null);
							}
						}

						return jsonResponse(false, 401, 'Username atau Password salah.', null);
					} catch (e) {
						console.error('Error saat proses /api/admin/login:', e.message);
						return jsonResponse(false, 401, 'Username dan Password salah.');
					}
				}

				// =================================================================
				// RUTE GET JADWAL BY KODE (DIPANGGIL OLEH PWA UNTUK INPUT MANUAL)
				// Pola: GET /api/jadwal/:kode_akses
				// =================================================================
				const jadwalByKodeMatch = pathname.match(/^\/api\/jadwal\/([a-zA-Z0-9_.-]+)\/?$/);
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
							return jsonResponse(false, 404, 'Jadwal kegiatan tidak ditemukan atau sudah tidak berlaku untuk hari ini.', null, { 'Cache-Control': 'no-store' });
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
						return jsonResponse(true, 200, 'Jadwal kegiatan berhasil ditemukan', responseData, { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' });
					}
					// --- CACHE MISS ---
					else {
						// Jadwal tidak ditemukan di cache. Kembalikan 404 untuk memicu fallback di PWA.
						return jsonResponse(false, 404, 'Jadwal kegiatan tidak ditemukan atau sudah tidak berlaku untuk hari ini.', null, { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' });
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
						return jsonResponse(true, 200, 'List OPD berhasil diambil', cachedOpdList);
					} else {
						console.log('[OPD Cache] Cache MISS for opd_list. Returning 404 to PWA.');
						return jsonResponse(false, 404, 'Daftar OPD tidak ditemukan.', null);
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
				// RUTE PENGATURAN APLIKASI (DIPANGGIL OLEH PWA / ABSENSI CADANGAN)
				// =================================================================
				if (pathname.endsWith('/api/pengaturan/link-absensi-cadangan') || pathname.endsWith('/pengaturan/link-absensi-cadangan')) {
					const kvKey = 'pengaturan:link_absensi_cadangan';
					if (env.PENGATURAN_KV) {
						const cachedLink = await env.PENGATURAN_KV.get(kvKey);
						if (cachedLink && cachedLink.trim() !== '') {
							console.log('[Pengaturan Cache] Cache HIT for link_absensi_cadangan:', cachedLink);
							return jsonResponse(true, 200, 'Link absensi cadangan berhasil diambil.', { link_absensi_cadangan: cachedLink.trim() });
						}
					}

					// Fallback ke origin PHP server jika cache miss
					if (env.ORIGIN_API_URL) {
						try {
							console.log('[Pengaturan Cache] Cache MISS. Fetching from origin PHP...');
							const phpRes = await fetch(`${env.ORIGIN_API_URL}/pengaturan/link-absensi-cadangan?_t=${Date.now()}`);
							if (phpRes.ok) {
								const phpData = await phpRes.json();
								if (phpData && phpData.status && phpData.data && phpData.data.link_absensi_cadangan) {
									const linkVal = phpData.data.link_absensi_cadangan.trim();
									if (linkVal !== '' && env.PENGATURAN_KV) {
										// Simpan permanen seumur hidup tanpa batas waktu (no TTL)
										ctx.waitUntil(env.PENGATURAN_KV.put(kvKey, linkVal));
									}
									return jsonResponse(true, 200, 'Link absensi cadangan berhasil diambil.', { link_absensi_cadangan: linkVal });
								}
							}
						} catch (errOrigin) {
							console.error('[Pengaturan Origin Fetch Error]:', errOrigin);
						}
					}

					return jsonResponse(false, 404, 'Pengaturan link absensi cadangan tidak ditemukan di database.');
				}

				// =================================================================
				// RUTE SINKRONISASI PENGATURAN (DIPANGGIL OLEH ADMIN VIA PHP / DIRECT)
				// =================================================================
				if ((pathname.endsWith('/api/pengaturan/sync') || pathname.endsWith('/api/pengaturan')) && (request.method === 'POST' || request.method === 'PUT')) {
					if (!env.PENGATURAN_KV) {
						return jsonResponse(false, 500, 'Konfigurasi worker tidak lengkap (PENGATURAN_KV belum di-bind).');
					}

					// Validasi auth via X-Worker-Secret atau Super Admin Token
					const reqSecret = request.headers.get('X-Worker-Secret');
					let isAuthorized = (reqSecret && reqSecret === env.WORKER_SECRET);
					if (!isAuthorized) {
						const superAdminPayload = await verifySuperAdminToken(request, env);
						if (superAdminPayload) isAuthorized = true;
					}

					if (!isAuthorized) {
						return jsonResponse(false, 403, 'Akses ditolak. Hanya Super Admin atau server internal yang diizinkan.');
					}

					try {
						const settingsPayload = await request.json();
						if (settingsPayload && typeof settingsPayload === 'object') {
							for (const [key, val] of Object.entries(settingsPayload)) {
								const kvKey = `pengaturan:${key}`;
								// Simpan seumur hidup tanpa expiration / TTL
								await env.PENGATURAN_KV.put(kvKey, String(val || ''));
							}
							return jsonResponse(true, 200, 'Pengaturan aplikasi berhasil disinkronkan ke Worker KV seumur hidup.');
						} else {
							return jsonResponse(false, 400, 'Format payload pengaturan tidak valid.');
						}
					} catch (errSync) {
						return jsonResponse(false, 500, 'Gagal menyimpan pengaturan ke KV: ' + errSync.message);
					}
				}

				// =================================================================
				// RUTE HAPUS PENGATURAN KV (DIPANGGIL OLEH ADMIN VIA PHP / DIRECT)
				// Pola: DELETE /api/pengaturan/:key
				// =================================================================
				const pengaturanDelMatch = pathname.match(/^\/api\/pengaturan\/([a-zA-Z0-9_-]+)$/);
				if (pengaturanDelMatch && request.method === 'DELETE') {
					if (!env.PENGATURAN_KV) {
						return jsonResponse(false, 500, 'Konfigurasi worker tidak lengkap (PENGATURAN_KV belum di-bind).');
					}

					const reqSecret = request.headers.get('X-Worker-Secret');
					let isAuthorized = (reqSecret && reqSecret === env.WORKER_SECRET);
					if (!isAuthorized) {
						const superAdminPayload = await verifySuperAdminToken(request, env);
						if (superAdminPayload) isAuthorized = true;
					}

					if (!isAuthorized) {
						return jsonResponse(false, 403, 'Akses ditolak. Hanya Super Admin atau server internal yang diizinkan.');
					}

					try {
						const key = pengaturanDelMatch[1];
						const kvKey = `pengaturan:${key}`;
						await env.PENGATURAN_KV.delete(kvKey);
						return jsonResponse(true, 200, `Pengaturan '${key}' berhasil dihapus dari Worker KV.`);
					} catch (errDel) {
						return jsonResponse(false, 500, 'Gagal menghapus pengaturan dari KV: ' + errDel.message);
					}
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
							const status = e instanceof SyntaxError ? 400 : 500;
							const message = status === 400 ? `Gagal memproses request: ${e.message}` : `Server worker error: Gagal menyimpan data jadwal ke KV. Error: ${e.message}`;
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
							return jsonResponse(false, 500, `Server worker error: Gagal menghapus data jadwal dari KV. Error: ${e.message}`);
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
								access_token: newJwt,
							};

							return jsonResponse(true, 200, 'Token berhasil diperbarui.', responseData);
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
								access_token: newJwt
							};

							return jsonResponse(true, 200, 'Profil berhasil disinkronkan.', responseData);
						}

						// 3. Jika data tidak ada di cache (Cache MISS), panggil server PHP
						console.log(`[Profil Sync] Cache MISS untuk NIP ${nip}. Memanggil PHP untuk sinkronisasi.`);
						const cacheBuster = `?v=${Date.now()}`;
						const phpResponse = await fetch(`${env.ORIGIN_API_URL}/profil/sync${cacheBuster}`, {
							method: 'POST',
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
						const issuedAt = Math.floor(Date.now() / 1000);
						const expirationTime = issuedAt + 1800; // Berlaku 30 menit (1800 detik)
						const pegawaiNip = decodedToken?.data?.nip;

						if (!pegawaiNip) {
							return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
						}

						const bpToken = await encryptBpToken(pegawaiNip, expirationTime, env.JWT_SECRET);

						return jsonResponse(true, 200, 'Token sementara berhasil dibuat', { access_token: bpToken });

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
							const status = e instanceof SyntaxError ? 400 : 500;
							const message = status === 400 ? `Gagal memproses request: ${e.message}` : `Server worker error: Gagal menyimpan data ke KV. Error: ${e.message}`;
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
							return jsonResponse(false, 500, `Server worker error: Gagal menghapus data dari KV. Error: ${e.message}`);
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
						return jsonResponse(false, 500, `Server worker error: Gagal menyimpan sebagian atau semua data ke KV. Error: ${e.message}`);
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

						let pegawaiNip = null;
						let pegawaiNama = null;
						let pegawaiOpd = null;
						let pegawaiJabatan = null;

						if (typeof userToken === 'string' && userToken.startsWith('BP:')) {
							const decryptedBp = await decryptBpToken(userToken, env.JWT_SECRET);
							if (!decryptedBp || !decryptedBp.nip) {
								return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
							}
							pegawaiNip = decryptedBp.nip;
							if (env.PEGAWAI_KV) {
								const cachedPegawai = await env.PEGAWAI_KV.get(`pegawai:${pegawaiNip}`, 'json');
								if (cachedPegawai) {
									pegawaiNama = cachedPegawai.nama_pegawai;
									pegawaiOpd = cachedPegawai.perangkat_daerah;
									pegawaiJabatan = cachedPegawai.jabatan;
								}
							}
						} else {
							// Fallback legacy JWT / BB:
							let cleanToken = userToken;
							if (typeof cleanToken === 'string' && cleanToken.startsWith('BB:')) {
								cleanToken = cleanToken.substring(3);
							}
							try {
								const secret = new TextEncoder().encode(env.JWT_SECRET);
								const { payload: userDecoded } = await jwtVerify(cleanToken, secret, { issuer: ALLOWED_ISSUERS });
								pegawaiNip = userDecoded?.data?.nip;
								pegawaiNama = userDecoded?.data?.nama;
								pegawaiOpd = userDecoded?.data?.opd;
								pegawaiJabatan = userDecoded?.data?.jabatan;
							} catch (e) {
								return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
							}
						}

						if (!pegawaiNip) {
							return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
						}

						payload.nip = pegawaiNip;
						payload.nama = pegawaiNama || payload.nama || 'Pegawai ASN';
						payload.opd = pegawaiOpd || payload.opd || '-';
						payload.jabatan = pegawaiJabatan || payload.jabatan || '-';

						// Validasi aturan ketat (waktu dan lokasi)
						const validationError = await validateJadwalAbsen(payload.kode_akses, payload, true);
						if (validationError) {
							return jsonResponse(false, validationError.code, validationError.message);
						}

						// Hapus user_token dari payload utama agar tidak terkirim ke PHP jika ada fallback
						delete payload.user_token;

						// Buat payload untuk antrian, gunakan token user dari body dan set keterangan_verifikasi
						if (!env.MY_QUEUE) {
							console.error("Binding MY_QUEUE belum dikonfigurasi.");
							return jsonResponse(false, 500, 'Server worker error: Binding Queue belum dikonfigurasi di Cloudflare.');
						}

						const keteranganAdmin = payload.keterangan_verifikasi || payload.keterangan || 'Absensi Cepat oleh Admin';
						const queuePayload = {
							...payload,
							keterangan_verifikasi: keteranganAdmin,
							foto_base64: payload.foto_base64 || null,
							jwt_token: userToken,
							submittedAt: new Date().toISOString()
						};
						await env.MY_QUEUE.send(queuePayload);
						console.log(`[Queue Producer Absen Cepat] Enqueue presensi NIP: ${pegawaiNip || payload.nip || '-'} (Kode: ${payload.kode_akses}) ke MY_QUEUE.`);

						return jsonResponse(true, 200, 'Absensi Cepat telah diterima dan akan segera diproses.');
					} catch (error) {
						console.error('Error di fetch handler (producer absen-cepat) worker / queue limit:', error);
						return jsonResponse(false, 500, 'Server worker / Queue limit exceeded: ' + (error.message || 'Gagal memproses permintaan Absensi Cepat Anda.'));
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
					let jwtPayload;
					try {
						const { payload: decodedPayload } = await jwtVerify(token, secret, { issuer: ALLOWED_ISSUERS });
						jwtPayload = decodedPayload;
					} catch (err) {
						return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
					}

					try {
						const payload = await request.json();

						if (!payload.kode_akses || String(payload.kode_akses).trim() === '') {
							return jsonResponse(false, 422, 'Kode akses kegiatan wajib diisi.');
						}
						if (!payload.status_kehadiran || String(payload.status_kehadiran).trim() === '') {
							return jsonResponse(false, 422, 'Status kehadiran wajib dipilih.');
						}

						const userRoles = Array.isArray(jwtPayload?.data?.role)
							? jwtPayload.data.role
							: (jwtPayload?.data?.role ? [jwtPayload.data.role] : ['asn']);
						const isAdminOrSuperAdmin = userRoles.some(r => ['admin', 'super admin'].includes(String(r).trim().toLowerCase()));
						const isHadir = String(payload.status_kehadiran).toLowerCase() === 'hadir';

						// TOLAK KHUSUS CELAH 6: ASN yang mencoba kirim opsi 'Tidak Hadir' ke Worker
						if (!isAdminOrSuperAdmin && !isHadir) {
							return jsonResponse(false, 403, 'Data ditolak.');
						}

						// Isolasi identitas pegawai dari JWT jika pengirim adalah ASN (Proteksi Celah 3)
						if (!isAdminOrSuperAdmin) {
							payload.nip = jwtPayload?.data?.nip || payload.nip;
							payload.nama = jwtPayload?.data?.nama || payload.nama;
							payload.opd = jwtPayload?.data?.opd || payload.opd;
							payload.jabatan = jwtPayload?.data?.jabatan || payload.jabatan;
						}

						const isSubmittedByAdmin = isAdminOrSuperAdmin || payload.status_verifikasi === 'Terverifikasi Oleh Admin';

						const rawFoto = payload.foto_absensi || payload.foto_base64 || payload.foto || '';
						const hasFoto = Boolean(rawFoto && String(rawFoto).trim() !== '');

						if (isHadir) {
							const pLat = parseFloat(payload.lat);
							const pLng = parseFloat(payload.lng);
							const isGpsKosong = isNaN(pLat) || isNaN(pLng) || pLat === 0 || pLng === 0 || !payload.lokasi || String(payload.lokasi).trim() === '';
							if (!isSubmittedByAdmin && isGpsKosong) {
								return jsonResponse(false, 422, 'Lokasi GPS wajib diisi untuk presensi Hadir.');
							}

							if (!isSubmittedByAdmin && !hasFoto) {
								return jsonResponse(false, 422, 'Foto / bukti dukung wajib diisi.');
							}
							if (hasFoto) {
								const cleanBase64 = String(rawFoto).replace(/^data:(image|application)\/\w+;base64,/, '');
								const estimatedBytes = Math.ceil(cleanBase64.length * 3 / 4);
								if (estimatedBytes > 100 * 1024) {
									return jsonResponse(false, 422, 'Ukuran foto terlalu besar. Maksimal 100 KB.', null);
								}
							}
						}

						// Sediakan Edge Timestamping presisi
						payload.submittedAt = new Date().toISOString();

						// Validasi jadwal (waktu mulai, strict time, strict location)
						const validationError = await validateJadwalAbsen(payload.kode_akses, payload);
						if (validationError) {
							return jsonResponse(false, validationError.code, validationError.message);
						}

						if (!env.MY_QUEUE) {
							console.error("Binding MY_QUEUE belum dikonfigurasi.");
							return jsonResponse(false, 500, 'Server error. Silahkan hubungi BKPSDM Kota Pariaman.');
						}

						const queuePayload = { ...payload, jwt_token: token };
						await env.MY_QUEUE.send(queuePayload);
						console.log(`[Queue Producer] Enqueue presensi NIP: ${payload.nip || '-'} (Kode: ${payload.kode_akses}, Status: ${payload.status_kehadiran}) ke MY_QUEUE.`);

						const pesanSukses = (payload.status_verifikasi === 'Menunggu Verifikasi Admin')
							? 'Absen sudah terkirim. BKPSDM Kota Pariaman akan melakukan verifikasi absen Anda.'
							: 'Absen sudah terkirim.';

						return jsonResponse(true, 200, pesanSukses);
					} catch (error) {
						console.error('Error di fetch handler (producer) worker / queue limit:', error);
						return jsonResponse(false, 500, 'Server error. Silahkan hubungi BKPSDM Kota Pariaman.');
					}
				}

				// =================================================================
				// RUTE DLQ: DAFTAR ABSENSI ERROR (KHUSUS SUPER ADMIN)
				// =================================================================
				if (pathname === '/api/admin/queue/dlq' && request.method === 'GET') {
					const superAdminAuth = await verifySuperAdminToken(request, env);
					if (!superAdminAuth) {
						return jsonResponse(false, 403, 'Akses ditolak. Fitur ini khusus untuk Super Admin.');
					}

					if (!env.DEAD_LETTER_KV) {
						return jsonResponse(false, 500, 'DEAD_LETTER_KV belum dikonfigurasi di worker.');
					}

					const listRes = await env.DEAD_LETTER_KV.list({ prefix: 'dlq:' });
					const items = [];
					for (const keyObj of listRes.keys) {
						const raw = await env.DEAD_LETTER_KV.get(keyObj.name, 'json');
						if (raw) {
							items.push({
								key: keyObj.name,
								...raw
							});
						}
					}

					// Urutkan dari yang terbaru
					items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

					return jsonResponse(true, 200, 'Daftar absensi error berhasil diambil.', items);
				}

				// =================================================================
				// RUTE DLQ: RETRY ALL ABSENSI ERROR KE PHP ORIGIN (KHUSUS SUPER ADMIN)
				// =================================================================
				if (pathname === '/api/admin/queue/dlq/retry-all' && request.method === 'POST') {
					const superAdminAuth = await verifySuperAdminToken(request, env);
					if (!superAdminAuth) {
						return jsonResponse(false, 403, 'Akses ditolak. Fitur ini khusus untuk Super Admin.');
					}

					if (!env.DEAD_LETTER_KV) {
						return jsonResponse(false, 500, 'DEAD_LETTER_KV belum dikonfigurasi di worker.');
					}

					const targetUrl = (env.ORIGIN_API_URL ? `${env.ORIGIN_API_URL.replace(/\/$/, '')}/absen/submit` : null);
					if (!targetUrl || !env.WORKER_SECRET) {
						return jsonResponse(false, 500, 'Konfigurasi ORIGIN_API_URL atau WORKER_SECRET belum diatur.');
					}

					const listRes = await env.DEAD_LETTER_KV.list({ prefix: 'dlq:' });
					if (!listRes.keys || listRes.keys.length === 0) {
						return jsonResponse(true, 200, 'Tidak ada antrean absensi error yang perlu diproses.', { success_count: 0, failed_count: 0, remaining_count: 0 });
					}

					const dlqEntries = [];
					for (const keyObj of listRes.keys) {
						const raw = await env.DEAD_LETTER_KV.get(keyObj.name, 'json');
						if (raw && raw.body) {
							dlqEntries.push({
								key: keyObj.name,
								id: raw.id || keyObj.name,
								body: raw.body
							});
						}
					}

					if (dlqEntries.length === 0) {
						return jsonResponse(true, 200, 'Tidak ada data valid di antrean absensi error.', { success_count: 0, failed_count: 0, remaining_count: 0 });
					}

					// Kirim dalam potongan batch maksimal 10 per request ke PHP
					let totalSuccess = 0;
					let totalFailed = 0;
					const BATCH_SIZE = 10;

					for (let i = 0; i < dlqEntries.length; i += BATCH_SIZE) {
						const chunk = dlqEntries.slice(i, i + BATCH_SIZE);
						const messagesToSend = chunk.map(item => ({
							id: item.id,
							body: item.body
						}));

						try {
							const response = await fetch(targetUrl, {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
									'X-Worker-Secret': env.WORKER_SECRET
								},
								body: JSON.stringify(messagesToSend),
								signal: AbortSignal.timeout(60000)
							});

							if (response.ok) {
								const resJson = await response.json();
								const rejectedErrors = Array.isArray(resJson?.errors) ? resJson.errors : [];
								const rejectedIds = new Set(rejectedErrors.map(e => e.id));

								for (const item of chunk) {
									if (!rejectedIds.has(item.id)) {
										// SUKSES: Hapus dari KV
										await env.DEAD_LETTER_KV.delete(item.key);
										totalSuccess++;
									} else {
										// Ditolak PHP: Biarkan di KV
										totalFailed++;
									}
								}
							} else {
								// Server PHP error 5xx/4xx: Jangan hapus apapun dari chunk ini
								totalFailed += chunk.length;
								console.error(`[DLQ Replay] PHP response HTTP ${response.status}:`, await response.text());
							}
						} catch (fetchErr) {
							// Network/timeout error: Jangan hapus apapun dari chunk ini
							totalFailed += chunk.length;
							console.error(`[DLQ Replay Fetch Error]:`, fetchErr);
						}
					}

					const remainingList = await env.DEAD_LETTER_KV.list({ prefix: 'dlq:' });
					const remainingCount = remainingList.keys ? remainingList.keys.length : 0;

					return jsonResponse(true, 200, `Proses coba ulang selesai. Berhasil: ${totalSuccess}, Masih Gagal/Tersimpan: ${totalFailed}.`, {
						success_count: totalSuccess,
						failed_count: totalFailed,
						remaining_count: remainingCount
					});
				}

				// =================================================================
				// RUTE DLQ: HAPUS SATU ITEM ERROR DARI KV (KHUSUS SUPER ADMIN)
				// =================================================================
				const deleteDlqMatch = pathname.match(/^\/api\/admin\/queue\/dlq\/([^/]+)\/?$/);
				if (deleteDlqMatch && request.method === 'DELETE') {
					const superAdminAuth = await verifySuperAdminToken(request, env);
					if (!superAdminAuth) {
						return jsonResponse(false, 403, 'Akses ditolak. Fitur ini khusus untuk Super Admin.');
					}

					if (!env.DEAD_LETTER_KV) {
						return jsonResponse(false, 500, 'DEAD_LETTER_KV belum dikonfigurasi di worker.');
					}

					const targetKey = decodeURIComponent(deleteDlqMatch[1]);
					await env.DEAD_LETTER_KV.delete(targetKey);
					return jsonResponse(true, 200, 'Item absensi error berhasil dihapus.');
				}

				// Fallback untuk rute yang tidak dikenal
				return jsonResponse(false, 404, 'Endpoint tidak ditemukan di worker.');
			} catch (topLevelErr) {
				console.error("Unhandled Exception di Worker:", topLevelErr);
				return jsonResponse(false, 500, "Server worker error: " + (topLevelErr.message || "Terjadi kesalahan internal pada worker."));
			}
		},

		/**
		 * Queue handler: Berperan sebagai CONSUMER.
		 * Menerima pesan dari antrian dan meneruskannya ke server PHP origin.
		 * @param {MessageBatch} batch
		 * @param {object} env
		 * @param {ExecutionContext} ctx
		 */
		async queue(batch, env) {
			const targetUrl = (env.ORIGIN_API_URL ? `${env.ORIGIN_API_URL.replace(/\/$/, '')}/absen/submit` : null);

			if (!targetUrl || !env.WORKER_SECRET) {
				console.error("[Queue Consumer] Secrets ORIGIN_API_URL / WORKER_SECRET belum diatur.");
				batch.retryAll({ delaySeconds: 300 });
				return;
			}

			if (!batch.messages || batch.messages.length === 0) return;

			const messagesToSend = batch.messages.map(msg => ({
				id: msg.id,
				body: msg.body
			}));

			const firstAttempts = batch.messages[0]?.attempts || 1;
			const nipSummary = messagesToSend.map(m => m.body?.nip || m.body?.kode_akses || m.id).join(', ');

			console.log(`[Queue Batch] Memproses ${messagesToSend.length} pesan (Attempt #${firstAttempts}). Target: [${nipSummary}]`);

			// Beri jeda/selisih 5 detik setiap pengiriman bulk agar server PHP tidak terbebani lonjakan request
			await new Promise(resolve => setTimeout(resolve, 5000));

			let response;
			let isServerError = false;
			let errorText = '';
			let httpStatus = 500;

			try {
				response = await fetch(targetUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-Worker-Secret': env.WORKER_SECRET
					},
					body: JSON.stringify(messagesToSend),
					signal: AbortSignal.timeout(60000)
				});

				if (response.ok) {
					const responseData = await response.json();
					const sc = responseData?.data?.success_count ?? '?';
					const fc = responseData?.data?.failure_count ?? '?';
					console.log(`[Queue Batch SUKSES] Batch ${messagesToSend.length} pesan. PHP: success=${sc}, failure=${fc}, msg="${responseData?.message || '-'}". NIPs: [${nipSummary}]`);
					if (responseData.errors && responseData.errors.length > 0) {
						console.warn(`[Queue Batch Warnings] ${responseData.errors.length} pesan ditolak PHP. NIPs: [${nipSummary}]. Details:`, JSON.stringify(responseData.errors));
					}
					return;
				} else {
					isServerError = true;
					httpStatus = response.status;
					errorText = await response.text();

					if (httpStatus === 520) {
						console.error(`[Queue Gagal - Server PHP Overload HTTP 520] Server PHP tidak merespon/down. NIPs: [${nipSummary}]`);
					} else if (httpStatus >= 500) {
						console.error(`[Queue Gagal - Server PHP Error HTTP ${httpStatus}] ${errorText}. NIPs: [${nipSummary}]`);
					} else if (httpStatus >= 400) {
						console.error(`[Queue Gagal - Server PHP Ditolak HTTP ${httpStatus}] ${errorText}. NIPs: [${nipSummary}]`);
					}
				}
			} catch (error) {
				isServerError = true;
				errorText = error.message || String(error);
				httpStatus = (error.message && error.message.includes('520')) ? 520 : 504;
				console.error(`[Queue Gagal - Jaringan/Cloudflare Timeout] ${errorText}. NIPs: [${nipSummary}]`);
			}

			if (isServerError) {
				const is5xxOrNetwork = httpStatus >= 500;

				for (const msg of batch.messages) {
					const currentAttempt = msg.attempts || 1;

					if (is5xxOrNetwork) {
						// HANYA error server (5xx / 520 / network error) yang di-retry 1 menit kedepan
						if (currentAttempt >= 5) {
							console.error(`[Queue FATAL 5XX] Pesan ID ${msg.id} (NIP: ${msg.body?.nip || '-'}) telah gagal setelah 5x percobaan. Menyimpan ke DEAD_LETTER_KV...`);

							if (env.DEAD_LETTER_KV) {
								const dlqKey = `dlq:${Date.now()}:${msg.id}`;
								const dlqPayload = {
									id: msg.id,
									attempts: currentAttempt,
									http_status: httpStatus,
									error_message: errorText || 'Server PHP error atau timeout',
									created_at: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }),
									timestamp: Date.now(),
									body: msg.body
								};
								try {
									await env.DEAD_LETTER_KV.put(dlqKey, JSON.stringify(dlqPayload));
									console.log(`[Queue DEAD_LETTER_KV SIMPAN] Pesan ID ${msg.id} berhasil disimpan ke DEAD_LETTER_KV (Key: ${dlqKey}).`);
								} catch (kvErr) {
									console.error(`[Queue DEAD_LETTER_KV Gagal Simpan]`, kvErr);
								}
							}

							msg.ack();
						} else {
							console.log(`[Queue RETRY 5XX #${currentAttempt}/5] Server PHP error HTTP ${httpStatus}. Pesan ID ${msg.id} (NIP: ${msg.body?.nip || '-'}) akan dicoba ulang 1 menit lagi...`);
							msg.retry({ delaySeconds: 60 });
						}
					} else {
						// Error 4xx (Data error): simpan juga ke DLQ jika perlu inspection sebelum ack
						if (env.DEAD_LETTER_KV) {
							const dlqKey = `dlq:${Date.now()}:${msg.id}`;
							const dlqPayload = {
								id: msg.id,
								attempts: currentAttempt,
								http_status: httpStatus,
								error_message: errorText || `Ditolak PHP HTTP ${httpStatus}`,
								created_at: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }),
								timestamp: Date.now(),
								body: msg.body
							};
							try {
								await env.DEAD_LETTER_KV.put(dlqKey, JSON.stringify(dlqPayload));
							} catch (e) {}
						}
						console.warn(`[Queue DITOLAK 4XX] Pesan ID ${msg.id} (NIP: ${msg.body?.nip || '-'}) ditolak PHP dengan HTTP ${httpStatus}. Disimpan ke DLQ dan di-ack.`);
						msg.ack();
					}
				}
			}
		},
	};