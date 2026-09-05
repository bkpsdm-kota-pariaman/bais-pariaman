export const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

export const ALLOWED_ISSUERS = ['bais-pariaman-apps', 'bais-pariaman-apps', 'bais-pariaman-apps-admin', 'bais-pariaman-apps-jadwal'];
export const DEFAULT_ISSUER = 'bais-pariaman-apps';

/**
 * Helper untuk format JSON Response terstandarisasi.
 * Selalu mengembalikan HTTP status 200 di tingkat protokol HTTP (atau 500 jika error internal),
 * agar browser tidak menampilkan log error merah di DevTools Console.
 */
export function jsonResponse(success, statusCode, message, data = null, customHeaders = {}) {
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
