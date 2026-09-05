import { jsonResponse } from '../utils/response.js';

export async function handleCrudPegawai(request, env, nip) {
	if (!env.PEGAWAI_KV || !env.WORKER_SECRET) {
		console.error("CRUD Pegawai Error: PEGAWAI_KV or WORKER_SECRET not configured.");
		return jsonResponse(false, 500, 'Konfigurasi worker tidak lengkap.');
	}

	const requestSecret = request.headers.get('X-Worker-Secret');
	if (requestSecret !== env.WORKER_SECRET) {
		return jsonResponse(false, 403, 'Akses ditolak. Invalid secret.');
	}

	const kvKey = `pegawai:${nip}`;

	if (request.method === 'PUT') {
		try {
			const pegawaiData = await request.json();
			if (!pegawaiData.nik) {
				const existing = await env.PEGAWAI_KV.get(kvKey, 'json');
				if (existing && existing.nik) {
					pegawaiData.nik = existing.nik;
				}
			}
			await env.PEGAWAI_KV.put(kvKey, JSON.stringify(pegawaiData));
			return jsonResponse(true, 200, `Cache untuk NIP ${nip} berhasil disimpan/diperbarui.`);
		} catch (e) {
			console.error(`[KV PEGAWAI PUT Error] Gagal menyimpan NIP ${nip}:`, e);
			const status = e instanceof SyntaxError ? 400 : 500;
			const message = status === 400 ? `Gagal memproses request: ${e.message}` : `Server worker error: Gagal menyimpan data ke KV. Error: ${e.message}`;
			return jsonResponse(false, status, message);
		}
	}

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

export async function handleBulkPegawai(request, env) {
	if (!env.PEGAWAI_KV || !env.WORKER_SECRET) {
		console.error("Bulk Update Pegawai Error: PEGAWAI_KV or WORKER_SECRET not configured.");
		return jsonResponse(false, 500, 'Konfigurasi worker tidak lengkap.');
	}

	const requestSecret = request.headers.get('X-Worker-Secret');
	if (requestSecret !== env.WORKER_SECRET) {
		return jsonResponse(false, 403, 'Akses ditolak. Invalid secret.');
	}

	if (request.method !== 'POST') {
		return jsonResponse(false, 405, 'Metode tidak valid untuk rute /api/pegawai/bulk. Gunakan POST.');
	}

	try {
		const pegawaiList = await request.json();
		if (!Array.isArray(pegawaiList)) {
			return jsonResponse(false, 400, 'Payload harus berupa array data pegawai.');
		}

		const validPegawai = pegawaiList.filter(p => p && p.nip);
		const CHUNK_SIZE = 50;
		for (let i = 0; i < validPegawai.length; i += CHUNK_SIZE) {
			const chunk = validPegawai.slice(i, i + CHUNK_SIZE);
			await Promise.all(chunk.map(pegawaiData => env.PEGAWAI_KV.put(`pegawai:${pegawaiData.nip}`, JSON.stringify(pegawaiData))));
		}

		return jsonResponse(true, 200, `${pegawaiList.length} data pegawai berhasil disinkronkan.`);
	} catch (e) {
		console.error(`[KV PEGAWAI BULK PUT Error] Gagal menyimpan batch:`, e);
		return jsonResponse(false, 500, `Server worker error: Gagal menyimpan sebagian atau semua data ke KV. Error: ${e.message}`);
	}
}

export async function handleTestKv(request, env, ctx) {
	if (!env.PEGAWAI_KV) {
		return jsonResponse(false, 500, "KV Namespace 'PEGAWAI_KV' tidak terkonfigurasi.");
	}

	if (request.method === 'POST') {
		try {
			const { key, value } = await request.json();
			ctx.waitUntil(env.PEGAWAI_KV.put(key, JSON.stringify(value)));
			return jsonResponse(true, 200, `OK. Data untuk kunci '${key}' sedang disimpan.`);
		} catch (e) {
			return jsonResponse(false, 400, `Gagal memproses request: ${e.message}`);
		}
	}

	if (request.method === 'GET') {
		const url = new URL(request.url);
		const key = url.searchParams.get('key');
		if (!key) {
			return jsonResponse(false, 400, "Parameter 'key' dibutuhkan.");
		}
		const value = await env.PEGAWAI_KV.get(key, 'json');
		if (value) {
			return jsonResponse(true, 200, 'Data ditemukan.', value);
		} else {
			return jsonResponse(false, 404, `Data untuk kunci '${key}' tidak ditemukan.`);
		}
	}

	return jsonResponse(false, 405, 'Metode tidak diizinkan untuk /api/test-kv. Gunakan GET atau POST.');
}
