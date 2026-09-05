import { jsonResponse } from '../utils/response.js';
import { verifySuperAdminToken } from '../utils/jwt.js';

export async function handleGetDlqList(request, env) {
	if (request.method !== 'GET') {
		return jsonResponse(false, 405, 'Metode request yang diharapkan adalah GET');
	}

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

	items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

	return jsonResponse(true, 200, 'Daftar absensi error berhasil diambil.', items);
}

export async function handleRetryAllDlq(request, env) {
	if (request.method !== 'POST') {
		return jsonResponse(false, 405, 'Metode request yang diharapkan adalah POST');
	}

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
						await env.DEAD_LETTER_KV.delete(item.key);
						totalSuccess++;
					} else {
						totalFailed++;
					}
				}
			} else {
				totalFailed += chunk.length;
				console.error(`[DLQ Replay] PHP response HTTP ${response.status}:`, await response.text());
			}
		} catch (fetchErr) {
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

export async function handleDeleteDlqItem(request, env, targetKey) {
	if (request.method !== 'DELETE') {
		return jsonResponse(false, 405, 'Metode request yang diharapkan adalah DELETE');
	}

	const superAdminAuth = await verifySuperAdminToken(request, env);
	if (!superAdminAuth) {
		return jsonResponse(false, 403, 'Akses ditolak. Fitur ini khusus untuk Super Admin.');
	}

	if (!env.DEAD_LETTER_KV) {
		return jsonResponse(false, 500, 'DEAD_LETTER_KV belum dikonfigurasi di worker.');
	}

	await env.DEAD_LETTER_KV.delete(targetKey);
	return jsonResponse(true, 200, 'Item absensi error berhasil dihapus.');
}

/**
 * Queue consumer handler
 */
export async function handleQueueConsumer(batch, env) {
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
}
