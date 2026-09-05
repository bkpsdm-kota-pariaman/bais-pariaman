import { jsonResponse } from '../utils/response.js';

export async function handleGetOpdList(request, env) {
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

export async function handleSyncOpdList(request, env) {
	if (request.method !== 'PUT') {
		return jsonResponse(false, 405, 'Metode request yang diharapkan adalah PUT');
	}

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
