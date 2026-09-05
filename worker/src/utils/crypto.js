/**
 * Helper Hashing WebCrypto SHA-256
 */
export async function hashSha256(text) {
	const encoder = new TextEncoder();
	const data = encoder.encode(text);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifikasi NIK / Password (SHA-256 / plaintext)
 */
export async function verifyNikPassword(input, storedNik) {
	if (!storedNik || !input) return false;
	const cleanInput = String(input).trim();
	const cleanStored = String(storedNik).trim();

	// 1. Match SHA-256 Hash (64 karakter hex)
	if (cleanStored.length === 64 && /^[0-9a-f]{64}$/i.test(cleanStored)) {
		const hashedInput = await hashSha256(cleanInput);
		return hashedInput.toLowerCase() === cleanStored.toLowerCase();
	}

	// 2. Match plain text
	if (cleanStored === cleanInput) return true;

	return false;
}

/**
 * Helper AES-256-GCM untuk Token QR Code Profil Sementara (Prefix BP:)
 */
export async function encryptBpToken(nip, exp, secretStr) {
	const encoder = new TextEncoder();
	const secretBytes = encoder.encode(secretStr);
	const keyHash = await crypto.subtle.digest('SHA-256', secretBytes);
	const key = await crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM' }, false, ['encrypt']);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const plaintext = encoder.encode(`${nip}:${exp}`);
	const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, tagLength: 128 }, key, plaintext);
	const encryptedArray = new Uint8Array(encrypted);
	const combined = new Uint8Array(iv.length + encryptedArray.length);
	combined.set(iv, 0);
	combined.set(encryptedArray, iv.length);

	let binaryString = '';
	for (let i = 0; i < combined.length; i++) {
		binaryString += String.fromCharCode(combined[i]);
	}
	const base64 = btoa(binaryString);
	const base64Url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	return 'BP:' + base64Url;
}

export async function decryptBpToken(token, secretStr) {
	if (!token || typeof token !== 'string') return null;
	if (!token.startsWith('BP:')) return null;
	try {
		const b64Url = token.substring(3);
		let b64 = b64Url.replace(/-/g, '+').replace(/_/g, '/');
		while (b64.length % 4) b64 += '=';
		const binaryStr = atob(b64);
		const combined = new Uint8Array(binaryStr.length);
		for (let i = 0; i < binaryStr.length; i++) {
			combined[i] = binaryStr.charCodeAt(i);
		}
		if (combined.length < 29) return null;
		const iv = combined.subarray(0, 12);
		const ciphertextWithTag = combined.subarray(12);

		const encoder = new TextEncoder();
		const secretBytes = encoder.encode(secretStr);
		const keyHash = await crypto.subtle.digest('SHA-256', secretBytes);
		const key = await crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM' }, false, ['decrypt']);
		const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv, tagLength: 128 }, key, ciphertextWithTag);
		const text = new TextDecoder().decode(decrypted);
		const parts = text.split(':');
		if (parts.length < 2) return null;
		const nip = parts[0];
		const exp = parseInt(parts[1], 10);
		if (Math.floor(Date.now() / 1000) > exp) return null;
		return { nip, exp };
	} catch (e) {
		return null;
	}
}

/**
 * Helper untuk mengubah data URI (base64) menjadi Blob
 */
export function dataURItoBlob(dataURI) {
	const byteString = atob(dataURI.split(',')[1]);
	const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
	const ab = new ArrayBuffer(byteString.length);
	const ia = new Uint8Array(ab);
	for (let i = 0; i < byteString.length; i++) {
		ia[i] = byteString.charCodeAt(i);
	}
	return new Blob([ab], { type: mimeString });
}
