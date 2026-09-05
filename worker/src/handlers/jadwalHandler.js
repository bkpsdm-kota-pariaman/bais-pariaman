import { jsonResponse } from '../utils/response.js';

export async function handleGetJadwalByKode(request, env, kodeAkses) {
	if (request.method !== 'GET') {
		return jsonResponse(false, 405, 'Metode request yang diharapkan adalah GET');
	}

	if (!env.JADWAL_KV) {
		console.error("Konfigurasi worker tidak lengkap. 'JADWAL_KV' harus diatur.");
		return jsonResponse(false, 500, 'Konfigurasi server worker tidak lengkap.');
	}

	const kvKey = `jadwal:${kodeAkses}`;
	const cachedJadwal = await env.JADWAL_KV.get(kvKey, 'json');

	if (cachedJadwal) {
		const todayYMD = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

		if (cachedJadwal.tanggal !== todayYMD) {
			return jsonResponse(false, 404, 'Jadwal kegiatan tidak ditemukan atau sudah tidak berlaku untuk hari ini.', null, { 'Cache-Control': 'no-store' });
		}

		const now = new Date();
		const startTime = new Date(`${cachedJadwal.tanggal}T${cachedJadwal.jam_mulai}+07:00`);

		if (now < startTime) {
			return jsonResponse(false, 403, `Absensi untuk kegiatan ini belum dibuka. Silakan coba lagi pada atau setelah pukul ${cachedJadwal.jam_mulai} WIB.`, null, { 'Cache-Control': 'no-store' });
		}

		const endTime = new Date(`${cachedJadwal.tanggal}T${cachedJadwal.jam_selesai}+07:00`);
		const isTerlambat = now > endTime;

		const responseData = {
			...cachedJadwal,
			is_terlambat: isTerlambat,
			server_time: now.toISOString()
		};

		return jsonResponse(true, 200, 'Jadwal kegiatan berhasil ditemukan', responseData, { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' });
	} else {
		return jsonResponse(false, 404, 'Jadwal kegiatan tidak ditemukan atau sudah tidak berlaku untuk hari ini.', null, { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' });
	}
}

export async function handleCrudJadwal(request, env, kodeAkses) {
	if (!env.JADWAL_KV || !env.WORKER_SECRET) {
		console.error("Konfigurasi worker tidak lengkap. 'JADWAL_KV' dan 'WORKER_SECRET' harus diatur.");
		return jsonResponse(false, 500, 'Konfigurasi server worker tidak lengkap.');
	}

	const requestSecret = request.headers.get('X-Worker-Secret');
	if (requestSecret !== env.WORKER_SECRET) {
		return jsonResponse(false, 403, 'Akses ditolak. Invalid secret.');
	}

	// CREATE / UPDATE
	if (request.method === 'POST' || request.method === 'PUT') {
		try {
			const jadwalData = await request.json();
			const effectiveKodeAkses = kodeAkses || jadwalData.kode_akses;
			if (!effectiveKodeAkses) {
				return jsonResponse(false, 400, 'Kode akses tidak ditemukan di URL atau payload.');
			}
			const kvKey = `jadwal:${effectiveKodeAkses}`;
			await env.JADWAL_KV.put(kvKey, JSON.stringify(jadwalData));
			return jsonResponse(true, 200, `Jadwal ${effectiveKodeAkses} berhasil disimpan/diperbarui di cache.`);
		} catch (e) {
			console.error(`[KV JADWAL PUT Error] Gagal menyimpan jadwal:`, e);
			const status = e instanceof SyntaxError ? 400 : 500;
			const message = status === 400 ? `Gagal memproses request: ${e.message}` : `Server worker error: Gagal menyimpan data jadwal ke KV. Error: ${e.message}`;
			return jsonResponse(false, status, message);
		}
	}

	// DELETE
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
