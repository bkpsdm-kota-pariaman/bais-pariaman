import { jsonResponse } from './utils/response.js';
import { handleLoginAsn, handleAdminLogin, handleRefreshToken, handleProfilSync, handleGenerateTemporaryToken } from './handlers/authHandler.js';
import { handleSubmitAbsen, handleSubmitAbsenCepat } from './handlers/absenHandler.js';
import { handleGetJadwalByKode, handleCrudJadwal } from './handlers/jadwalHandler.js';
import { handleCrudPegawai, handleBulkPegawai, handleTestKv } from './handlers/pegawaiHandler.js';
import { handleGetLinkAbsensiCadangan, handleSyncPengaturan, handleDeletePengaturan } from './handlers/pengaturanHandler.js';
import { handleGetOpdList, handleSyncOpdList } from './handlers/opdHandler.js';
import { handleGetDlqList, handleRetryAllDlq, handleDeleteDlqItem } from './handlers/queueHandler.js';

export async function router(request, env, ctx) {
	const url = new URL(request.url);
	const pathname = url.pathname;

	// Auth handlers
	if (pathname.endsWith('/api/login-asn')) {
		return handleLoginAsn(request, env);
	}
	if (pathname.endsWith('/api/admin/login')) {
		return handleAdminLogin(request, env);
	}
	if (pathname.endsWith('/api/profil/refresh-token')) {
		return handleRefreshToken(request, env);
	}
	if (pathname.endsWith('/api/profil/sync')) {
		return handleProfilSync(request, env, ctx);
	}
	if (pathname.endsWith('/api/token/generate-temporary')) {
		return handleGenerateTemporaryToken(request, env);
	}

	// Absen handlers
	if (pathname.endsWith('/api/absen-cepat/submit')) {
		return handleSubmitAbsenCepat(request, env);
	}
	if (pathname.endsWith('/api/absen/submit')) {
		return handleSubmitAbsen(request, env);
	}

	// OPD handlers
	if (pathname.endsWith('/api/opd/list')) {
		return handleGetOpdList(request, env);
	}
	if (pathname.endsWith('/api/opd-list/sync')) {
		return handleSyncOpdList(request, env);
	}

	// Pengaturan handlers
	if (pathname.endsWith('/api/pengaturan/link-absensi-cadangan') || pathname.endsWith('/pengaturan/link-absensi-cadangan')) {
		return handleGetLinkAbsensiCadangan(request, env, ctx);
	}
	if (pathname.endsWith('/api/pengaturan/sync') || pathname === '/api/pengaturan') {
		return handleSyncPengaturan(request, env);
	}

	const pengaturanDelMatch = pathname.match(/^\/api\/pengaturan\/([a-zA-Z0-9_-]+)$/);
	if (pengaturanDelMatch && request.method === 'DELETE') {
		return handleDeletePengaturan(request, env, pengaturanDelMatch[1]);
	}

	// Pegawai handlers
	const pegawaiMatch = pathname.match(/^\/api\/pegawai\/(\d{18})$/);
	if (pegawaiMatch) {
		return handleCrudPegawai(request, env, pegawaiMatch[1]);
	}
	if (pathname.endsWith('/api/pegawai/bulk')) {
		return handleBulkPegawai(request, env);
	}
	if (pathname.endsWith('/api/test-kv')) {
		return handleTestKv(request, env, ctx);
	}

	// Queue / DLQ handlers
	if (pathname === '/api/admin/queue/dlq' && request.method === 'GET') {
		return handleGetDlqList(request, env);
	}
	if (pathname === '/api/admin/queue/dlq/retry-all' && request.method === 'POST') {
		return handleRetryAllDlq(request, env);
	}
	const deleteDlqMatch = pathname.match(/^\/api\/admin\/queue\/dlq\/([^/]+)\/?$/);
	if (deleteDlqMatch && request.method === 'DELETE') {
		return handleDeleteDlqItem(request, env, decodeURIComponent(deleteDlqMatch[1]));
	}

	// Jadwal handlers (GET /api/jadwal/:kode_akses vs CRUD /api/jadwal)
	const jadwalByKodeMatch = pathname.match(/^\/api\/jadwal\/([a-zA-Z0-9_.-]+)\/?$/);
	if (jadwalByKodeMatch && request.method === 'GET') {
		return handleGetJadwalByKode(request, env, jadwalByKodeMatch[1]);
	}
	const jadwalMatch = pathname.match(/^\/api\/jadwal\/?([a-zA-Z0-9_.-]+)?\/?$/);
	if (jadwalMatch) {
		return handleCrudJadwal(request, env, jadwalMatch[1]);
	}

	// Fallback 404
	return jsonResponse(false, 404, 'Endpoint tidak ditemukan di worker.');
}
