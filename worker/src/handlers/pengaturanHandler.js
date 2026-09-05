import { jsonResponse } from '../utils/response.js';
import { verifySuperAdminToken } from '../utils/jwt.js';

export async function handleGetLinkAbsensiCadangan(request, env, ctx) {
	const kvKey = 'pengaturan:link_absensi_cadangan';
	if (env.PENGATURAN_KV) {
		const cachedLink = await env.PENGATURAN_KV.get(kvKey);
		if (cachedLink && cachedLink.trim() !== '') {
			console.log('[Pengaturan Cache] Cache HIT for link_absensi_cadangan:', cachedLink);
			return jsonResponse(true, 200, 'Link absensi cadangan berhasil diambil.', { link_absensi_cadangan: cachedLink.trim() });
		}
	}

	if (env.ORIGIN_API_URL) {
		try {
			console.log('[Pengaturan Cache] Cache MISS. Fetching from origin PHP...');
			const phpRes = await fetch(`${env.ORIGIN_API_URL}/pengaturan/link-absensi-cadangan?_t=${Date.now()}`);
			if (phpRes.ok) {
				const phpData = await phpRes.json();
				if (phpData && phpData.status && phpData.data && phpData.data.link_absensi_cadangan) {
					const linkVal = phpData.data.link_absensi_cadangan.trim();
					if (linkVal !== '' && env.PENGATURAN_KV) {
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

export async function handleSyncPengaturan(request, env) {
	if (request.method !== 'POST' && request.method !== 'PUT') {
		return jsonResponse(false, 405, 'Metode request yang diharapkan adalah POST atau PUT');
	}

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
		const settingsPayload = await request.json();
		if (settingsPayload && typeof settingsPayload === 'object') {
			for (const [key, val] of Object.entries(settingsPayload)) {
				const kvKey = `pengaturan:${key}`;
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

export async function handleDeletePengaturan(request, env, key) {
	if (request.method !== 'DELETE') {
		return jsonResponse(false, 405, 'Metode request yang diharapkan adalah DELETE');
	}

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
		const kvKey = `pengaturan:${key}`;
		await env.PENGATURAN_KV.delete(kvKey);
		return jsonResponse(true, 200, `Pengaturan '${key}' berhasil dihapus dari Worker KV.`);
	} catch (errDel) {
		return jsonResponse(false, 500, 'Gagal menghapus pengaturan dari KV: ' + errDel.message);
	}
}
