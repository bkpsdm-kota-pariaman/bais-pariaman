/**
 * Cloudflare Worker untuk Antrian (Queue) dan Cache Login ASN
 * BAIS Pariaman
 *
 * Multi-file Architecture (Bundled via Wrangler / ESBuild)
 */

import { corsHeaders, jsonResponse } from './utils/response.js';
import { router } from './router.js';
import { handleQueueConsumer } from './handlers/queueHandler.js';

export default {
	/**
	 * Fetch handler: Menangani HTTP request dan berperan sebagai PRODUCER untuk queue.
	 * @param {Request} request
	 * @param {object} env
	 * @param {ExecutionContext} ctx
	 * @returns {Promise<Response>}
	 */
	async fetch(request, env, ctx) {
		// CORS Preflight Request
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: corsHeaders,
			});
		}

		try {
			return await router(request, env, ctx);
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
		await handleQueueConsumer(batch, env);
	}
};