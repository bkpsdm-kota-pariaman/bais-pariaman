import { jwtVerify } from 'jose';
import { jsonResponse, ALLOWED_ISSUERS } from '../utils/response.js';
import { decryptBpToken } from '../utils/crypto.js';
import { validateJadwalAbsen } from '../services/absensi.js';

export async function handleSubmitAbsen(request, env) {
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

		// Isolasi identitas pegawai dari JWT jika pengirim adalah ASN
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

		payload.submittedAt = new Date().toISOString();

		const validationError = await validateJadwalAbsen(payload.kode_akses, payload, env);
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

export async function handleSubmitAbsenCepat(request, env) {
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

	const adminToken = authHeader.substring(7);
	const secret = new TextEncoder().encode(env.JWT_SECRET);
	let decodedPayload;

	try {
		const { payload } = await jwtVerify(adminToken, secret, { issuer: ALLOWED_ISSUERS });
		decodedPayload = payload;
	} catch (err) {
		return jsonResponse(false, 401, 'Waktu login Anda sudah habis. Silahkan login ulang.');
	}

	const userRoles = Array.isArray(decodedPayload?.data?.role) ? decodedPayload.data.role : (decodedPayload?.data?.role ? [decodedPayload.data.role] : []);
	const hasAdminRole = userRoles.some(r => ['admin', 'super admin'].includes(String(r).trim().toLowerCase()));
	if (!hasAdminRole) {
		return jsonResponse(false, 403, 'Hak akses ditolak.');
	}

	try {
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

		const validationError = await validateJadwalAbsen(payload.kode_akses, payload, env, true);
		if (validationError) {
			return jsonResponse(false, validationError.code, validationError.message);
		}

		delete payload.user_token;

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
