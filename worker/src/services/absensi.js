import { haversineDistance } from '../utils/geo.js';
import { jwtVerify } from 'jose';
import { ALLOWED_ISSUERS } from '../utils/response.js';

/**
 * Helper terpusat pemroses data absensi (Mandiri / Cepat) per-record item (PRD 4.4).
 * Mengembalikan object 1:1 sesuai kolom tabel app_absensi_data_absensi.
 */
export function resolveAbsensiRecord(mode, userAuth, pegawai, jadwal, lat, lng, lokasi, foto, keteranganPegawai, keteranganVerifikasi, statusKehadiranInput = 'Hadir', statusVerifikasiInput = null) {
	const now = new Date();
	const waktuSekarang = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }) + ' ' + now.toLocaleTimeString('sv-SE', { timeZone: 'Asia/Jakarta' });
	let namaFileFoto = 'NO_PHOTO_ADMIN_FAST_INPUT.jpg';
	let statusKehadiran = statusKehadiranInput || 'Hadir';
	let statusVerifikasi = 'Terverifikasi Oleh Sistem';
	let finalKeterangan = '-';
	let finalKeteranganVerifikasi = '-';

	if (mode === 'absen_cepat') {
		const userRole = String(userAuth?.data?.role || userAuth?.role || '').toLowerCase();
		const isUserAdmin = ['admin', 'super admin', 'superadmin'].includes(userRole);
		if (!isUserAdmin) {
			const err = new Error("Akses ditolak. Fitur ini hanya untuk Admin.");
			err.code = 403;
			throw err;
		}

		const cleanVerif = String(keteranganVerifikasi || '').trim();
		if (!cleanVerif) {
			const err = new Error("Keterangan verifikasi wajib diisi oleh Admin.");
			err.code = 422;
			throw err;
		}

		statusKehadiran = statusKehadiranInput || 'Hadir';
		statusVerifikasi = statusVerifikasiInput || 'Terverifikasi Oleh Admin';
		finalKeterangan = String(keteranganPegawai || '').trim() || cleanVerif;
		finalKeteranganVerifikasi = cleanVerif;

		if (foto) {
			const ext = (typeof foto === 'string' && foto.includes('application/pdf')) ? 'pdf' : 'jpg';
			const timestamp = Math.floor(Date.now() / 1000);
			const randomHex = Math.random().toString(36).substring(2, 8);
			namaFileFoto = `${pegawai.nip || 'PEGAWAI'}_${jadwal.kode_akses || 'JADWAL'}_${timestamp}_${randomHex}.${ext}`;
		}
	} else if (mode === 'absen_mandiri') {
		if (!userAuth || (!userAuth.nip && !userAuth?.data?.nip)) {
			const err = new Error("Token tidak valid atau sesi berakhir.");
			err.code = 401;
			throw err;
		}

		if (!foto) {
			const err = new Error("Foto / bukti dukung presensi wajib diisi.");
			err.code = 422;
			throw err;
		}

		statusKehadiran = statusKehadiranInput || 'Hadir';

		if (statusKehadiran === 'Hadir') {
			const latNum = parseFloat(lat || 0);
			const lngNum = parseFloat(lng || 0);
			const lokasiClean = String(lokasi || '').trim();
			const gpsInvalid = (!latNum || !lngNum || !lokasiClean || lokasiClean.toLowerCase().includes('gps'));

			let jarakMeter = 999999;
			if (!gpsInvalid && jadwal.koordinat) {
				const parts = String(jadwal.koordinat).split(',');
				if (parts.length >= 2) {
					jarakMeter = haversineDistance(latNum, lngNum, parseFloat(parts[0].trim()), parseFloat(parts[1].trim()));
				}
			}

			const radiusMeter = parseFloat(jadwal.radius_meter || 0);
			const isLuarRadius = (gpsInvalid || (radiusMeter > 0 && jarakMeter > radiusMeter));

			let isTerlambat = false;
			if (jadwal.jam_mulai && jadwal.jam_selesai) {
				const todayYMD = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
				const startTime = new Date(`${todayYMD}T${jadwal.jam_mulai}+07:00`);
				const endTime = new Date(`${todayYMD}T${jadwal.jam_selesai}+07:00`);
				if (now < startTime || now > endTime) {
					isTerlambat = true;
				}
			}

			if (jadwal.is_strict_opd) {
				const targetOpdList = Array.isArray(jadwal.target_opd) ? jadwal.target_opd : [];
				const userOpd = String(pegawai.opd || pegawai.perangkat_daerah || '').trim();
				if (targetOpdList.length > 0 && (!userOpd || !targetOpdList.includes(userOpd))) {
					const err = new Error("Gagal: Perangkat Daerah Dibatasi. Perangkat Daerah Anda tidak terdaftar dalam target OPD kegiatan ini.");
					err.code = 403;
					throw err;
				}
			}

			if (jadwal.is_strict_time && isTerlambat) {
				const err = new Error("Presensi ditolak. Waktu presensi di luar jadwal kegiatan.");
				err.code = 422;
				throw err;
			}
			if (jadwal.is_strict_location && isLuarRadius) {
				const err = new Error("Presensi ditolak. Lokasi berada di luar radius kegiatan.");
				err.code = 422;
				throw err;
			}

			const keteranganClean = String(keteranganPegawai || '').trim();
			if (isTerlambat || isLuarRadius) {
				if (!keteranganClean) {
					const err = new Error("Anda terlambat atau berada di luar radius lokasi. Kolom keterangan wajib diisi.");
					err.code = 422;
					throw err;
				}
				finalKeterangan = keteranganClean;
				statusVerifikasi = 'Menunggu Verifikasi Admin';
			} else {
				finalKeterangan = '-';
				statusVerifikasi = 'Terverifikasi Oleh Sistem';
			}

			const ext = (typeof foto === 'string' && foto.includes('application/pdf')) ? 'pdf' : 'jpg';
			const timestamp = Math.floor(Date.now() / 1000);
			const randomHex = Math.random().toString(36).substring(2, 8);
			namaFileFoto = `${pegawai.nip}_${jadwal.kode_akses}_${timestamp}_${randomHex}.${ext}`;
		} else {
			const keteranganClean = String(keteranganPegawai || '').trim();
			if (!keteranganClean) {
				const err = new Error("Keterangan alasan tidak hadir wajib diisi.");
				err.code = 422;
				throw err;
			}

			finalKeterangan = keteranganClean;
			statusVerifikasi = 'Menunggu Verifikasi Admin';
			finalKeteranganVerifikasi = '-';

			const ext = (typeof foto === 'string' && foto.includes('application/pdf')) ? 'pdf' : 'jpg';
			const timestamp = Math.floor(Date.now() / 1000);
			const randomHex = Math.random().toString(36).substring(2, 8);
			namaFileFoto = `${pegawai.nip}_${jadwal.kode_akses}_${timestamp}_${randomHex}.${ext}`;
		}
	} else {
		const err = new Error("Mode absensi tidak dikenali.");
		err.code = 400;
		throw err;
	}

	return {
		kode_akses:            jadwal.kode_akses || '',
		nip:                   pegawai.nip || '',
		nama_pegawai:          pegawai.nama_pegawai || '',
		opd:                   pegawai.opd || pegawai.perangkat_daerah || '',
		jabatan:               pegawai.jabatan || '',
		kategori:              jadwal.kategori || '',
		waktu:                 waktuSekarang,
		lokasi:                lokasi || '-',
		lat:                   parseFloat(lat || 0),
		lng:                   parseFloat(lng || 0),
		nama_file_foto:        namaFileFoto,
		keterangan:            finalKeterangan,
		keterangan_verifikasi: finalKeteranganVerifikasi,
		status_verifikasi:     statusVerifikasi,
		status_kehadiran:      statusKehadiran
	};
}

/**
 * Validasi jadwal absensi
 */
export async function validateJadwalAbsen(kodeAkses, payload, env, isAdminCepat = false) {
	if (!kodeAkses || !env.JADWAL_KV) return null;
	const cachedJadwal = await env.JADWAL_KV.get(`jadwal:${kodeAkses}`, 'json');
	if (!cachedJadwal) return null;

	if (isAdminCepat) {
		payload.keterangan = payload.keterangan || payload.keterangan_verifikasi || 'Absensi Cepat oleh Admin';
	}

	const now = payload.submittedAt ? new Date(payload.submittedAt) : new Date();
	const todayYMD = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
	if (cachedJadwal.tanggal !== todayYMD) {
		if (todayYMD > cachedJadwal.tanggal) {
			return { error: true, code: 403, message: "Gagal: Jadwal kegiatan ini sudah berlalu." };
		} else {
			return { error: true, code: 403, message: "Gagal: Jadwal kegiatan ini belum dimulai." };
		}
	}

	const startTime = new Date(`${cachedJadwal.tanggal}T${cachedJadwal.jam_mulai}+07:00`);
	if (now < startTime) {
		return { error: true, code: 403, message: `Absensi untuk kegiatan ini belum dibuka. Silakan coba lagi pada atau setelah pukul ${String(cachedJadwal.jam_mulai).substring(0, 5)} WIB.` };
	}

	const status = (payload.status_kehadiran || "hadir").toLowerCase();
	let isTerlambat = false;
	let isLuarRadius = false;

	const endTime = new Date(`${cachedJadwal.tanggal}T${cachedJadwal.jam_selesai}+07:00`);
	if (now > endTime) {
		isTerlambat = true;
	}

	if (cachedJadwal.koordinat && cachedJadwal.koordinat !== "-") {
		const parts = cachedJadwal.koordinat.replace(/'/g, '').split(',');
		if (parts.length === 2) {
			const tLat = parseFloat(parts[0]);
			const tLng = parseFloat(parts[1]);
			const pLat = parseFloat(payload.lat);
			const pLng = parseFloat(payload.lng);
			const radius = parseFloat(cachedJadwal.radius_meter) || 0;

			const jarak = haversineDistance(pLat, pLng, tLat, tLng);
			if (jarak > radius) {
				isLuarRadius = true;
			}
		}
	}

	// Validasi QR Code Token jika dikirim
	if (payload.qr_token && String(payload.qr_token).trim() !== '') {
		try {
			const secret = new TextEncoder().encode(env.JWT_SECRET);
			await jwtVerify(payload.qr_token, secret, { issuer: ALLOWED_ISSUERS });
		} catch (e) {
			return { error: true, code: 401, message: "Token QR Code tidak valid atau sudah kedaluwarsa." };
		}
	}

	// Validasi Strict OPD khusus ASN mandiri (Absensi Cepat Admin dikecualikan)
	if (!isAdminCepat && cachedJadwal.is_strict_opd && cachedJadwal.is_strict_opd == 1) {
		const targetOpdList = Array.isArray(cachedJadwal.target_opd) ? cachedJadwal.target_opd : [];
		const userOpd = String(payload.opd || '').trim();
		if (targetOpdList.length > 0 && (!userOpd || !targetOpdList.includes(userOpd))) {
			return { error: true, code: 403, message: "Gagal: Perangkat Daerah Dibatasi. Perangkat Daerah Anda tidak terdaftar dalam target OPD kegiatan ini." };
		}
	}

	// Jika pegawai mencoba Hadir murni (bukan Izin/Sakit/Cuti)
	if (status === "hadir") {
		// Validasi Strict Time
		if (cachedJadwal.is_strict_time && cachedJadwal.is_strict_time == 1 && isTerlambat) {
			return { error: true, code: 403, message: "Gagal: Waktu Berakhir. Anda melanggar Aturan Waktu Berlaku." };
		}

		// Validasi Strict Location
		if (cachedJadwal.is_strict_location && cachedJadwal.is_strict_location == 1 && isLuarRadius) {
			return { error: true, code: 403, message: "Gagal: Di Luar Lokasi. Anda melanggar Aturan Wajib Sesuai Lokasi." };
		}

		// Jika terlambat atau luar radius, keterangan wajib diisi (khusus ASN biasa)
		if (!isAdminCepat && (isTerlambat || isLuarRadius) && (!payload.keterangan || String(payload.keterangan).trim() === '')) {
			return { error: true, code: 422, message: "Anda terlambat atau berada di luar radius lokasi. Kolom keterangan wajib diisi." };
		}
	}

	const pLat = parseFloat(payload.lat);
	const pLng = parseFloat(payload.lng);
	const isGpsError = (isNaN(pLat) || isNaN(pLng) || pLat === 0 || pLng === 0 || (payload.lokasi && payload.lokasi.toLowerCase().includes('gps')));

	// Jika pegawai terlambat, di luar lokasi, GPS error, atau tidak hadir (izin dll)
	if (status !== "hadir" || isTerlambat || isLuarRadius || isGpsError) {
		if (payload.status_verifikasi !== "Terverifikasi Oleh Admin") {
			payload.status_verifikasi = "Menunggu Verifikasi Admin";
		}
	}

	return null;
}
