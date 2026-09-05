import { jwtVerify } from 'jose';
import { ALLOWED_ISSUERS } from './response.js';

/**
 * Helper untuk verifikasi JWT umum
 */
export async function verifyToken(token, secretStr) {
	if (!token || !secretStr) return null;
	try {
		const secret = new TextEncoder().encode(secretStr);
		const { payload } = await jwtVerify(token, secret, { issuer: ALLOWED_ISSUERS });
		return payload;
	} catch (e) {
		return null;
	}
}

/**
 * Helper untuk verifikasi token admin/super admin dari header Authorization
 */
export async function verifyAdminToken(request, env) {
	if (!env.JWT_SECRET) return null;
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
	const token = authHeader.substring(7);
	try {
		const secret = new TextEncoder().encode(env.JWT_SECRET);
		const { payload } = await jwtVerify(token, secret, { issuer: ALLOWED_ISSUERS });
		const userRoles = Array.isArray(payload?.data?.role) ? payload.data.role : (payload?.data?.role ? [payload.data.role] : []);
		const isAdmin = userRoles.some(r => ['admin', 'super admin'].includes(String(r).trim().toLowerCase()));
		if (!isAdmin) return null;
		return payload;
	} catch (e) {
		return null;
	}
}

/**
 * Helper untuk verifikasi token KHUSUS super admin dari header Authorization
 */
export async function verifySuperAdminToken(request, env) {
	if (!env.JWT_SECRET) return null;
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
	const token = authHeader.substring(7);
	try {
		const secret = new TextEncoder().encode(env.JWT_SECRET);
		const { payload } = await jwtVerify(token, secret, { issuer: ALLOWED_ISSUERS });
		const userRoles = Array.isArray(payload?.data?.role) ? payload.data.role : (payload?.data?.role ? [payload.data.role] : []);
		const isSuperAdmin = userRoles.some(r => String(r).trim().toLowerCase() === 'super admin');
		if (!isSuperAdmin) return null;
		return payload;
	} catch (e) {
		return null;
	}
}
