import { SignJWT, jwtVerify } from 'jose';
import { jsonResponse, ALLOWED_ISSUERS, DEFAULT_ISSUER } from '../utils/response.js';
import { verifyNikPassword, encryptBpToken } from '../utils/crypto.js';

export async function handleLoginAsn(request, env) {
	if (request.method !== 'POST') {
		return jsonResponse(false, 405, 'Metode request yang diharapkan adalah POST');
	}

	if (!env.PEGAWAI_KV || !env.JWT_SECRET || !env.ORIGIN_API_URL || !env.WORKER_SECRET) {
		console.error("Konfigurasi worker tidak lengkap. 'PEGAWAI_KV', 'JWT_SECRET', 'ORIGIN_API_URL', 'WORKER_SECRET' harus diatur.");
		return jsonResponse(false, 500, 'Konfigurasi server worker tidak lengkap.');
	}

	try {
		const { nip, nik } = await request.json();
		if (!nip || !nik) {
			return jsonResponse(false, 400, 'NIP dan NIK salah');
		}

		const kvKey = `pegawai:${nip}`;
		const cachedPegawai = await env.PEGAWAI_KV.get(kvKey, 'json');

		if (cachedPegawai) {
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

				const jwtToken = await new SignJWT(payload)
					.setProtectedHeader({ alg: 'HS256' })
					.setIssuedAt(issuedAt)
					.setExpirationTime(expirationTime)
					.setIssuer(DEFAULT_ISSUER)
					.sign(secret);

				return jsonResponse(true, 200, 'Login Berhasil', { access_token: jwtToken });
			} else {
				console.log(`[Login Cache] NIK mismatch for NIP: ${nip}. Treating as Cache MISS.`);
			}
		}

		console.log(`[Login Cache] Cache MISS or NIK mismatch for NIP: ${nip}. Returning 401 to PWA.`);
		return jsonResponse(false, 401, 'Data login tidak ditemukan di cache. Mencoba ke server utama.');
	} catch (error) {
		console.error('Error di login handler worker:', error.message, error.stack);
		return jsonResponse(false, 500, 'Server worker error: Gagal memproses login.');
	}
}

export async function handleAdminLogin(request, env) {
	if (request.method !== 'POST') {
		return jsonResponse(false, 405, 'Metode request yang diharapkan adalah POST');
	}

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

				return jsonResponse(true, 200, 'Login Admin Berhasil', { access_token: jwtToken });
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

export async function handleRefreshToken(request, env) {
	if (request.method !== 'POST') {
		return jsonResponse(false, 405, 'Metode request yang diharapkan adalah POST');
	}

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

			return jsonResponse(true, 200, 'Token berhasil diperbarui.', { access_token: newJwt });
		}

		console.log(`[Profil Refresh Token] Cache MISS untuk NIP ${nip}. Memanggil PHP.`);
		const phpResponse = await fetch(`${env.ORIGIN_API_URL}/profil/refresh-token`, {
			method: 'POST',
			headers: { 'Authorization': `Bearer ${token}` },
		});

		const phpResult = await phpResponse.json();
		const isSuccess = phpResponse.ok && (phpResult.status === true || phpResult.status === 'success');
		return jsonResponse(isSuccess, phpResponse.status, phpResult.message || (isSuccess ? 'Sukses' : 'Gagal'), phpResult.data || null);

	} catch (error) {
		console.error('Error di worker /api/profil/refresh-token:', error.message, error.stack);
		return jsonResponse(false, 500, 'Server worker error: Gagal memperbarui token.');
	}
}

export async function handleProfilSync(request, env, ctx) {
	if (request.method !== 'POST') {
		return jsonResponse(false, 405, 'Metode request yang diharapkan adalah POST');
	}

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

		if (profilKv) {
			console.log(`[Profil Sync] Cache HIT untuk NIP ${nip}. Membuat token baru dari data KV.`);

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

			return jsonResponse(true, 200, 'Profil berhasil disinkronkan.', { access_token: newJwt });
		}

		console.log(`[Profil Sync] Cache MISS untuk NIP ${nip}. Memanggil PHP untuk sinkronisasi.`);
		const cacheBuster = `?v=${Date.now()}`;
		const phpResponse = await fetch(`${env.ORIGIN_API_URL}/profil/sync${cacheBuster}`, {
			method: 'POST',
			headers: { 'Authorization': `Bearer ${token}` },
		});

		const phpResult = await phpResponse.json();

		if (phpResponse.ok && phpResult.status && phpResult.data.pegawai_to_cache) {
			ctx.waitUntil(env.PEGAWAI_KV.put(kvKey, JSON.stringify(phpResult.data.pegawai_to_cache)));
			delete phpResult.data.pegawai_to_cache;
		}

		const isSuccess = phpResponse.ok && (phpResult.status === true || phpResult.status === 'success');
		return jsonResponse(isSuccess, phpResponse.status, phpResult.message || (isSuccess ? 'Sukses' : 'Gagal'), phpResult.data || null);
	} catch (error) {
		console.error('Error di worker /api/profil/sync:', error.message, error.stack);
		return jsonResponse(false, 500, 'Server worker error: Gagal memproses sinkronisasi profil.');
	}
}

export async function handleGenerateTemporaryToken(request, env) {
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
	let decodedToken;

	try {
		const { payload } = await jwtVerify(token, secret, { issuer: ALLOWED_ISSUERS });
		decodedToken = payload;
	} catch (err) {
		return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
	}

	try {
		const issuedAt = Math.floor(Date.now() / 1000);
		const expirationTime = issuedAt + 1800; // 30 menit
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
