// js/app.js

const ORIGIN_SERVER_URL = "https://api-esdm.pariamankota.go.id/bais-pariaman";
const API_BASE_URL = `${ORIGIN_SERVER_URL}/api`;
const APP_VERSION = 'v6.2.27'; // <-- EDIT VERSI APLIKASI SECARA MANUAL DI SINI

/**
 * =================================================================
 * PENGATURAN LINGKUNGAN APLIKASI (PWA)
 * =================================================================
 * Ubah ke 'beta' untuk aplikasi versi pengembangan/salinan.
 */
const APP_ENV = 'production'; // 'production' atau 'beta'

const WORKER_URL = APP_ENV === 'production'
    ? "https://absensi-kegiatan-asn-worker.bidpp-bkpsdm.workers.dev"
    : "https://absensi-kegiatan-asn-worker-dev.bidpp-bkpsdm.workers.dev";

let html5QrCode = null;
let currentJadwal = null;
let videoStream = null;
let isTerlambat = false;
let isLuarRadius = false;
let isKameraError = false;
let isGpsError = false;
let deferredPrompt = null;
let lastInvalidFileAlertKey = null;
let selfieCameraGeneration = 0;
let isSubmittingAdminCepat = false;
let refreshTokenPromise = null;

/**
 * Memigrasikan data dari localStorage (sistem lama) ke localForage (sistem baru).
 * Fungsi ini hanya berjalan sekali jika data lama ditemukan dan data baru belum ada.
 */
async function migrateStorage() {
    // Jika token sudah ada di localForage, tidak perlu migrasi.
    if (await localforage.getItem("asn_jwt_token")) {
        return;
    }

    // Cek apakah ada token di localStorage lama.
    const oldToken = localStorage.getItem("asn_jwt_token");
    if (oldToken) {
        console.log("Token lama ditemukan di localStorage, memigrasikan ke localForage...");
        try {
            // Pindahkan token
            await localforage.setItem("asn_jwt_token", oldToken);

            // Pindahkan data lain jika ada
            const keysToMigrate = ['riwayat_absen', 'list_opd', 'opd_cache_version'];
            for (const key of keysToMigrate) {
                const oldData = localStorage.getItem(key);
                if (oldData) {
                    try {
                        // Coba parse sebagai JSON, jika gagal, simpan sebagai string biasa (untuk opd_cache_version)
                        await localforage.setItem(key, JSON.parse(oldData));
                    } catch (e) {
                        await localforage.setItem(key, oldData);
                    }
                }
            }

            // Hapus semua data lama dari localStorage
            ['asn_jwt_token', 'riwayat_absen', 'list_opd', 'opd_cache_version'].forEach(k => localStorage.removeItem(k));
            console.log("Migrasi selesai, data lama dari localStorage telah dihapus.");
        } catch (e) {
            console.error("Gagal memigrasikan token:", e);
        }
    }
}

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
});
let userQrCodeInstance = null; // Untuk QR Code di modal
let qrCountdownInterval = null; // Untuk timer countdown QR
// State untuk alur absensi cepat admin
let adminCepatState = {
    jadwal: null,
    scanner: null
    // Properti untuk menyimpan parameter dari UI Absen Cepat
    // status_kehadiran: null,
    // status_verifikasi: null,
    // keterangan: null
};
let isAbsenCepatMode = false;
let isProcessingScan = false;

/**
 * =================================================================
 * Menampilkan dialog konfirmasi kepada pengguna untuk mengaktifkan service worker baru.
 * @param {ServiceWorker} newWorker - Objek service worker yang baru.
 */
function showUpdatePrompt(newWorker) {
    // Sembunyikan notifikasi toast "mengunduh" jika masih ada.
    if (window.updateToast) {
        window.updateToast.close();
        window.updateToast = null;
    }

    Swal.fire({
        title: 'Pembaruan Tersedia!',
        html: "Versi baru aplikasi telah siap. <br><strong>Muat ulang untuk mengaktifkan pembaruan.</strong>",
        icon: 'success',
        confirmButtonColor: '#b91c1c', // Menyesuaikan dengan tema merah
        confirmButtonText: 'Update Sekarang',
        allowOutsideClick: false,
        allowEscapeKey: false
    }).then((result) => {
        if (result.isConfirmed) {
            batalAbsen();
            showLoading(true, "Mengupdate aplikasi...");
            // Kirim pesan ke service worker baru untuk mengambil alih.
            newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
    });
}

function batalScan() {
    // Langsung panggil history.back() untuk meniru perilaku tombol kembali browser.
    // Event listener 'popstate' akan menangani pembersihan dan penghentian scanner.
    history.back();
}
/**
 * Memeriksa status otentikasi pengguna berdasarkan token di localForage.
 * Fungsi ini harus dijalankan SETELAH proses migrasi.
 */
async function checkAuthStatus() {
    const token = await localforage.getItem("asn_jwt_token");

    if (token) {
        // Validasi token, termasuk masa berlakunya (parameter kedua true)
        const user = parseJwt(token, true);
        if (user) {
            // Token valid, lanjutkan ke dashboard
            // Cek dan perbarui token jika akan kedaluwarsa.
            silentlyRefreshTokenIfNeeded();
            renderProfil();
            renderRiwayatLokal();

            const cachedOpdVersion = await localforage.getItem('opd_cache_version');
            const listOpdExists = await localforage.getItem('list_opd');
            if (cachedOpdVersion !== APP_VERSION || !listOpdExists) {
                // PERBAIKAN: Teruskan token yang sudah ada untuk konsistensi
                await fetchAndCacheOpdList(token);
            }

            getAppVersion();
            switchView('view-dashboard');
        } else {
            // Token tidak valid atau kedaluwarsa, paksa logout
            console.log("Token ditemukan tapi tidak valid atau kedaluwarsa, memaksa logout.");
            await forceLogout();
        }
    } else {
        // Tidak ada token sama sekali, tampilkan halaman login
        switchView('view-login');
        getAppVersion();
    }
}

// ==========================================
// 1. REGISTRASI & PROTEKSI PWA
// ==========================================
if ('serviceWorker' in navigator) {
    // Cek apakah aplikasi berjalan dalam mode PWA (standalone).
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    const isReloadingForUpdate = sessionStorage.getItem('sw_update_reloading');
    if (isReloadingForUpdate) {
        sessionStorage.removeItem('sw_update_reloading');
    }

    // Definisikan di scope window agar bisa diakses dari mana saja
    window.updateToast = null;

    navigator.serviceWorker.register(`./sw.min.js?v=${APP_VERSION}`).then(reg => {
        console.log('Service Worker terdaftar.', reg);

        // Paksa pengecekan update dari server setiap kali aplikasi dibuka
        reg.update().catch(err => console.log('Gagal update SW:', err));

        // **FIX PENTING: Mencegah update loop.**
        if (isReloadingForUpdate) {
            return;
        }

        // **FIX 1: Cek apakah service worker baru sudah menunggu.**
        if (reg.waiting) {
            console.log("Pembaruan ditemukan, service worker baru sedang menunggu.");
            showUpdatePrompt(reg.waiting);
            return;
        }

        // **FIX 2: Dengarkan event 'updatefound' untuk mendeteksi pembaruan baru.**
        reg.onupdatefound = () => {
            const newWorker = reg.installing;
            console.log("Service worker baru ditemukan, status:", newWorker.state);

            // Tampilkan notifikasi toast "mengunduh"
            if (navigator.serviceWorker.controller && !isReloadingForUpdate) {
                window.updateToast = Swal.fire({
                    toast: true,
                    position: 'bottom-end',
                    icon: 'info',
                    title: 'Pembaruan baru sedang diunduh...',
                    showConfirmButton: false,
                    timer: 8000,
                    timerProgressBar: true
                });
            }

            newWorker.onstatechange = () => {
                console.log("Status service worker baru berubah:", newWorker.state);
                if (newWorker.state === 'installed') {
                    // Jika ada controller aktif, berarti ini adalah pembaruan, bukan instalasi pertama.
                    if (navigator.serviceWorker.controller) {
                        console.log("Service worker baru telah di-install, menampilkan prompt.");
                        showUpdatePrompt(newWorker);
                    }
                }
            };
        };
    }).catch(error => {
        console.error('Registrasi Service Worker gagal:', error);
    });

    // Cek apakah sudah ada service worker yang mengontrol halaman saat dimuat.
    // Ini untuk membedakan antara instalasi pertama dan proses update.
    const hadController = navigator.serviceWorker.controller !== null;
    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Hanya reload jika ini adalah proses update (sudah ada controller sebelumnya),
        // bukan saat service worker pertama kali mengambil alih. Ini mencegah layar putih.
        if (refreshing || !hadController) return;
        sessionStorage.setItem('sw_update_reloading', 'true');
        refreshing = true;
        window.location.reload();
    });
}

window.addEventListener('popstate', function (event) {
    // Handler untuk tombol kembali browser.
    // Cek view mana yang sedang aktif dan panggil fungsi cleanup yang sesuai.
    if (!document.getElementById('view-scanner').classList.contains('hidden-view')) {
        tutupScanner(true); // true menandakan dipanggil dari popstate
    } else if (!document.getElementById('view-form').classList.contains('hidden-view')) {
        batalAbsen(true); // true menandakan dipanggil dari popstate
    } else if (!document.getElementById('view-admin-cepat').classList.contains('hidden-view')) {
        batalAdminCepat(true); // true menandakan dipanggil dari popstate
    } else if (!document.getElementById('view-pilih-metode').classList.contains('hidden-view')) {
        switchView('view-dashboard');
    } else if (!document.getElementById('view-input-kode').classList.contains('hidden-view')) {
        switchView('view-dashboard');
    }
});

// ==========================================
// DETEKSI SMARTPHONE & PENGECEKAN HAK AKSES
// ==========================================

let currentPermState = { gps: false, camera: false };
let permRetryCount = 0;

/**
 * Memeriksa apakah perangkat adalah smartphone (bukan laptop/desktop).
 * Juga mendeteksi jika mode desktop diaktifkan pada browser HP.
 */
function isMobileDevice() {
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isWideScreen = window.innerWidth > 1024;

    if (!isMobileUA || isWideScreen) {
        return false;
    }
    return true;
}

/**
 * Memeriksa status hak akses lokasi (GPS) dan kamera.
 */
async function checkHardwarePermissions() {
    let gpsGranted = false;
    let camGranted = false;

    if (navigator.permissions && navigator.permissions.query) {
        try {
            const geoRes = await navigator.permissions.query({ name: 'geolocation' });
            gpsGranted = (geoRes.state === 'granted');
        } catch (e) { }

        try {
            const camRes = await navigator.permissions.query({ name: 'camera' });
            camGranted = (camRes.state === 'granted');
        } catch (e) { }
    }

    // Fallback deteksi izin kamera via enumerateDevices (Chrome/Chromium tidak mendukung query {name: 'camera'})
    if (!camGranted && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            if (videoDevices.length > 0 && videoDevices.some(d => d.label !== '')) {
                camGranted = true;
            }
        } catch (e) { }
    }

    currentPermState = { gps: gpsGranted, camera: camGranted };
    return currentPermState;
}

/**
 * Me-render status hak akses di view-permission-check.
 */
function renderPermissionCheckView(perms) {
    const stateRequest = document.getElementById('perm-state-request');
    const stateFallback = document.getElementById('perm-state-fallback');
    const cameraStatus = document.getElementById('perm-camera-status');
    const gpsStatus = document.getElementById('perm-gps-status');

    if (!stateRequest || !stateFallback) return;

    const updateStatus = (element, granted) => {
        if (!element) return;
        element.textContent = granted ? 'Ok' : 'Belum Aktif';
        element.className = granted
            ? 'rounded-full bg-green-100 px-2.5 py-1 text-xs font-extrabold text-green-700'
            : 'rounded-full bg-red-100 px-2.5 py-1 text-xs font-extrabold text-red-700';
    };
    updateStatus(cameraStatus, perms.camera);
    updateStatus(gpsStatus, perms.gps);

    const allGranted = perms.gps && perms.camera;
    const showFallback = permRetryCount >= 2 && !allGranted;
    stateRequest.classList.toggle('hidden-view', showFallback);
    stateFallback.classList.toggle('hidden-view', !showFallback);
}

/**
 * Menangani klik tombol aktivasi kamera dan lokasi.
 */
async function cobaLagiHakAkses() {
    showLoading(true, "Klik IZINKAN/ALLOW untuk mengaktifkan lokasi & kamera...");

    if (!currentPermState.gps && 'geolocation' in navigator) {
        await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                () => { currentPermState.gps = true; resolve(); },
                async (err) => {
                    // Kode 1 = PERMISSION_DENIED. Jika bukan 1 (misal timeout 3 atau position unavailable 2), artinya izin sudah diberikan!
                    if (err && err.code !== 1) {
                        currentPermState.gps = true;
                    } else {
                        currentPermState.gps = false;
                    }
                    if (navigator.permissions && navigator.permissions.query) {
                        try {
                            const geoRes = await navigator.permissions.query({ name: 'geolocation' });
                            if (geoRes.state === 'granted') currentPermState.gps = true;
                        } catch (e) { }
                    }
                    resolve();
                },
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
            );
        });
    }

    if (!currentPermState.camera && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(t => t.stop());
            currentPermState.camera = true;
        } catch (e) {
            currentPermState.camera = false;
        }
    }

    // Re-check hardware permissions dari browser API secara keseluruhan
    const checkedPerms = await checkHardwarePermissions();
    if (checkedPerms.gps) currentPermState.gps = true;
    if (checkedPerms.camera) currentPermState.camera = true;

    permRetryCount++;
    showLoading(false);
    renderPermissionCheckView(currentPermState);

    if (currentPermState.gps && currentPermState.camera) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Hak Akses Berhasil Diizinkan!',
            showConfirmButton: false,
            timer: 1500
        });
        setTimeout(() => checkAuthStatus(), 500);
    }
}


/**
 * Mengatur visibilitas tombol INSTALL APLIKASI di halaman login.
 * Hanya muncul saat dibuka via browser biasa (bukan PWA standalone).
 */
function updateInstallButtonVisibility() {
    const btnInstall = document.getElementById('btnInstallInLogin');
    if (!btnInstall) return;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
        btnInstall.classList.add('hidden-view');
    } else {
        btnInstall.classList.remove('hidden-view');
    }
}

/**
 * Memicu prompt instalasi PWA dari halaman login.
 */
async function triggerPwaInstallFromLogin() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);
        deferredPrompt = null;
    } else {
        Swal.fire({
            title: 'Konfirmasi Instalasi',
            html: "Apakah jendela/pesan untuk meng-install aplikasi <b>muncul di layar Anda?</b>",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#16a34a',
            cancelButtonColor: '#b91c1c',
            confirmButtonText: 'Ya, Muncul',
            cancelButtonText: 'Tidak, Bantu Saya',
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire('Bagus!', 'Silakan ikuti petunjuk instalasi dari perangkat Anda untuk menyelesaikan.', 'info');
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                tampilkanTutorialManual();
            }
        });
    }
}
window.triggerPwaInstallFromLogin = triggerPwaInstallFromLogin;

window.onload = async () => {
    try {
        // Konfigurasi localForage. Nama database sekarang dinamis berdasarkan APP_ENV.
        // Ini akan membuat database terpisah untuk versi produksi dan beta.
        localforage.config({
            name: `EabsenPariamanDB_${APP_ENV}`, // Contoh: EabsenPariamanDB_production atau EabsenPariamanDB_beta
            storeName: 'app_storage',
            description: 'Penyimpanan persisten untuk aplikasi BAIS Pariaman.',
        });

        await migrateStorage(); // Jalankan migrasi sebelum cek status

        // 1. Wajib dibuka dari Smartphone / HP (bukan Laptop/Desktop)
        if (!isMobileDevice()) {
            switchView('view-desktop-denied');
            return;
        }

        // 2. Update visibilitas tombol install PWA di login
        updateInstallButtonVisibility();

        // 3. Pengecekan hak akses hardware (GPS & Kamera)
        const perms = await checkHardwarePermissions();
        if (perms.gps && perms.camera) {
            // Hak akses sudah OK sejak awal, langsung skip ke login / dashboard
            await checkAuthStatus();
        } else {
            // Tampilkan view pengecekan hak akses jika ada izin yang belum diberikan
            renderPermissionCheckView(perms);
            switchView('view-permission-check');
        }
    } catch (error) {
        console.error("Fatal error during app startup:", error);
        // Tampilkan pesan error yang jelas kepada pengguna jika terjadi kesalahan fatal.
        // Ini mencegah layar putih kosong (white screen of death).
        const body = document.querySelector('body');
        if (body) {
            body.innerHTML = `<div style="padding: 20px; text-align: center; font-family: sans-serif; color: #333;">
                <h1 style="color: #d9534f;">Aplikasi Gagal Dimuat</h1>
                <p>Terjadi kesalahan kritis saat memulai aplikasi. Hal ini bisa terjadi karena data korup setelah pembaruan.</p>
                <p><strong>Solusi:</strong> Coba bersihkan data aplikasi dari pengaturan browser Anda, lalu buka kembali aplikasi.</p>
                <hr>
                <p style="font-size: 0.8em; color: #777;">Detail Error: ${error.message}</p>
            </div>`;
        }
    } finally {
        // Apapun yang terjadi, sembunyikan overlay loading untuk menampilkan konten atau pesan error.
        showLoading(false);
    }
}


document.addEventListener('visibilitychange', () => {
    // Handler untuk saat pengguna mengganti tab atau meminimalkan browser.
    // Ini penting untuk menghemat resource dan mematikan kamera.
    if (document.visibilityState === 'hidden') {
        // Cek apakah scanner QR sedang berjalan di view-scanner
        const scannerView = document.getElementById('view-scanner');
        if (html5QrCode && html5QrCode.isScanning && !scannerView.classList.contains('hidden-view')) {
            console.log("Halaman tidak terlihat, menghentikan QR scanner untuk hemat resource.");
            tutupScanner(true);
        }

        // Cek apakah kamera selfie (di view-form) sedang berjalan
        const formView = document.getElementById('view-form');
        if (videoStream && !formView.classList.contains('hidden-view')) {
            console.log("Halaman tidak terlihat, membatalkan form absensi dan mematikan kamera selfie.");
            batalAbsen(true);
        }
    }
});

function switchView(viewId) {
    // Sembunyikan semua elemen view
    document.querySelectorAll('[id^="view-"]').forEach(el => {
        el.classList.add('hidden-view');
    });
    const viewToShow = document.getElementById(viewId);
    if (viewToShow) {
        viewToShow.classList.remove('hidden-view'); // Tampilkan view yang diminta
        viewToShow.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;



    // CLEANUP KAMERA: Cegah memory leak!
    // Matikan scanner QR jika bukan di view-scanner atau view-admin-cepat
    if (viewId !== 'view-scanner' && viewId !== 'view-admin-cepat') {
        if (typeof html5QrCode !== 'undefined' && html5QrCode) {
            if (html5QrCode.isScanning) {
                html5QrCode.stop().then(() => {
                    if (html5QrCode.clear) html5QrCode.clear();
                }).catch(e => console.warn("Scanner stop error", e));
            }
        }
    }

    // Matikan selfie kamera jika bukan di view-form
    if (viewId !== 'view-form') {
        if (typeof videoStream !== 'undefined' && videoStream) {
            try {
                videoStream.getTracks().forEach(track => {
                    track.stop();
                    console.log("Stopped videoStream track");
                });
            } catch (e) { }
            videoStream = null;
        }
        const v = document.getElementById('kamera');
        if (v && v.srcObject) {
            try {
                const stream = v.srcObject;
                if (stream.getTracks) {
                    stream.getTracks().forEach(track => track.stop());
                }
            } catch (e) { }
            v.srcObject = null;
        }
        // Pastikan juga mematikan semua elemen video aktif di DOM
        document.querySelectorAll('video').forEach(video => {
            if (video.srcObject) {
                try {
                    const stream = video.srcObject;
                    if (stream.getTracks) {
                        stream.getTracks().forEach(track => track.stop());
                    }
                } catch (e) { }
                video.srcObject = null;
            }
        });
        window._isHadirStarted = false;
    }

    // Tampilkan footer hanya di halaman login dan dashboard
    const appFooter = document.getElementById('app-footer');
    if (appFooter) {
        if (viewId === 'view-login' || viewId === 'view-dashboard') {
            appFooter.classList.remove('hidden-view');
        } else {
            appFooter.classList.add('hidden-view');
        }
    }
}

function tampilkanTutorialManual() {
    document.getElementById('boxTutorialManual').classList.remove('hidden-view');
    setTimeout(() => {
        document.getElementById('boxTutorialManual').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

function sembunyikanTutorialManual() {
    document.getElementById('boxTutorialManual').classList.add('hidden-view');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showLoading(show, text = "") {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    if (show) {
        if (loadingText) {
            loadingText.innerText = text;
            loadingText.classList.add('text-center', 'px-4', 'max-w-xs', 'sm:max-w-sm', 'break-words', 'leading-normal');
        }
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.classList.add('flex', 'px-6', 'text-center');
        }
    } else {
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }
    }
}

/**
 * Menampilkan pesan alert jika akses kamera atau lokasi gagal/ditolak saat penggunaan aplikasi.
 * Menyediakan tombol OK untuk kembali ke view aplikasi utama dan tombol ABSENSI CADANGAN.
 */
function tampilkanAlertAbsensiCadangan(pesan = "Gagal mengakses kamera atau lokasi.", onOkCallback = null) {
    Swal.fire({
        title: 'Akses Kamera/Lokasi Gagal',
        html: `<p class="text-sm text-gray-700 mb-2">${escapeHtml(pesan)}</p><p class="text-xs text-gray-500">Anda dapat kembali ke aplikasi utama atau beralih ke Absensi Cadangan.</p>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#b91c1c',
        cancelButtonColor: '#374151',
        confirmButtonText: 'ABSENSI CADANGAN',
        cancelButtonText: 'OK',
        reverseButtons: true
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '../absensi-cadangan/';
        } else {
            if (typeof onOkCallback === 'function') {
                onOkCallback();
            }
        }
    });
}

/**
 * Helper untuk memformat tanggal dari format 'YYYY-MM-DD HH:mm:ss' ke format Indonesia.
 * @param {string} tanggalString - String tanggal dari server.
 * @returns {string} - Tanggal yang sudah diformat.
 */
function formatTanggalWaktuIndonesia(tanggalString) {
    if (!tanggalString || typeof tanggalString !== 'string') return tanggalString;

    try {
        // PERBAIKAN: Selalu gunakan new Date() untuk parsing agar timezone (baik dari string ISO 'Z' atau string lokal) ditangani dengan benar.
        // Hapus parsing manual dengan regex yang mengabaikan informasi timezone.
        const d = new Date(tanggalString);

        // Cek jika tanggal tidak valid setelah parsing
        if (isNaN(d.getTime())) {
            return tanggalString; // Kembalikan string asli jika tidak bisa di-parse
        }

        // Gunakan toLocaleString yang akan mengkonversi ke zona waktu lokal browser pengguna.
        // Format 'id-ID' akan menghasilkan format seperti "16 Jul 2026 14.00.00"
        // .replace() digunakan untuk mengubah titik menjadi titik dua agar sesuai format jam.
        return d.toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
    } catch (e) {
        console.error("Gagal memformat tanggal:", tanggalString, e);
        return tanggalString; // Fallback jika ada error
    }
}

/**
 * Membersihkan string untuk dimasukkan dengan aman ke dalam HTML.
 * @param {string} unsafe String yang mungkin mengandung karakter HTML.
 * @returns {string} String yang sudah di-escape.
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Menampilkan versi aplikasi yang didefinisikan secara manual di variabel APP_VERSION.
 */
function getAppVersion() {
    const appVersionSpan = document.getElementById('appVersion');
    if (appVersionSpan) {
        appVersionSpan.textContent = APP_VERSION;
    }
}

/**
 * Mengembalikan objek Date yang sudah disesuaikan dengan waktu server (estimasi).
 */
function getCurrentServerTime() { return new Date(); }
// ==========================================
// 2. PARSING JWT & PROFIL LOKAL
// ==========================================
function parseJwt(token, validateExp = false) { // Add a flag
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload); // Get the full payload

        if (validateExp) {
            // exp claim is in seconds, Date.now() is in milliseconds
            const nowInSeconds = Math.floor(Date.now() / 1000);
            // Tambahkan leeway (kelonggaran) 5 detik untuk mengatasi clock skew antara server dan client.
            // Token dianggap expired jika waktu kedaluwarsanya sudah lewat lebih dari 5 detik yang lalu.
            const leeway = 5;
            if (payload.exp < (nowInSeconds - leeway)) {
                console.error(`Token JWT sudah kedaluwarsa (dengan leeway ${leeway} detik).`);
                return null; // Token expired
            }
        }

        return payload.data; // Return only the data part if valid
    } catch (e) {
        console.error("Gagal mem-parsing JWT:", e);
        return null;
    }
}

async function renderProfil() {
    const token = await localforage.getItem("asn_jwt_token");
    if (!token) return;
    const user = parseJwt(token);
    if (user) {
        document.getElementById('dashNama').innerText = user.nama || "-";
        document.getElementById('dashNip').innerText = user.nip || "-";
        document.getElementById('dashPerangkatDaerah').innerText = user.opd || "-";
        document.getElementById('dashJabatan').innerText = user.jabatan || "-";
        document.getElementById('dashJenisAsn').innerText = user.jenis_asn || "-";

        // Tampilkan menu admin jika user memiliki role 'admin' atau 'super admin'
        const adminScanButton = document.getElementById('btnAdminAbsenkanLain');
        const roles = Array.isArray(user.role) ? user.role : (typeof user.role === 'string' ? user.role.split(',') : []);
        if (roles.some(r => r.trim().toLowerCase() === 'admin' || r.trim().toLowerCase() === 'super admin')) {
            adminScanButton.classList.remove('hidden-view');
        } else {
            adminScanButton.classList.add('hidden-view');
        }
    }
}

// ==========================================
// 3. RIWAYAT ABSEN LOKAL
// ==========================================
async function simpanRiwayatLokal(judul, sesi, waktu, kodeAkses, nip) {
    if (!nip) return; // Jangan simpan jika tidak ada NIP
    let history = await localforage.getItem('riwayat_absen') || [];
    // Tambahkan NIP ke objek riwayat
    history.unshift({ judul: judul, sesi: sesi, waktu: waktu, kode: kodeAkses, nip: nip });
    // Batasi hingga 50 riwayat
    if (history.length > 50) history.splice(50);
    await localforage.setItem('riwayat_absen', history);
    renderRiwayatLokal(); // Render akan memfilter berdasarkan user yang login
}

async function renderRiwayatLokal() {
    const container = document.getElementById('listRiwayatLokal');
    if (!container) return;

    // Dapatkan NIP pengguna yang sedang login
    const token = await localforage.getItem("asn_jwt_token");
    if (!token) {
        // Jika tidak ada token (user belum login), tampilkan pesan kosong.
        container.innerHTML = '<div class="text-center text-gray-400 text-sm py-4">Login untuk melihat riwayat.</div>';
        return;
    }
    const user = parseJwt(token);
    if (!user || !user.nip) {
        container.innerHTML = '<div class="text-center text-gray-400 text-sm py-4">Gagal memuat profil.</div>';
        return;
    }
    const currentUserNip = user.nip;

    // Ambil semua riwayat dari localStorage
    let allHistory = await localforage.getItem('riwayat_absen') || [];

    // Filter riwayat untuk pengguna yang sedang login
    const userHistory = allHistory.filter(h => h.nip === currentUserNip && h.waktu);

    if (userHistory.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 text-sm py-4">Belum ada riwayat absensi lokal.</div>';
        return;
    }

    container.innerHTML = userHistory.map(h => {
        return `
            <div class="bg-gray-50 p-3 rounded-xl border border-gray-100 flex justify-between items-center text-xs shadow-sm">
                <div>
                    <h6 class="font-bold text-gray-800 truncate w-48 mb-0.5">${escapeHtml(h.judul)}</h6>
                    <span class="text-gray-500 font-medium">${formatTanggalWaktuIndonesia(h.waktu)}</span>
                </div>
                <span class="bg-green-50 text-green-700 font-bold px-2 py-1 rounded-md border border-green-200">
                    ${h.sesi || 'Hadir'}
                </span>
            </div>
        `;
    }).join('');
}

async function hapusRiwayatLokal() {
    const token = await localforage.getItem("asn_jwt_token");
    if (!token) return; // Tidak melakukan apa-apa jika tidak login
    const user = parseJwt(token);
    if (!user || !user.nip) return;
    const currentUserNip = user.nip;

    Swal.fire({
        title: 'Hapus Riwayat Lokal?',
        html: "Anda akan menghapus semua riwayat absensi <strong>Anda</strong> di perangkat ini. Riwayat pengguna lain tidak akan terpengaruh.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            let allHistory = await localforage.getItem('riwayat_absen') || [];
            const remainingHistory = allHistory.filter(h => h.nip !== currentUserNip);
            await localforage.setItem('riwayat_absen', remainingHistory);
            // Render ulang untuk menampilkan daftar yang sudah kosong
            renderRiwayatLokal();
            Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, icon: 'success', title: 'Riwayat Anda telah dibersihkan.' });
        }
    });
}

// ==========================================
// 4. API & AUTENTIKASI
// ==========================================

/**
 * Menangani logika setelah login berhasil, baik dari worker maupun server utama.
 * @param {string} token - Token JWT yang diterima.
 */
async function handleSuccessfulLogin(token) {
    await localforage.setItem("asn_jwt_token", token);
    renderProfil();
    renderRiwayatLokal();

    // Cek versi cache OPD, sama seperti di checkAuthStatus
    const cachedOpdVersion = await localforage.getItem('opd_cache_version');
    const listOpdExists = await localforage.getItem('list_opd');
    if (cachedOpdVersion !== APP_VERSION || !listOpdExists) {
        console.log("Cache OPD tidak valid atau tidak ada setelah login, mengambil data baru...");
        await fetchAndCacheOpdList(token);
    }

    switchView('view-dashboard');
}

async function prosesLogin(e) {
    if (e) e.preventDefault();
    const nip = document.getElementById('logNip').value.trim();
    const nik = document.getElementById('logNik').value.trim();
    if (!nip || !nik) return;

    showLoading(true, "Memverifikasi...");
    const payload = { nip: nip, nik: nik };

    let response;
    let res;
    try {
        try {
            // 1. Coba login via Worker
            console.log("Mencoba login via Worker...");
            response = await fetch(`${WORKER_URL}/api/login-asn?cb=${Date.now()}`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok && response.status >= 500) {
                throw new Error(`Worker web server error HTTP ${response.status}`);
            }
            res = await response.json();
            if (!res.status) {
                if (res.code === 401 || res.code >= 500) {
                    throw new Error("Worker Cache MISS / Server Error");
                }
                Swal.fire('Gagal', res.message, 'error');
                return;
            }
        } catch (workerError) {
            // 2. Jika worker gagal (error jaringan, timeout, status 500, atau Cache MISS 404), fallback ke server PHP.
            console.warn("Login via Worker gagal / Cache MISS, fallback ke server utama.", workerError.message);
            response = await fetch(`${API_BASE_URL}/login-asn?cb=${Date.now()}`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            res = await response.json();
        }

        const accessToken = res?.data?.access_token;
        if (res && res.status && accessToken) {
            await handleSuccessfulLogin(accessToken);
        } else {
            Swal.fire('Gagal', res?.message, 'error');
        }
    } catch (error) {
        console.error("Login gagal:", error);
        Swal.fire("Login Gagal", `Ada kesalahan di aplikasi, ${error.message || error}`, "error");
    } finally {
        showLoading(false);
    }
}

async function logout() {
    Swal.fire({
        title: 'Ganti akun?', text: "Apakah Anda yakin mau ganti akun?", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#16a34a', confirmButtonText: 'Ya, Ganti Akun'
    }).then(async (result) => {
        if (result.isConfirmed) {
            // Hapus hanya token login pengguna saat ini.
            // Data lain seperti riwayat pengguna lain, daftar OPD, dll, akan tetap tersimpan.
            await localforage.removeItem("asn_jwt_token");

            batalAbsen(); // Pastikan state aktif seperti kamera atau form dibersihkan sebelum logout
            switchView('view-login');
        }
    });
}

async function forceLogout() { // Dipanggil saat token expired
    // Hapus hanya token yang sudah kedaluwarsa.
    await localforage.removeItem("asn_jwt_token");

    batalAbsen(); // Pastikan state aktif seperti kamera atau form dibersihkan
    switchView('view-login');
    Swal.fire('Sesi Habis', 'Sesi login Anda sudah habis. Silakan login kembali.', 'warning');
}

/**
 * Helper untuk menambahkan query parameter cache buster agar browser tidak mengecash respon API
 */
function appendCacheBuster(url) {
    if (!url) return url;
    try {
        const urlObj = new URL(url, window.location.origin);
        if (!urlObj.searchParams.has('cb') && !urlObj.searchParams.has('_t') && !urlObj.searchParams.has('_')) {
            urlObj.searchParams.append('cb', Date.now());
        }
        return urlObj.toString();
    } catch (e) {
        const sep = url.includes('?') ? '&' : '?';
        return (url.includes('cb=') || url.includes('_t=') || url.includes('_=')) ? url : (url + sep + 'cb=' + Date.now());
    }
}

/**
 * Wrapper untuk fetch yang menyertakan token otorisasi
 * dan menangani error 401 (Unauthorized) secara otomatis.
 * @param {string} url - URL API endpoint.
 * @param {object} options - Opsi untuk fetch (method, body, dll). Opsi `token` bisa digunakan untuk override.
 * @returns {Promise<Response>} - Promise yang resolve dengan objek Response.
 */
async function fetchWithAuth(url, options = {}) {
    // Ambil token dari opsi jika disediakan, jika tidak, ambil dari localForage.
    const token = options.token || await localforage.getItem("asn_jwt_token");

    if (!token) {
        // Jika tidak ada token sama sekali, paksa logout.
        // Ini adalah tindakan pengamanan jika fungsi ini dipanggil
        // dari konteks di mana seharusnya ada token.
        forceLogout();
        throw new Error("Sesi tidak ditemukan. Harap login kembali.");
    }

    const fetchOptions = { ...options, headers: { 'Authorization': `Bearer ${token}`, ...(!(options.body instanceof FormData) && { 'Content-Type': 'application/json' }), ...options.headers, }, };
    const finalUrl = appendCacheBuster(url);
    const response = await fetch(finalUrl, fetchOptions);

    if (response.status >= 500) {
        let serverMessage = `HTTP ${response.status}`;
        try {
            const errorBody = await response.clone().json();
            serverMessage = errorBody?.message || serverMessage;
        } catch (jsonError) {
            console.error("Response server 5xx bukan JSON:", jsonError);
        }
        throw new Error(`${serverMessage} (HTTP ${response.status})`);
    }

    // Semua HTTP 4xx adalah response data/auth/business untuk ditangani caller.
    // Hanya HTTP 5xx atau kegagalan network yang boleh masuk block catch fallback.
    return response;
}

/**
 * Menangani response endpoint utama dan fallback secara konsisten.
 * @param {object} data Request utama: body, fallbackBody, token, method, headers.
 * @param {string} urlUtama Endpoint utama.
 * @param {Function} callbackSuccess Callback sukses (json, response).
 * @param {Function} callbackError Callback error (message, json, error).
 * @param {string|null} urlFallback Endpoint fallback PHP untuk error 5xx/network.
 */
async function requestWithResponseHandler(data, urlUtama, callbackSuccess, callbackError, urlFallback = null) {
    const request = data || {};
    const requestOptions = {
        method: request.method || 'POST',
        body: typeof request.body === 'function' ? request.body() : request.body,
        token: request.token,
        headers: request.headers
    };

    try {
        const response = await fetchWithAuth(urlUtama, requestOptions);
        const json = await response.json();
        if (json?.status === false && Number(json.code) >= 500) {
            throw new Error(json.message);
        }
        if (json?.status === false) return callbackError(json.message, json, null);
        return callbackSuccess(json, response);
    } catch (primaryError) {
        if (!urlFallback) return callbackError(primaryError.message, null, primaryError);
        console.warn('[PWA Fallback] Endpoint utama error 500/network, mencoba server PHP:', primaryError);
        try {
            const fallbackResponse = await fetchWithAuth(urlFallback, {
                method: request.fallbackMethod || request.method || 'POST',
                body: typeof request.fallbackBody === 'function' ? request.fallbackBody() : request.fallbackBody,
                token: request.token,
                headers: request.fallbackHeaders
            });
            const fallbackJson = await fallbackResponse.json();
            if (fallbackJson?.status) return callbackSuccess(fallbackJson, fallbackResponse);
            return callbackError(fallbackJson?.message, fallbackJson, null);
        } catch (fallbackError) {
            console.error('[PWA Fallback] Server PHP error lengkap:', fallbackError);
            return callbackError(fallbackError.message, null, fallbackError);
        }
    }
}

// Deduplicate OPD downloads in the same page and reject stale responses across tabs.
let opdCacheInFlight = null;
let opdCacheRequestStartedAt = 0;

// Fungsi untuk mengambil list OPD dari API dan menyimpannya di localStorage
async function fetchAndCacheOpdList(tokenOverride) {
    if (opdCacheInFlight) return opdCacheInFlight;

    const requestStartedAt = Date.now();
    opdCacheRequestStartedAt = Math.max(opdCacheRequestStartedAt, requestStartedAt);

    opdCacheInFlight = (async () => {
        // Gunakan token yang diberikan jika ada, jika tidak, ambil dari penyimpanan.
        const tokenToUse = tokenOverride || (await localforage.getItem('asn_jwt_token'));
        if (!tokenToUse) return;

        const saveOpdList = async (list) => {
            // Request lama, termasuk dari tab lain, tidak boleh menimpa hasil baru.
            const latestWrittenAt = await localforage.getItem('opd_cache_written_at') || 0;
            if (requestStartedAt < opdCacheRequestStartedAt || requestStartedAt < latestWrittenAt) return;
            await localforage.setItem('list_opd', list);
            await localforage.setItem('opd_cache_version', APP_VERSION);
            await localforage.setItem('opd_cache_written_at', requestStartedAt);
            console.log(`List OPD berhasil diunduh dan disimpan untuk versi ${APP_VERSION}.`);
        };

        try {
            // 1. Coba ambil dari Worker terlebih dahulu
            console.log('Mencoba mengambil daftar OPD dari Worker Cache...');
            const workerResponse = await fetch(`${WORKER_URL}/api/opd/list?cb=${Date.now()}`);
            const workerData = await workerResponse.json();
            if (workerData.status && Array.isArray(workerData.data)) {
                console.log('Berhasil mendapatkan daftar OPD dari Worker.');
                await saveOpdList(workerData.data);
                return;
            }
            throw new Error('Cache miss atau data worker tidak valid.');
        } catch (workerError) {
            // 2. Jika Worker gagal (cache miss, network error), fallback ke server utama
            console.warn('Gagal mengambil OPD dari worker, fallback ke server utama:', workerError.message);
            try {
                const originResponse = await fetchWithAuth(`${API_BASE_URL}/opd/list`, { token: tokenToUse });
                const originData = await originResponse.json();
                if (originData.status && Array.isArray(originData.data)) {
                    await saveOpdList(originData.data);
                }
            } catch (originError) {
                console.error('Gagal mengambil list OPD dari server utama:', originError);
            }
        }
    })();

    try {
        return await opdCacheInFlight;
    } finally {
        opdCacheInFlight = null;
    }
}

// ==========================================
// 5. FUNGSI KHUSUS ADMIN
// ==========================================

let ticketCountdownInterval = null;

async function generateUserQrToken() {
    const token = await localforage.getItem('asn_jwt_token');
    if (!token) return;

    showLoading(true, "Membuat E-Presensi Pass...");

    try {
        const userProfile = (await localforage.getItem('user_profile')) || {};
        const parsedData = (await parseJwt(token)) || {};

        const nama = userProfile.nama || parsedData.nama || 'Pegawai ASN';
        const nip = userProfile.nip || parsedData.nip || '-';
        const opd = userProfile.opd || parsedData.opd || '-';

        const now = new Date();
        const waktuStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        const showQrTicket = (tempToken) => {
            const elNama = document.getElementById('ticketNamaPegawai');
            const elNip = document.getElementById('ticketNipPegawai');
            const elOpd = document.getElementById('ticketOpdPegawai');
            const elWaktu = document.getElementById('ticketWaktuDibuat');
            const qrContainer = document.getElementById('ticketQrContainer');
            const countdownEl = document.getElementById('ticketCountdown');

            if (elNama) elNama.innerText = nama;
            if (elNip) elNip.innerText = `NIP: ${nip}`;
            if (elOpd) elOpd.innerText = opd;
            if (elWaktu) elWaktu.innerText = waktuStr;

            if (qrContainer) {
                qrContainer.innerHTML = '';
                new QRCode(qrContainer, {
                    text: tempToken,
                    width: 280,
                    height: 280,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            }

            switchView('view-qr-ticket');

            let timeLeft = 15;
            if (countdownEl) countdownEl.innerText = timeLeft;
            if (ticketCountdownInterval) clearInterval(ticketCountdownInterval);
            ticketCountdownInterval = setInterval(() => {
                timeLeft--;
                if (countdownEl) countdownEl.innerText = timeLeft;
                if (timeLeft <= 0) {
                    tutupQrTicketView();
                }
            }, 1000);
        };

        const callApi = async (url) => {
            const response = await fetchWithAuth(url, { method: 'POST' });
            if (!response.ok) throw new Error(`Request to ${url} failed with status ${response.status}`);
            const res = await response.json();
            const newToken = res?.data?.access_token || res?.data?.token;
            if (!res.status || !res.data || !newToken) throw new Error(res.message);
            return newToken;
        };

        try {
            console.log("Mencoba membuat QR Code via Worker...");
            const tempToken = await callApi(`${WORKER_URL}/api/token/generate-temporary`);
            showQrTicket(tempToken);
        } catch (workerError) {
            console.warn("Gagal membuat QR Code via Worker, fallback ke server utama...", workerError);
            const tempToken = await callApi(`${API_BASE_URL}/token/generate-temporary`);
            showQrTicket(tempToken);
        }
    } catch (finalError) {
        console.error("Gagal membuat QR Code.", finalError);
        Swal.fire("Gagal Membuat QR", `Ada kesalahan di aplikasi, ${finalError.message || finalError}`, "error");
    } finally {
        showLoading(false);
    }
}

function tutupQrTicketView() {
    if (ticketCountdownInterval) clearInterval(ticketCountdownInterval);
    const container = document.getElementById('ticketQrContainer');
    if (container) container.innerHTML = '';
    switchView('view-dashboard');
}

function tutupModalUserQr() {
    tutupQrTicketView();
}

function tutupModeScannerUsb() {
    const section = document.getElementById('admin-cepat-usb-section');
    if (section) section.classList.add('hidden-view');
    isAbsenCepatMode = false;
}

function playBeepSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => { });
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880; // A5 pitch
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);

        // Bersihkan AudioContext agar tidak menumpuk di memori
        setTimeout(() => {
            if (ctx && typeof ctx.close === 'function') {
                ctx.close().catch(() => { });
            }
        }, 300);
    } catch (e) {
        // Silent catch: kegagalan audio tidak boleh mengganggu alur absensi
    }
}

async function prosesInputScannerUsb(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('admin-cepat-usb-input');
    if (!input) return;
    const decodedText = input.value.trim();
    if (!decodedText) return;

    playBeepSound();
    await handleScanSuccess(decodedText);

    input.value = '';
    setTimeout(() => {
        if (input && typeof input.focus === 'function') input.focus();
    }, 150);
}

function bukaAbsenkanPegawai() {
    // Fungsi ini sekarang membuka view baru untuk alur absensi cepat oleh admin.
    switchView('view-admin-cepat');
    setupAdminCepatView();
    history.pushState({ view: 'view-admin-cepat' }, "Absensi Cepat", '#admin-cepat');
}


// ==========================================
// 5.1 ALUR ABSENSI CEPAT (ADMIN)
// ==========================================

function setupAdminCepatView() {
    // Reset state
    adminCepatState = { jadwal: null, scanner: null };

    // Reset UI
    document.getElementById('admin-cepat-kode-akses').value = '';
    document.getElementById('admin-cepat-step1').classList.remove('hidden-view');
    document.getElementById('admin-cepat-step2').classList.add('hidden-view');
    adminCepatState.scanner = null;
}

function batalAdminCepat(fromPopState = false) {
    // Jika tidak dipanggil dari popstate, lakukan navigasi kembali.
    // Jika dipanggil dari popstate, jangan panggil history.back() lagi untuk menghindari loop.
    if (!fromPopState) {
        if (location.hash === '#admin-cepat' || location.hash === '#scanner') {
            history.back();
        }
    } else {
        if (html5QrCode && html5QrCode.isScanning && isAbsenCepatMode) {
            html5QrCode.stop().catch(err => console.warn("Gagal menghentikan scanner saat batal admin cepat.", err));
        }

        // Reset semua state yang relevan
        adminCepatState = { jadwal: null, scanner: null };
        isAbsenCepatMode = false;
        isProcessingScan = false;

        switchView('view-dashboard');
    }
}

async function adminCepatCekJadwal(event) {
    if (event) event.preventDefault();
    const kodeAkses = document.getElementById('admin-cepat-kode-akses').value.trim().toUpperCase();
    if (!kodeAkses) return;

    showLoading(true, "Mengecek Jadwal...");

    try {
        // Panggil validasi server dengan flag untuk melewati pengecekan riwayat absensi lokal.
        const jadwalData = await handleServerValidation(kodeAkses, true);
        if (!jadwalData) {
            // handleServerValidation mungkin sudah menampilkan alert (misal: sudah absen),
            // jadi kita cukup keluar. Loading akan disembunyikan oleh blok finally.
            return;
        }

        adminCepatState.jadwal = jadwalData;

        // Isi detail jadwal ke UI
        document.getElementById('admin-cepat-judul').innerText = jadwalData.judul;
        document.getElementById('admin-cepat-kategori').innerText = jadwalData.kategori;
        document.getElementById('admin-cepat-kode').innerText = jadwalData.kode_akses;
        const tanggalFormatted = new Date(jadwalData.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        document.getElementById('admin-cepat-waktu').innerText = `${tanggalFormatted} (${jadwalData.jam_mulai} - ${jadwalData.jam_selesai} WIB)`;

        // Pindah ke langkah berikutnya
        document.getElementById('admin-cepat-step1').classList.add('hidden-view');
        document.getElementById('admin-cepat-step2').classList.remove('hidden-view');

    } catch (error) {
        console.error("Error saat memeriksa jadwal admin cepat:", error);
        Swal.fire("Gagal", `Ada kesalahan di aplikasi, ${error.message || error}`, "error");
    } finally {
        // Pastikan overlay loading selalu disembunyikan setelah proses selesai.
        showLoading(false);
    }
}


async function adminCepatMulaiPindai(mode = 'kamera') {
    const keterangan = document.getElementById('admin-cepat-keterangan').value.trim();
    if (!keterangan) {
        Swal.fire('Gagal', 'Keterangan wajib diisi sebelum memulai pemindaian.', 'error');
        return;
    }

    const jadwal = adminCepatState.jadwal;

    // 1. Validasi Waktu Awal
    if (jadwal.is_strict_time == 1) {
        const isTerlambatAdmin = typeof jadwal.is_terlambat !== 'undefined'
            ? Boolean(jadwal.is_terlambat)
            : (jadwal.server_time
                ? new Date(jadwal.server_time).getTime() > new Date(`${jadwal.tanggal}T${jadwal.jam_selesai}:00+07:00`).getTime()
                : Date.now() > new Date(`${jadwal.tanggal}T${jadwal.jam_selesai}:00+07:00`).getTime());
        if (isTerlambatAdmin) {
            Swal.fire('Waktu Habis', 'Kegiatan ini sudah berakhir. Absensi Cepat tidak diizinkan karena aturan Waktu Ketat (Strict Time) aktif.', 'error');
            return;
        }
    }

    // Fungsi untuk melanjutkan setelah lokasi (jika perlu) didapatkan
    const proceedToScan = () => {
        // Simpan parameter ke state
        adminCepatState.status_kehadiran = document.getElementById('admin-cepat-status-kehadiran').value;
        adminCepatState.status_verifikasi = document.getElementById('admin-cepat-status-verifikasi').value;
        const elModeFoto = document.getElementById('admin-cepat-mode-foto');
        adminCepatState.mode_foto = elModeFoto ? elModeFoto.value : 'tidak';
        adminCepatState.keterangan = keterangan;
        isAbsenCepatMode = true; // Aktifkan mode pindai cepat

        if (mode === 'usb') {
            const usbSection = document.getElementById('admin-cepat-usb-section');
            if (usbSection) usbSection.classList.remove('hidden-view');
            const usbInput = document.getElementById('admin-cepat-usb-input');
            if (usbInput) {
                usbInput.value = '';
                setTimeout(() => usbInput.focus(), 150);
            }
        } else {
            const usbSection = document.getElementById('admin-cepat-usb-section');
            if (usbSection) usbSection.classList.add('hidden-view');
            // Buka scanner utama kamera yang sudah ada
            bukaScanner(false, 'Pindai QR Profil (Absen Cepat)', false);
        }
    };

    // 2. Validasi Lokasi Awal
    if (jadwal.is_strict_location == 1) {
        showLoading(true, "Memeriksa lokasi Anda...");
        try {
            const pos = await getPreciseLocation();
            const rLat = pos.coords.latitude;
            const rLng = pos.coords.longitude;

            const [tLat, tLng] = jadwal.koordinat.replace(/'/g, '').split(',');
            const jarak = getDistanceInMeters(rLat, rLng, parseFloat(tLat), parseFloat(tLng));
            const radius = parseFloat(jadwal.radius_meter);

            showLoading(false);
            if (jarak > radius) {
                Swal.fire('Di Luar Lokasi', `Anda berada ${Math.round(jarak)} meter dari lokasi kegiatan (Maksimal ${radius}m). Absensi Cepat tidak diizinkan karena aturan Lokasi Ketat (Strict Location) aktif.`, 'error');
                return;
            }

            adminCepatState.lat = rLat;
            adminCepatState.lng = rLng;
            proceedToScan();
        } catch (e) {
            showLoading(false);
            tampilkanAlertAbsensiCadangan('Gagal mendapatkan lokasi Anda. Pastikan GPS aktif dan izin lokasi diberikan.', () => {
                switchView('view-admin-cepat');
            });
            return;
        }
    } else {
        adminCepatState.lat = 0;
        adminCepatState.lng = 0;
        proceedToScan();
    }
}

// ==========================================
// 5. PROFIL (UPDATE & REFRESH)
// ==========================================

/**
 * Memeriksa masa berlaku token dan memanggil API untuk memperbaruinya jika
 * masa berlakunya kurang dari 5 hari lagi.
 * Fungsi ini mengambil token langsung dari localForage.
 */
async function silentlyRefreshTokenIfNeeded() {
    if (refreshTokenPromise) {
        return refreshTokenPromise;
    }
    refreshTokenPromise = (async () => {
        try {
            const token = await localforage.getItem("asn_jwt_token");
            if (!token) return; // Keluar jika tidak ada token

            // Parse payload manually to get 'exp' without changing global parseJwt
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const payload = JSON.parse(jsonPayload);

            if (!payload || !payload.exp) return;

            const nowInSeconds = Math.floor(Date.now() / 1000);
            const fiveDaysInSeconds = 5 * 24 * 3600;

            // Jika token akan kedaluwarsa dalam 5 hari ke depan
            if (payload.exp < (nowInSeconds + fiveDaysInSeconds)) {
                console.log("Masa berlaku token akan segera habis, mencoba memperbarui di latar belakang...");

                let response;
                let res;
                try {
                    // 1. Coba refresh via Worker. fetchWithAuth akan mengambil token dari localForage.
                    response = await fetchWithAuth(`${WORKER_URL}/api/profil/refresh-token`, { method: 'POST' });
                    res = await response.json();
                    const newRefreshedToken = res?.data?.access_token;
                    if (!res.status || !res.data || !newRefreshedToken) throw new Error(res.message);
                } catch (workerError) {
                    // 2. Jika worker gagal, fallback ke server PHP.
                    console.warn("Refresh token via Worker gagal, fallback ke server utama.", workerError.message);
                    response = await fetchWithAuth(`${API_BASE_URL}/profil/refresh-token`, { method: 'POST' });
                    if (response.ok) {
                        res = await response.json();
                    }
                }

                const tokenToSave = res?.data?.access_token;
                if (res && res.status && res.data && tokenToSave) {
                    // Ganti token lama di localForage dengan yang baru.
                    await localforage.setItem("asn_jwt_token", tokenToSave);
                    console.log("Token berhasil diperbarui di latar belakang.");
                } else {
                    console.warn("Gagal memperbarui token di latar belakang:", res?.message);
                }
            }
        } catch (error) {
            // Abaikan semua error, jangan sampai memblokir UI.
            console.error("Terjadi error saat mencoba memperbarui token:", error);
        } finally {
            refreshTokenPromise = null;
        }
    })();
    return refreshTokenPromise;
}
async function refreshProfil() {
    const token = await localforage.getItem("asn_jwt_token");
    if (!token) return;

    const user = parseJwt(token, true); // Validasi token sebelum digunakan
    if (!user) {
        Swal.fire('Kesalahan', 'Profil lokal tidak valid. Silakan logout dan login kembali.', 'error');
        return;
    }

    showLoading(true, "Menyinkronkan...");

    try {
        let res;
        try {
            console.log("Mencoba sinkronisasi profil via Worker...");
            const response = await fetchWithAuth(`${WORKER_URL}/api/profil/sync`, { method: "POST" });
            res = await response.json();
            if (!res.status) throw new Error(res.message);
        } catch (workerError) {
            console.warn("Gagal sinkronisasi profil via Worker, fallback ke server utama:", workerError.message);
            const fallbackResponse = await fetchWithAuth(`${API_BASE_URL}/profil/sync`, { method: "POST" });
            if (!fallbackResponse.ok) {
                throw new Error(`Server utama merespon dengan status ${fallbackResponse.status}`);
            }
            res = await fallbackResponse.json();
        }

        const syncToken = res?.data?.access_token;
        if (res && res.status && res.data && syncToken) {
            await localforage.setItem("asn_jwt_token", syncToken);
            renderProfil();
            Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3500, icon: 'success', title: res.message });
        } else {
            Swal.fire('Gagal Sinkronisasi', res?.message, 'error');
        }
    } catch (finalError) {
        console.error("Error saat sinkronisasi profil (termasuk fallback):", finalError);
        Swal.fire("Gagal Sinkronisasi", `Ada kesalahan di aplikasi, ${finalError.message || finalError}`, "error");
    } finally {
        showLoading(false);
    }
}

async function bukaModalEditProfil() {
    const token = await localforage.getItem("asn_jwt_token"); if (!token) return;
    const user = parseJwt(token);
    document.getElementById('editJabatan').value = user.jabatan || "";

    // Menggunakan nilai dari hidden input jika ada (setelah pemilihan), jika tidak, gunakan dari token
    const selectedOpd = document.getElementById('editPerangkatDaerahValue').value || user.opd;
    document.getElementById('editPerangkatDaerahDisplay').querySelector('span').textContent = selectedOpd || "Pilih OPD...";
    document.getElementById('editPerangkatDaerahValue').value = selectedOpd || "";

    // Tambahkan event listener untuk membuka view pemilihan OPD
    document.getElementById('editPerangkatDaerahDisplay').onclick = bukaViewPilihOpd;

    document.getElementById('modalEditProfil').classList.remove('hidden');
}

async function bukaViewPilihOpd() {
    tutupModalEditProfil();
    switchView('view-select-opd');

    const listContainer = document.getElementById('listOpdContainer');
    const searchInput = document.getElementById('searchOpd');
    const listOpd = await localforage.getItem('list_opd') || [];

    searchInput.value = '';

    const renderList = (filter = '') => {
        listContainer.innerHTML = '';
        const filteredList = listOpd.filter(opd => opd.toLowerCase().includes(filter.toLowerCase()));

        if (filteredList.length === 0) {
            listContainer.innerHTML = `<div class="text-center text-gray-500 py-6">Tidak ada OPD yang cocok.</div>`;
            return;
        }

        filteredList.forEach(opd => {
            const opdElement = document.createElement('button');
            opdElement.className = 'w-full text-left p-4 bg-white rounded-lg shadow-sm hover:bg-blue-50 border border-gray-200 active:scale-[0.98] transition-transform';
            opdElement.textContent = opd;
            opdElement.onclick = () => pilihOpd(opd);
            listContainer.appendChild(opdElement);
        });
    };

    renderList();

    searchInput.oninput = () => renderList(searchInput.value);
}

function pilihOpd(opdName) {
    document.getElementById('editPerangkatDaerahValue').value = opdName;
    document.getElementById('editPerangkatDaerahDisplay').querySelector('span').textContent = opdName;
    kembaliKeEditProfil();
}

function tutupModalEditProfil() {
    document.getElementById('modalEditProfil').classList.add('hidden');
}

function kembaliKeEditProfil() {
    switchView('view-dashboard');
    bukaModalEditProfil();
}

async function simpanProfil(e) {
    e.preventDefault();
    const pD = document.getElementById('editPerangkatDaerahValue').value;
    const jT = document.getElementById('editJabatan').value.trim();

    showLoading(true, "Menyimpan...");
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/profil/update`, {
            method: "PUT",
            body: JSON.stringify({ perangkat_daerah: pD, jabatan: jT })
        });
        const res = await response.json();
        // PERBAIKAN: Endpoint 'update' sekarang langsung mengembalikan token baru (karena memanggil refresh() di backend).
        // Tidak perlu lagi memanggil refreshProfil() secara terpisah.
        const updatedToken = res?.data?.access_token;
        if (res.status && updatedToken) {
            tutupModalEditProfil();
            // Langsung simpan token baru yang diterima dari response
            await localforage.setItem("asn_jwt_token", updatedToken);
            // Render ulang profil di dashboard
            renderProfil();
            // Tampilkan pesan sukses dari server
            Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'success', title: res.message });
        } else {
            // Jika gagal, tampilkan pesan error dari server
            Swal.fire('Gagal', res.message, 'error');
        }
    } catch (e) {
        Swal.fire('Gagal Menyimpan', 'Tidak dapat terhubung ke server untuk menyimpan profil. Periksa koneksi internet Anda.', 'error');
    }
    showLoading(false);
}

// ==========================================
// 6. JADWAL & QR SCANNER (FLOW NORMAL & ADMIN)
// ==========================================
async function bukaScanner(isNormalFlow = false, title = 'Pindai Kode QR', showManualInput = true) {
    // Alur admin lama (adminFlowState) tidak lagi digunakan, jadi tidak perlu di-reset.
    // Atur judul dan visibilitas tombol di tampilan scanner
    const scannerTitleEl = document.querySelector('#view-scanner .scanner-title');
    if (scannerTitleEl) scannerTitleEl.innerText = title;

    history.pushState({ view: 'scanner' }, title, '#scanner');
    switchView('view-scanner');

    const cameraSelect = document.getElementById('camera-select');
    const cameraContainer = document.getElementById('camera-selection-container');

    // Jangan sembunyikan jika sudah ada isinya agar opsi tidak hilang jika getCameras gagal berikutnya
    if (cameraSelect.options.length <= 1) {
        cameraContainer.classList.add('hidden-view');
    }

    // Hentikan pemindai yang mungkin masih berjalan
    if (html5QrCode && html5QrCode.isScanning) {
        await html5QrCode.stop();
    }

    try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length) {
            let defaultCameraId = cameras[0].id;
            if (cameras.length > 1) {
                cameraContainer.classList.remove('hidden-view');
                cameraSelect.innerHTML = '';
                cameras.forEach(camera => {
                    const option = document.createElement('option');
                    option.value = camera.id;
                    option.text = camera.label || `Kamera ${cameras.indexOf(camera) + 1}`;
                    // Heuristik sederhana untuk memilih kamera belakang sebagai default
                    if (camera.label.toLowerCase().includes('back') || camera.label.toLowerCase().includes('belakang') || camera.label.toLowerCase().includes('0')) {
                        option.selected = true;
                        defaultCameraId = camera.id;
                    }
                    cameraSelect.appendChild(option);
                });
                cameraSelect.onchange = () => _startScanner(cameraSelect.value);
            }
            _startScanner(defaultCameraId);
        } else {
            _startScanner(); // Coba mulai tanpa ID kamera spesifik
        }
    } catch (err) {
        console.error("Gagal mendapatkan daftar kamera, menggunakan default.", err);
        _startScanner(); // Fallback jika getCameras gagal
    }
}

async function _startScanner(deviceId) {
    isProcessingScan = false; // Reset flag race condition saat scanner mulai baru
    // Full cleanup sebelum inisialisasi ulang scanner
    if (html5QrCode) {
        if (html5QrCode.isScanning) {
            try { await html5QrCode.stop(); } catch (e) { }
        }
        if (html5QrCode.clear) {
            try { await html5QrCode.clear(); } catch (e) { }
        }
        html5QrCode = null;
    }

    // Inisialisasi ulang setelah yang lama dihentikan
    html5QrCode = new Html5Qrcode("qr-reader");

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    const cameraToStart = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" };

    html5QrCode.start(
        cameraToStart,
        config,
        (decodedText, decodedResult) => {
            if (location.hash !== '#scanner') {
                if (html5QrCode && html5QrCode.isScanning) {
                    html5QrCode.stop().catch(e => { });
                }
                return;
            }
            handleScanSuccess(decodedText);
        },
        () => { }
    ).then(() => {
        if (location.hash !== '#scanner') {
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().catch(e => { });
            }
        }
    }).catch(err => {
        console.error("Gagal memulai pemindai QR:", err);
        tampilkanAlertAbsensiCadangan("Gagal memulai kamera untuk pemindaian. Pastikan izin kamera telah diberikan di browser/HP Anda.", () => {
            if (location.hash === '#scanner') history.back();
        });
    });
}


/**
 * Memproses teks hasil pindaian QR dan mengarahkannya ke alur yang benar.
 * @param {string} decodedText - Teks dari QR code.
 */
function handleDecodedQrText(decodedText) {
    // Keluar dari view scanner secara UI
    if (location.hash === '#scanner') {
        history.back();
    }

    const trimmed = typeof decodedText === 'string' ? decodedText.trim() : '';

    // 1. Format Baru QR Jadwal Kegiatan: BP-JADWAL:<KODE_AKSES>
    if (trimmed.startsWith("BP-JADWAL:")) {
        const kodeAkses = trimmed.replace("BP-JADWAL:", "").trim().toUpperCase();
        if (kodeAkses) {
            const elInput1 = document.getElementById('inputKodeManual');
            const elInput2 = document.getElementById('inputKodeManualScanner');
            if (elInput1) elInput1.value = kodeAkses;
            if (elInput2) elInput2.value = kodeAkses;
            prosesQrCode(kodeAkses);
            return;
        }
    }

    // 2. Format Legacy JWT Jadwal Kegiatan (kompatibilitas transisi)
    const isJadwalJwt = (trimmed.match(/\./g) || []).length === 2 && !trimmed.startsWith("BP:") && !trimmed.startsWith("BB:");
    if (isJadwalJwt) {
        prosesQrCode(trimmed);
        return;
    }

    // 3. Peringatan jika QR Profil ASN dipindai pada alur jadwal biasa
    if (trimmed.startsWith("BP:") || trimmed.startsWith("BB:")) {
        Swal.fire("Tidak Sesuai", "QR Code Profil hanya dapat digunakan pada alur 'Absen Cepat' oleh Admin.", "warning").then(batalAbsen);
        return;
    }

    // 4. QR Code tidak sesuai format jadwal
    Swal.fire("Gagal", "QR Code jadwal tidak valid.", "error").then(batalAbsen);
}

async function tutupScanner(fromPopState = false) {
    // Jika dipanggil dari tombol, gunakan history.back() untuk memicu popstate.
    if (!fromPopState && location.hash === '#scanner') {
        history.back();
        return;
    }

    // Logika inti untuk membersihkan dan beralih view.
    if (html5QrCode) {
        if (html5QrCode.isScanning) {
            await html5QrCode.stop().catch(err => console.warn("Gagal menghentikan scanner.", err));
        }
        if (html5QrCode.clear) {
            try { await html5QrCode.clear(); } catch (e) { }
        }
        html5QrCode = null;
    }

    if (isAbsenCepatMode) {
        isAbsenCepatMode = false; // Nonaktifkan mode pindai cepat.
        isProcessingScan = false; // Reset flag pemrosesan.
        // Kembali ke layar pengaturan parameter, bukan ke dashboard.
        switchView('view-admin-cepat');
    } else {
        // Alur normal kembali ke dashboard.
        switchView('view-dashboard');
    }
}


/**
 * Dispatcher utama untuk memproses QR code jadwal atau kode manual.
 * Fungsi ini menangani alur untuk pengguna normal dan admin.
 * - Jika `kodeOrJwt` adalah JWT, validasi dilakukan di PWA (client-side).
 * - Jika `kodeOrJwt` adalah kode manual, validasi dilakukan di server.
 * Ini memastikan alur validasi yang benar diterapkan secara otomatis.
 */
async function prosesQrCode(kodeOrJwt) {
    if (window._isProcessingQr) return;
    window._isProcessingQr = true;
    showLoading(true, "Memvalidasi Jadwal...");
    try {
        const isJwt = (kodeOrJwt.match(/\./g) || []).length === 2;
        let jadwalData;

        if (isJwt) {
            jadwalData = await handleJwtValidation(kodeOrJwt);
        } else {
            jadwalData = await handleServerValidation(kodeOrJwt);
        }

        // Jika validasi mengembalikan null (misal: sudah absen), hentikan proses.
        if (!jadwalData) {
            showLoading(false);
            return;
        }

        // Jika validasi berhasil, lanjutkan untuk menyiapkan form.
        await setupAbsenForm(jadwalData);
    } catch (error) {
        showLoading(false);
        console.error("Error processing QR/Code:", error);
        Swal.fire("Gagal", `Ada kesalahan di aplikasi, ${error.message || error}`, "error").then(() => {
            batalAbsen();
        });
    } finally {
        window._isProcessingQr = false;
    }
}

/**
 * Menangani validasi QR code berformat JWT di sisi klien.
 * Untuk alur admin, pengecekan riwayat absensi lokal akan dilewati.
 * @param {string} jwt - Token JWT dari QR code.
 * @returns {Promise<object|null>} Data jadwal jika valid, atau null jika sudah absen.
 */
async function handleJwtValidation(jwt) {
    const jadwalFromJwt = parseJwt(jwt, true); // Validasi masa berlaku token
    if (!jadwalFromJwt || !jadwalFromJwt.kode_akses) {
        throw new Error("QR Code jadwal tidak valid atau sudah kedaluwarsa.");
    }

    // Validasi tanggal di sisi klien untuk memberikan feedback cepat.
    const nowTime = Date.now();

    // Konversi UTC tersinkronisasi ke string tanggal Jakarta (Y-M-D)
    const jakartaDateString = new Date(nowTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    if (jakartaDateString !== jadwalFromJwt.tanggal) {
        throw new Error("Jadwal ini tidak berlaku untuk hari ini.");
    }

    // --- LOGIKA BARU: Validasi Waktu Mulai di sisi klien tersinkronisasi ---
    const eventStartStr = `${jadwalFromJwt.tanggal}T${jadwalFromJwt.jam_mulai}:00+07:00`;
    const startTime = new Date(eventStartStr).getTime();

    if (nowTime < startTime) {
        throw new Error(`Absensi untuk kegiatan ini belum dibuka. Silakan coba lagi pada atau setelah pukul ${jadwalFromJwt.jam_mulai} WIB.`);
    }

    // Alih-alih mengandalkan data dari JWT, panggil server untuk mendapatkan
    // data jadwal yang lengkap (termasuk target OPD) dan melakukan pengecekan
    // absensi ganda di sisi server. Ini membuat alur sama persis dengan
    // metode input kode manual dan memastikan data selalu up-to-date.
    return await handleServerValidation(jadwalFromJwt.kode_akses);
}

/**
 * Menangani validasi kode akses manual dengan menghubungi server.
 * Fungsi ini akan melakukan pengecekan riwayat lokal (untuk absensi mandiri)
 * dan kemudian memanggil API server yang akan memeriksa absensi ganda di database.
 * Untuk alur admin, fungsi ini akan menggunakan token milik pegawai yang diabsenkan.
 * @param {string} kode - Kode akses manual.
 * @returns {Promise<object|null>} Data jadwal jika valid, atau null jika sudah absen.
 */
async function handleServerValidation(kode, bypassHistoryCheck = false) {
    // Cek riwayat absensi lokal hanya jika tidak di-bypass (misalnya, untuk alur admin).
    if (!bypassHistoryCheck) {
        const token = await localforage.getItem("asn_jwt_token");
        const user = parseJwt(token);
        if (user && user.nip) {
            const currentUserNip = user.nip;
            const riwayatLokal = await localforage.getItem('riwayat_absen') || [];
            const sudahAbsenLokal = riwayatLokal.find(item => item.kode === kode && item.nip === currentUserNip && item.waktu);
            if (sudahAbsenLokal) {
                showLoading(false);
                Swal.fire({ icon: 'warning', title: 'Sudah Pernah Absen', html: `Anda sudah tercatat absensi untuk kegiatan ini pada:<br><b>${formatTanggalWaktuIndonesia(sudahAbsenLokal.waktu)}</b>` });
                return null;
            }
        }
    }

    const cacheBuster = `?v=${Date.now()}`;

    try {
        let response;
        let res;
        try {
            // 1. Coba ambil dari Worker
            console.log("Mencoba validasi jadwal via Worker...");
            response = await fetch(`${WORKER_URL}/api/jadwal/${kode}${cacheBuster}`);
            if (!response.ok && response.status >= 500) {
                throw new Error(`Worker web server error HTTP ${response.status}`);
            }
            res = await response.json();
            if (!res.status) {
                if (res.code === 404 || res.code >= 500) {
                    throw new Error("Worker Cache MISS");
                }
                throw new Error(res.message);
            }
        } catch (workerError) {
            if (workerError.message !== "Worker Cache MISS" && !workerError.message.includes("500") && !workerError.message.includes("Failed to fetch") && !workerError.message.includes("NetworkError") && !(workerError instanceof SyntaxError)) {
                throw workerError;
            }
            // 2. Fallback ke server utama
            console.warn(`Validasi jadwal via Worker gagal (${workerError.message}), fallback ke server utama.`);
            response = await fetchWithAuth(`${API_BASE_URL}/jadwal/${kode}${cacheBuster}`);
            if (!response.ok) throw new Error(`Server utama merespon dengan status ${response.status}`);
            res = await response.json();
            if (!res.status) {
                throw new Error(res.message);
            }
        }

        return res.data;

    } catch (error) {
        console.error("Gagal memvalidasi jadwal via worker atau origin:", error);
        if (error instanceof SyntaxError) {
            throw new Error('Jadwal tidak ditemukan atau sudah lewat jadwal.');
        }
        throw error;
    }
}


async function masukkanKodeManual() {
    batalScan();
    bukaInputKode();
}

function bukaInputKode() {
    document.getElementById('inputKodeManual').value = '';
    switchView('view-input-kode');
    history.pushState({ view: 'input-kode' }, "Input Kode", "#input-kode");
}

function prosesKodeManualInput() {
    const kode = document.getElementById('inputKodeManual').value.trim().toUpperCase();
    if (!kode) {
        Swal.fire({ icon: 'warning', title: 'Oops...', text: 'Silakan masukkan kode akses!' });
        return;
    }
    prosesQrCode(kode);
}

// ==========================================
// 7. FORM ABSEN (GPS & KAMERA)
// ==========================================
// updateConditionalFormElements moved to bottom of file

/**
 * Mengambil koordinat lokasi GPS secara presisi menggunakan watchPosition
 * agar chip GPS pada perangkat seluler sempat mengunci lokasi secara akurat.
 */
function getPreciseLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation tidak didukung oleh perangkat ini."));
            return;
        }
        let bestPosition = null;
        let watchId = null;
        let timerId = null;

        const cleanup = () => {
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            if (timerId !== null) clearTimeout(timerId);
        };

        watchId = navigator.geolocation.watchPosition(
            (pos) => {
                bestPosition = pos;
                // Jika akurasi lokasi sudah sangat presisi (<= 50 meter), langsung gunakan
                if (pos.coords.accuracy <= 50) {
                    cleanup();
                    resolve(pos);
                }
            },
            (err) => {
                cleanup();
                if (bestPosition) resolve(bestPosition);
                else reject(err);
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
        );

        // Beri jeda 3.5 detik untuk membiarkan hardware GPS mengunci lokasi terbaik
        timerId = setTimeout(() => {
            cleanup();
            if (bestPosition) {
                resolve(bestPosition);
            } else {
                // Satu percobaan fallback jika watchPosition tidak memberikan respon awal
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 4000
                });
            }
        }, 3500);
    });
}

async function cekLokasiOtomatis() {
    const stGeo = document.getElementById('statusGeo');
    const boxGagal = document.getElementById('boxLokasiGagal');
    const stGeoLoading = document.getElementById('statusGeoLoading');

    const targetKodeAkses = currentJadwal ? currentJadwal.kode_akses : null;

    // Hide failure box and show loading status
    if (boxGagal) boxGagal.classList.add('hidden-view');
    if (stGeo) stGeo.classList.add('hidden-view');
    if (stGeoLoading) stGeoLoading.classList.remove('hidden-view');

    if (!navigator.geolocation) {
        if (stGeoLoading) stGeoLoading.classList.add('hidden-view');
        if (stGeo) stGeo.classList.add('hidden-view');
        if (boxGagal) boxGagal.classList.remove('hidden-view');
        return;
    }

    try {
        const pos = await getPreciseLocation();
        stGeoLoading.classList.add('hidden-view'); // Sembunyikan loading besar
        stGeo.classList.remove('hidden-view'); // Tampilkan div hasil
        const rLat = pos.coords.latitude;
        const rLng = pos.coords.longitude;
        document.getElementById('lat').value = rLat;
        document.getElementById('lng').value = rLng;

        // Mulai proses reverse geocoding untuk mendapatkan alamat
        stGeo.innerHTML = `<span class="inline-block animate-spin mr-1">↻</span> Menerjemahkan alamat...`;
        stGeo.className = "bg-blue-50 text-blue-700 py-2 px-4 rounded-lg text-xs font-bold border border-blue-200";
        const alamat = await getAlamatFromKoordinat(rLat, rLng);

        // Cegah race condition jika user telah membatalkan atau berganti form jadwal saat geocoding berjalan
        if (!currentJadwal || currentJadwal.kode_akses !== targetKodeAkses) return;

        document.getElementById('alamat').value = alamat;

        if (currentJadwal.koordinat && currentJadwal.koordinat !== "-") {
            const [tLat, tLng] = currentJadwal.koordinat.replace(/'/g, '').split(',');
            const jarak = getDistanceInMeters(rLat, rLng, parseFloat(tLat), parseFloat(tLng));
            const radius = parseFloat(currentJadwal.radius_meter);

            if (jarak > radius) {
                stGeo.className = "bg-red-50 text-red-700 py-2 px-4 rounded-lg text-xs font-bold border border-red-200";
                stGeo.innerHTML = `Luar Batas (${Math.round(jarak)}m). <br><small class="font-normal">${alamat}</small>`;
                isLuarRadius = true;
                if (currentJadwal.is_strict_location == 1) {
                    Swal.fire({
                        title: 'Di Luar Lokasi',
                        text: `Jarak Anda ${Math.round(jarak)}m (Batas ${radius}m). Aturan Wajib Sesuai Lokasi aktif, Anda tidak bisa mengambil absensi Hadir di Lokasi.`,
                        icon: 'error'
                    }).then(() => batalAbsen());
                    return;
                }
            } else {
                stGeo.className = "bg-green-50 text-green-700 py-2 px-4 rounded-lg text-xs font-bold border border-green-200";
                stGeo.innerHTML = `Lokasi Sesuai (${Math.round(jarak)}m). <br><small class="font-normal">${alamat}</small>`;
                isLuarRadius = false;
            }
        } else {
            stGeo.className = "bg-green-50 text-green-700 py-2 px-4 rounded-lg text-xs font-bold border border-green-200";
            stGeo.innerHTML = `Bebas Lokasi. <br><small class="font-normal">${alamat}</small>`;
            isLuarRadius = false;
        }

        // Setelah lokasi berhasil dideteksi, tampilkan sisa form (kamera, keterangan, dll).
        tampilkanFormLanjutan();
    } catch (err) {
        stGeoLoading.classList.add('hidden-view');
        stGeo.classList.add('hidden-view');
        boxGagal.classList.remove('hidden-view');

        // Selalu tampilkan tombol lanjutkan
        const btnLanjut = boxGagal.querySelector('button[onclick="lanjutTanpaLokasiValid()"]');
        if (btnLanjut) {
            btnLanjut.style.display = 'flex';
        }

        tampilkanAlertAbsensiCadangan("Sistem gagal mendeteksi lokasi GPS Anda.");
    }
}
function cleanupAbsenForm() {
    // 1. Matikan stream kamera selfie jika sedang aktif
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }

    // 2. (Tindakan defensif) Hentikan juga QR scanner jika ternyata masih aktif
    if (html5QrCode && html5QrCode.isScanning) {
        console.warn("Scanner QR dihentikan secara defensif dari cleanupAbsenForm.");
        html5QrCode.stop().catch(err => console.warn("Gagal menghentikan QR scanner dari cleanupAbsenForm.", err));
        html5QrCode = null;
    }

    // 3. Reset tampilan kamera ke kondisi awal
    ulangFoto();

    // 4. Reset state global yang berhubungan dengan form absensi
    currentJadwal = null;
    isLuarRadius = false;
    isTerlambat = false;
    isAbsenCepatMode = false;
    isProcessingScan = false;
    isKameraError = false;
    isGpsError = false;
    window._isTidakHadir = false;
    window._isHadirStarted = false;
    window._isSubmittingAbsen = false;

    // 5. Reset semua nilai input form (text, textarea, select, file, hidden)
    const resetInput = (id, val = '') => {
        const el = document.getElementById(id);
        if (el) {
            el.value = val;
            if (el.tagName === 'SELECT') {
                el.selectedIndex = 0;
            }
        }
    };

    resetInput('inputKodeManual');
    resetInput('keterangan');
    resetInput('keteranganIzin');
    resetInput('alasanIzin');
    resetInput('alasanKondisi');
    resetInput('buktiIzin');
    resetInput('buktiHadir');
    resetInput('lat');
    resetInput('lng');
    resetInput('alamat');
    resetInput('fotoBase64');

    // Reset radio button
    const radioInputs = document.querySelectorAll('input[name="tipeKehadiran"]');
    radioInputs.forEach(radio => radio.checked = false);

    // 6. Reset visibilitas & tampilan container UI form
    const addCls = (id, cls) => {
        const el = document.getElementById(id);
        if (el) el.classList.add(cls);
    };
    const remCls = (id, cls) => {
        const el = document.getElementById(id);
        if (el) el.classList.remove(cls);
    };

    addCls('flowHadir', 'hidden-view');
    addCls('flowIzin', 'hidden-view');
    addCls('form-absen-lanjutan', 'hidden-view');
    addCls('boxLokasiGagal', 'hidden-view');
    addCls('statusGeoLoading', 'hidden-view');
    addCls('statusGeo', 'hidden-view');
    addCls('boxKeterangan', 'hidden-view');
    addCls('warningMsg', 'hidden');
    addCls('warningTidakHadir', 'hidden-view');
    addCls('warningTidakHadir', 'hidden');
    addCls('inputAlasanKondisi', 'hidden');
    addCls('inputBuktiKondisi', 'hidden');
    addCls('warningIzinAtasan', 'hidden');
    remCls('opsiKehadiranAwal', 'hidden-view');

    // 7. Reset tombol kirim
    const btnKirim = document.getElementById('btnKirim');
    if (btnKirim) {
        btnKirim.disabled = true;
        btnKirim.className = "w-full bg-gray-300 text-gray-500 font-extrabold py-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2";
    }
}
async function kirimAbsensi() {
    if (window._isSubmittingAbsen) return;
    window._isSubmittingAbsen = true;

    // Ambil semua data yang dibutuhkan dari elemen form
    const b64 = document.getElementById('fotoBase64').value;
    const lat = document.getElementById('lat').value;
    const lng = document.getElementById('lng').value;
    const alamat = document.getElementById('alamat').value;
    const token = await localforage.getItem("asn_jwt_token");
    const kode = currentJadwal ? currentJadwal.kode_akses : null;
    if (!kode) {
        window._isSubmittingAbsen = false;
        return;
    }

    // Validasi Strict Mode sebelum submit
    if (currentJadwal && !window._isTidakHadir) {
        if (currentJadwal.is_strict_time == 1 && isTerlambat) {
            window._isSubmittingAbsen = false;
            Swal.fire('Waktu Berakhir', 'Aturan Waktu Berlaku aktif. Absensi Hadir tidak dapat dilakukan karena batas waktu telah lewat.', 'error');
            return;
        }
        if (currentJadwal.is_strict_location == 1 && (isLuarRadius || isGpsError)) {
            window._isSubmittingAbsen = false;
            Swal.fire('Di Luar Lokasi', 'Aturan Wajib Sesuai Lokasi aktif. Absensi Hadir tidak dapat dilakukan di luar radius atau tanpa GPS valid.', 'error');
            return;
        }
        if (currentJadwal.is_strict_opd == 1) {
            const user = token ? parseJwt(token) : null;
            const targetOpd = Array.isArray(currentJadwal.target_opd) ? currentJadwal.target_opd : [];
            if (targetOpd.length > 0 && (!user || !user.opd || !targetOpd.includes(user.opd))) {
                window._isSubmittingAbsen = false;
                const userOpdName = user?.opd || 'Tidak Diketahui';
                Swal.fire('Perangkat Daerah Dibatasi', `Aturan Wajib Sesuai Target OPD aktif. Perangkat Daerah Anda (${userOpdName}) tidak terdaftar dalam target kegiatan ini.`, 'error');
                return;
            }
        }
    }

    // Tentukan status kehadiran & verifikasi berdasarkan kondisi
    let statusKehadiran = "Hadir";
    let statusVerifikasi = "Terverifikasi Sistem";
    let keterangan = document.getElementById('keterangan').value.trim() || "-";

    const alasanKondisiEl = document.getElementById('alasanKondisi');
    const alasanKondisi = alasanKondisiEl ? alasanKondisiEl.value : '';

    if (window._isTidakHadir) {
        statusVerifikasi = "Menunggu Verifikasi Admin";
        const alasanIzinEl = document.getElementById('alasanIzin');
        if (alasanIzinEl && alasanIzinEl.value) statusKehadiran = alasanIzinEl.value;
        const ketIzinEl = document.getElementById('keteranganIzin');
        if (ketIzinEl && ketIzinEl.value.trim()) keterangan = ketIzinEl.value.trim();
    } else if (isTerlambat || isLuarRadius || isGpsError || isKameraError) {
        statusVerifikasi = "Menunggu Verifikasi Admin";
        if (alasanKondisi) {
            statusKehadiran = alasanKondisi;
        }

        let prefix = [];
        if (isTerlambat) prefix.push("Terlambat");
        if (isLuarRadius) prefix.push("Luar Lokasi");
        if (isGpsError) prefix.push("GPS Error");
        if (isKameraError) prefix.push("Kamera Error");
        if (prefix.length > 0) {
            keterangan = prefix.join(" & ") + " - " + keterangan;
        }
    }

    const queueValue = currentJadwal?.aktifkan_antrian;
    const useQueue = String(queueValue ?? '').trim() === '1';

    // Helper penampung FormData untuk server utama PHP
    const createPhpFormData = () => {
        const formData = new FormData();
        formData.append('kode_akses', kode);
        formData.append('lat', lat);
        formData.append('lng', lng);
        formData.append('lokasi', alamat);
        formData.append('keterangan', keterangan);
        formData.append('status_kehadiran', statusKehadiran);
        formData.append('status_verifikasi', statusVerifikasi);

        if (window._isTidakHadir) {
            const buktiIzinInput = document.getElementById('buktiIzin');
            if (buktiIzinInput && buktiIzinInput.files.length > 0) {
                formData.append('foto', buktiIzinInput.files[0]);
            }
        } else {
            const buktiHadirInput = document.getElementById('buktiHadir');
            if (buktiHadirInput && buktiHadirInput.files.length > 0) {
                formData.append('foto', buktiHadirInput.files[0]);
            } else if (b64) {
                const isPdf = b64.includes('application/pdf');
                const fileExt = isPdf ? 'pdf' : 'jpg';
                const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';
                formData.append('foto', new File([dataURItoBlob(b64)], `absen_selfie.${fileExt}`, { type: mimeType }));
            }
        }
        return formData;
    };

    // Variabel penampung URL server & mode pengiriman
    const isHadir = !window._isTidakHadir;
    const isUseWorker = Boolean(isHadir && useQueue);
    const targetUrl = isUseWorker ? `${WORKER_URL}/api/absen/submit` : `${API_BASE_URL}/absen/submit`;

    const workerPayload = {
        kode_akses: kode, kategori: currentJadwal.kategori, lat: lat, lng: lng,
        lokasi: alamat, keterangan: keterangan, foto_base64: b64,
        status_kehadiran: statusKehadiran, status_verifikasi: statusVerifikasi
    };
    const requestData = isUseWorker
        ? { body: JSON.stringify(workerPayload), fallbackBody: createPhpFormData, token, method: 'POST' }
        : { body: createPhpFormData, token, method: 'POST' };
    const fallbackUrl = isUseWorker ? `${API_BASE_URL}/absen/submit` : null;

    showLoading(true, "Mengirim Absensi...");

    try {
        console.log(`Mengirim absensi via: ${isUseWorker ? 'Cloudflare Queue' : 'Direct API Server Utama'} (${targetUrl})`);
        await requestWithResponseHandler(
            requestData,
            targetUrl,
            async (res) => {
                playBeepSound();
                const userForHistory = await parseJwt(token);
                if (userForHistory && userForHistory.nip && currentJadwal) {
                    let waktuServer = getCurrentServerTime().toISOString();
                    if (res.data && res.data.waktu) {
                        waktuServer = res.data.waktu;
                    }
                    await simpanRiwayatLokal(currentJadwal.judul, currentJadwal.kategori, waktuServer, currentJadwal.kode_akses, userForHistory.nip);
                }
                Swal.fire('BERHASIL!', res.message, 'success');
                batalAbsen();
            },
            (message, res, error) => {
                if (error) console.error('Error saat kirim absensi:', error);
                const pesanError = error ? `Ada kesalahan di aplikasi, ${error.message}` : (message ? message : (res?.message ? res.message : 'Data absensi ditolak.'));
                Swal.fire('Gagal Mengirim', pesanError, 'error');
            },
            fallbackUrl
        );
    } finally {
        window._isSubmittingAbsen = false;
        showLoading(false);
    }
}


async function adminCepatKirimAbsensi(userToken, fotoBase64 = null) {
    if (isSubmittingAdminCepat) return;
    isSubmittingAdminCepat = true;
    try {
        const cleanToken = typeof userToken === 'string' ? userToken.trim() : '';
        if (!cleanToken) {
            Swal.fire({ toast: true, position: 'bottom', icon: 'error', title: `Token Pegawai Tidak Valid`, showConfirmButton: false, timer: 2000 });
            return;
        }

        let namaPegawaiPreview = 'Pegawai ASN';
        if (cleanToken.startsWith("BP:")) {
            namaPegawaiPreview = 'Pegawai ASN (E-Presensi Pass)';
        } else if (cleanToken.startsWith("BB:")) {
            const jwtData = parseJwt(cleanToken.replace("BB:", ""), true);
            if (!jwtData) {
                Swal.fire({ toast: true, position: 'bottom', icon: 'error', title: `Token Pegawai Kedaluwarsa`, showConfirmButton: false, timer: 2000 });
                return;
            }
            namaPegawaiPreview = jwtData.nama || 'Pegawai ASN';
        } else {
            const jwtData = parseJwt(cleanToken, true);
            if (!jwtData) {
                Swal.fire({ toast: true, position: 'bottom', icon: 'error', title: `Format Token Tidak Sesuai`, showConfirmButton: false, timer: 2000 });
                return;
            }
            namaPegawaiPreview = jwtData.nama || 'Pegawai ASN';
        }

        const jadwal = adminCepatState.jadwal;
        const kode = jadwal.kode_akses;
        const statusKehadiran = adminCepatState.status_kehadiran;
        const statusVerifikasi = adminCepatState.status_verifikasi;
        const keteranganAdmin = adminCepatState.keterangan;

        const lat = adminCepatState.lat || '0';
        const lng = adminCepatState.lng || '0';

        if (!keteranganAdmin) {
            Swal.fire('Gagal', 'Keterangan wajib diisi.', 'error');
            return;
        }

        let response;
        let res;
        const adminToken = await localforage.getItem("asn_jwt_token");

        try {
            // 1. Coba kirim ke Worker/Queue
            const workerUrl = `${WORKER_URL}/api/absen-cepat/submit`;
            console.log("Mengirim absensi cepat via: Cloudflare Queue");
            const workerBody = JSON.stringify({
                user_token: userToken,
                kode_akses: kode,
                kategori: jadwal.kategori,
                lat: lat, lng: lng, lokasi: 'Absensi Cepat oleh Admin',
                keterangan_verifikasi: keteranganAdmin,
                status_kehadiran: statusKehadiran,
                status_verifikasi: statusVerifikasi,
                foto_base64: fotoBase64 || null
            });
            response = await fetchWithAuth(workerUrl, { method: "POST", body: workerBody, token: adminToken });
            if (!response.ok && response.status >= 500) {
                throw new Error(`Worker web server error HTTP ${response.status}`);
            }
            res = await response.json();
            if (res && res.status === false && Number(res.code) >= 500) {
                throw new Error(res.message);
            }
        } catch (workerError) {
            // Block catch HANYA menangani error 500 / network error
            console.warn("Gagal mengirim absensi cepat ke Worker (error 500/network), fallback ke server utama.", workerError.message);

            const fallbackUrl = `${API_BASE_URL}/absen-cepat/submit`;
            const fallbackBody = new FormData();
            fallbackBody.append('user_token', userToken);
            fallbackBody.append('kode_akses', kode);
            fallbackBody.append('lat', lat);
            fallbackBody.append('lng', lng);
            fallbackBody.append('lokasi', 'Absensi Cepat oleh Admin');
            fallbackBody.append('keterangan_verifikasi', keteranganAdmin);
            fallbackBody.append('status_kehadiran', statusKehadiran);
            fallbackBody.append('status_verifikasi', statusVerifikasi);
            if (fotoBase64) fallbackBody.append('foto_base64', fotoBase64);

            response = await fetchWithAuth(fallbackUrl, { method: "POST", body: fallbackBody, token: adminToken });
            res = await response.json();
        }

        if (response.ok && res.status) {
            playBeepSound();
            const successMessage = res.message;
            Swal.fire({ toast: true, position: 'bottom', icon: 'success', title: successMessage, showConfirmButton: false, timer: 2500, timerProgressBar: true });
        } else {
            Swal.fire({ toast: true, position: 'bottom', icon: 'error', title: `Gagal: ${res.message}`, showConfirmButton: false, timer: 2000 });
        }
    } catch (e) {
        console.error("Error saat kirim absensi cepat:", e);
        Swal.fire({ toast: true, position: 'bottom', icon: 'error', title: `Ada kesalahan di aplikasi, ${e.message || e}`, showConfirmButton: false, timer: 3500 });
        // Lemparkan kembali error agar bisa ditangkap oleh pemanggil jika perlu.
        throw e;
    } finally {
        isSubmittingAdminCepat = false;
    }
}

function tampilkanFormLanjutan() {
    document.getElementById('form-absen-lanjutan').classList.remove('hidden-view');
    mulaiKameraSelfie();
    updateConditionalFormElements();

    // FIX: Memastikan event listener untuk kolom keterangan selalu aktif
    // saat form ditampilkan untuk mengatasi bug tombol kirim yang tidak aktif.
    document.getElementById('keterangan').oninput = validasiTombolKirim;

    const buktiHadirInput = document.getElementById('buktiHadir');
    if (buktiHadirInput) {
        buktiHadirInput.onchange = () => handleProofFileChange('buktiHadir');
    }

    const buktiIzinInput = document.getElementById('buktiIzin');
    if (buktiIzinInput) {
        buktiIzinInput.onchange = () => handleProofFileChange('buktiIzin', checkIzinForm);
    }

    validasiTombolKirim();
}

function validateProofFile(file) {
    if (!file) {
        return { isValid: false, reason: 'missing' };
    }

    const allowedTypes = ['application/pdf'];
    const isImage = typeof file.type === 'string' && file.type.startsWith('image/');
    const isAllowedType = isImage || allowedTypes.includes(file.type);

    if (!isAllowedType) {
        return { isValid: false, reason: 'type' };
    }

    if (file.size > 1048576) {
        return { isValid: false, reason: 'size' };
    }

    return { isValid: true, reason: null };
}

function showInvalidProofFileAlert() {
    Swal.fire('File tidak valid', 'File maksimal 1 MB dan hanya boleh gambar atau PDF.', 'warning');
}

function handleProofFileChange(inputId, callback = validasiTombolKirim) {
    const input = document.getElementById(inputId);
    if (!input) {
        callback();
        return;
    }

    const file = input.files && input.files[0] ? input.files[0] : null;
    const validation = validateProofFile(file);

    if (!validation.isValid && validation.reason !== 'missing') {
        const alertKey = `${inputId}:${validation.reason}:${file ? `${file.name}:${file.size}:${file.type}` : 'empty'}`;
        if (lastInvalidFileAlertKey !== alertKey) {
            lastInvalidFileAlertKey = alertKey;
            showInvalidProofFileAlert();
        }
    } else {
        lastInvalidFileAlertKey = null;
    }

    callback();
}

/**
 * Menghitung jarak antara dua koordinat geografis dalam meter menggunakan formula Haversine.
 * @param {number} lat1 Latitude titik pertama.
 * @param {number} lon1 Longitude titik pertama.
 * @param {number} lat2 Latitude titik kedua.
 * @param {number} lon2 Longitude titik kedua.
 * @returns {number} Jarak dalam meter.
 */
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radius bumi dalam meter
    const φ1 = lat1 * Math.PI / 180; // φ, λ dalam radian
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Jarak dalam meter
}

function lanjutTanpaLokasiValid() {
    if (currentJadwal && currentJadwal.is_strict_location == 1) {
        Swal.fire({
            title: 'Di Luar Lokasi',
            text: 'Aturan Wajib Sesuai Lokasi aktif. Absensi tidak dapat dilanjutkan tanpa lokasi GPS valid yang sesuai radius kegiatan.',
            icon: 'error'
        }).then(() => batalAbsen());
        return;
    }

    document.getElementById('statusGeoLoading').classList.add('hidden-view');
    isLuarRadius = true; // Force status to be 'luar lokasi'
    isGpsError = true;

    // Set placeholder values for coordinates and address to allow submission
    document.getElementById('lat').value = '0';
    document.getElementById('lng').value = '0';
    document.getElementById('alamat').value = 'Lokasi GPS tidak terdeteksi';

    const stGeo = document.getElementById('statusGeo');
    const boxGagal = document.getElementById('boxLokasiGagal');

    // Hide failure box and show a status message
    boxGagal.classList.add('hidden-view');
    stGeo.classList.remove('hidden-view');
    stGeo.className = "bg-yellow-50 text-yellow-700 py-2 px-4 rounded-lg text-xs font-bold border border-yellow-200";
    stGeo.innerHTML = `LOKASI TIDAK VALID. <br><small class="font-normal">Melanjutkan absensi dengan status "Di Luar Lokasi".</small>`;

    // Show the rest of the form
    // Tampilkan sisa form (kamera, keterangan, dll) meskipun lokasi gagal.
    tampilkanFormLanjutan();
}

async function getAlamatFromKoordinat(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&cb=${Date.now()}`);
        if (!response.ok) {
            return `${lat},${lng}`; // Fallback ke koordinat jika API error
        }
        const data = await response.json();
        // display_name adalah alamat lengkap yang disediakan oleh Nominatim
        return data.display_name || `${lat},${lng}`;
    } catch (error) {
        console.error("Gagal melakukan reverse geocoding:", error);
        return `${lat},${lng}`; // Fallback ke koordinat jika ada error jaringan
    }
}

async function mulaiKameraSelfie() {
    const v = document.getElementById('kamera');
    const cameraSelect = document.getElementById('selfie-camera-select');
    const cameraContainer = document.getElementById('selfie-camera-selection-container');
    const targetJadwalKode = currentJadwal?.kode_akses;

    // Hentikan stream yang mungkin masih berjalan sebelum memulai yang baru
    if (videoStream) {
        try { videoStream.getTracks().forEach(track => track.stop()); } catch (e) { }
        videoStream = null;
    }

    // Fungsi internal untuk memulai stream dengan deviceId tertentu
    const startStream = async (deviceId) => {
        const currentGen = ++selfieCameraGeneration;
        if (videoStream) {
            try { videoStream.getTracks().forEach(track => track.stop()); } catch (e) { }
            videoStream = null;
        }
        const constraints = {
            audio: false,
            video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" }
        };
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            // Cegah race condition/leak jika request kamera lain dibuat atau form dibatalkan/diganti
            if (currentGen !== selfieCameraGeneration || !currentJadwal || currentJadwal.kode_akses !== targetJadwalKode) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }
            if (videoStream) {
                try { videoStream.getTracks().forEach(track => track.stop()); } catch (e) { }
            }
            videoStream = stream;
            if (v) v.srcObject = videoStream;
            isKameraError = false;
        } catch (e) {
            if (currentGen !== selfieCameraGeneration) return;
            console.error("Gagal memulai kamera selfie:", e);
            isKameraError = true;
            updateConditionalFormElements();
            tampilkanAlertAbsensiCadangan("Kamera selfie gagal dimuat atau akses ditolak. Anda dapat menggunakan Absensi Cadangan.");
        }
    };

    // Logika utama untuk mendeteksi dan menampilkan pilihan kamera
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        if (videoDevices && videoDevices.length > 1) {
            cameraContainer.classList.remove('hidden-view');
            cameraSelect.innerHTML = '';
            let defaultCameraId = '';

            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Kamera ${index + 1}`;

                // Heuristik pemilihan default: prioritaskan kamera depan.
                const isFrontCamera = device.label.toLowerCase().includes('front') || device.label.toLowerCase().includes('depan') || device.label.toLowerCase().includes('user');

                if (isFrontCamera) {
                    option.selected = true;
                    defaultCameraId = device.deviceId;
                }
                cameraSelect.appendChild(option);
            });

            if (!defaultCameraId) defaultCameraId = videoDevices[0].deviceId;

            cameraSelect.onchange = () => startStream(cameraSelect.value);
            startStream(defaultCameraId);
        } else {
            cameraContainer.classList.add('hidden-view');
            startStream(); // Mulai kamera default jika hanya ada satu atau tidak ada
        }
    } catch (err) {
        console.error("Gagal mendapatkan daftar kamera selfie:", err);
        cameraContainer.classList.add('hidden-view');
        startStream(); // Fallback jika terjadi error
    }
}

function ambilFoto() {
    const v = document.getElementById('kamera');
    const canv = document.getElementById('canvas');
    // --- PENINGKATAN: MENGECILKAN UKURAN FOTO ---
    // Mengubah lebar canvas dari 400 menjadi 320 akan mengurangi resolusi dan ukuran file secara signifikan.
    canv.width = 320;
    canv.height = (v.videoHeight / v.videoWidth) * canv.width;
    canv.getContext('2d').drawImage(v, 0, 0, canv.width, canv.height);

    // Mengubah kualitas JPEG dari 0.6 menjadi 0.5 juga akan mengurangi ukuran file.
    // Nilai antara 0.4 - 0.6 biasanya merupakan kompromi yang baik antara ukuran dan kualitas.
    const b64 = canv.toDataURL('image/jpeg', 0.5);
    document.getElementById('fotoBase64').value = b64;
    document.getElementById('hasilFoto').src = b64;

    v.classList.add('hidden-view');
    document.getElementById('hasilFoto').classList.remove('hidden-view');

    const btnJepret = document.getElementById('btnJepret');
    if (btnJepret) btnJepret.classList.add('hidden-view');

    const btnUlang = document.getElementById('btnUlang');
    if (btnUlang) btnUlang.classList.remove('hidden-view');

    validasiTombolKirim();
}


function ulangFoto() {
    document.getElementById('fotoBase64').value = "";
    document.getElementById('hasilFoto').classList.add('hidden-view');

    const kamera = document.getElementById('kamera');
    if (kamera) kamera.classList.remove('hidden-view');

    const btnJepret = document.getElementById('btnJepret');
    if (btnJepret) btnJepret.classList.remove('hidden-view');

    const btnUlang = document.getElementById('btnUlang');
    if (btnUlang) btnUlang.classList.add('hidden-view');

    validasiTombolKirim();
}

function validasiTombolKirim() {
    if (window._isTidakHadir) {
        checkIzinForm();
        return;
    }

    const btnKirim = document.getElementById('btnKirim');
    if (!btnKirim) return;

    const b64 = document.getElementById('fotoBase64')?.value || '';
    const latValue = document.getElementById('lat')?.value;

    const ket = document.getElementById('keterangan')?.value?.trim() || '';
    const wajibKeterangan = isLuarRadius || isTerlambat || isGpsError || isKameraError;
    const isKoordinatOk = latValue !== null && latValue !== undefined && latValue !== '';
    const isKeteranganOk = !wajibKeterangan || ket !== '';

    const isFormValid = b64 && isKoordinatOk && isKeteranganOk;

    if (isFormValid) {
        btnKirim.disabled = false;
        btnKirim.className = "w-full bg-red-700 active:scale-95 text-white font-extrabold py-4 rounded-xl shadow-[0_5px_15px_rgba(185,28,28,0.4)] transition-all flex items-center justify-center gap-2";
    } else {
        btnKirim.disabled = true;
        btnKirim.className = "w-full bg-gray-300 text-gray-500 font-extrabold py-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2";
    }
}
function batalAbsen(fromPopState = false) {
    // Reset flags
    isKameraError = false;
    isGpsError = false;
    isLuarRadius = false;
    isTerlambat = false;

    // Lakukan cleanup SEKARANG, baik dipanggil dari tombol UI maupun dari popstate.
    cleanupAbsenForm();

    // Reset UI form untuk persiapan jika dibuka lagi.
    document.getElementById('formJudul').innerText = '-';
    document.getElementById('formKategori').innerText = "";
    document.getElementById('formKode').innerText = "";
    document.getElementById('formWaktu').innerText = "";

    // Jika fungsi ini dipanggil dari tombol UI, lakukan navigasi kembali.
    // Jika dipanggil dari popstate, navigasi sudah terjadi, jadi kita hanya perlu
    // memastikan view yang benar ditampilkan.
    if (!fromPopState && location.hash === '#form') {
        history.back();
    } else {
        // Ini akan dipanggil oleh popstate atau setelah submit sukses.
        switchView('view-dashboard');
    }
}


function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
}

/**
 * Menyiapkan dan menampilkan UI form absensi setelah validasi jadwal berhasil.
 * @param {object} jadwalData - Objek data jadwal yang sudah divalidasi.
 */
async function setupAbsenForm(jadwalData) {
    // Riset penuh seluruh state & input form sebelum memuat jadwal baru
    cleanupAbsenForm();

    showLoading(false); // Pastikan loading disembunyikan

    // Set currentJadwal langsung dari data response API (res.data) sesuai dokumentasi api.md
    currentJadwal = jadwalData;

    const queueValue = currentJadwal?.aktifkan_antrian;
    if (currentJadwal) {
        currentJadwal.aktifkan_antrian = String(queueValue ?? '').trim();
    }

    if (typeof currentJadwal.is_terlambat !== 'undefined') {
        isTerlambat = Boolean(currentJadwal.is_terlambat);
    } else if (currentJadwal.server_time) {
        const serverTimeMs = new Date(currentJadwal.server_time).getTime();
        const eventEndStr = `${currentJadwal.tanggal}T${currentJadwal.jam_selesai}:00+07:00`;
        const endTime = new Date(eventEndStr).getTime();
        isTerlambat = serverTimeMs > endTime;
    } else {
        const eventEndStr = `${currentJadwal.tanggal}T${currentJadwal.jam_selesai}:00+07:00`;
        const endTime = new Date(eventEndStr).getTime();
        isTerlambat = Date.now() > endTime;
    }

    // Isi detail jadwal ke dalam elemen-elemen di form
    document.getElementById('formJudul').innerText = currentJadwal.judul;
    document.getElementById('formKategori').innerText = currentJadwal.kategori;
    document.getElementById('formKode').innerText = currentJadwal.kode_akses;
    document.getElementById('formKategori').parentElement.classList.remove('hidden-view');
    document.getElementById('formKode').parentElement.classList.remove('hidden-view');
    const tanggalFormatted = new Date(currentJadwal.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('formWaktu').innerText = `${tanggalFormatted} (${currentJadwal.jam_mulai} - ${currentJadwal.jam_selesai} WIB)`;

    // Sembunyikan elemen-elemen UI yang mungkin masih terlihat dari sesi sebelumnya
    document.getElementById('form-absen-lanjutan').classList.add('hidden-view');
    document.getElementById('boxLokasiGagal').classList.add('hidden-view');
    document.getElementById('statusGeo').classList.add('hidden-view');
    document.getElementById('statusGeoLoading').classList.remove('hidden-view');
    document.getElementById('keterangan').value = '';
    document.getElementById('flowHadir').classList.add('hidden-view');
    document.getElementById('flowIzin').classList.add('hidden-view'); // Sembunyikan form absen luar daerah/izin
    document.getElementById('opsiKehadiranAwal').classList.remove('hidden-view');
    document.getElementById('warningTidakHadir').classList.add('hidden');
    document.getElementById('btnKirim').disabled = true;

    // Pastikan radio buttons tidak tercentang saat dibuka baru
    const radioInputs = document.querySelectorAll('input[name="tipeKehadiran"]');
    radioInputs.forEach(radio => radio.checked = false);
    window._isTidakHadir = false;

    // Tampilkan Peringatan Mode Ketat jika aktif
    const bannerKetat = document.getElementById('bannerModeKetat');
    const teksKetat = document.getElementById('teksModeKetat');
    let ketatMsg = [];
    if (currentJadwal.is_strict_time == 1) ketatMsg.push("Aturan Waktu Berlaku");
    if (currentJadwal.is_strict_location == 1) ketatMsg.push("Wajib Sesuai Lokasi");
    if (currentJadwal.is_strict_opd == 1) ketatMsg.push("Wajib Sesuai Target OPD");

    if (ketatMsg.length > 0) {
        teksKetat.innerText = ketatMsg.join(" & ") + " aktif. Keterlambatan atau lokasi tidak sesuai akan langsung ditolak untuk opsi Hadir di Lokasi.";
        bannerKetat.classList.remove('hidden-view');
    } else {
        bannerKetat.classList.add('hidden-view');
    }


    // Pencegahan awal jika is_strict_opd aktif
    if (currentJadwal.is_strict_opd == 1) {
        const token = await localforage.getItem("asn_jwt_token");
        const user = token ? parseJwt(token) : null;
        const targetOpd = Array.isArray(currentJadwal.target_opd) ? currentJadwal.target_opd : [];
        if (targetOpd.length > 0 && (!user || !user.opd || !targetOpd.includes(user.opd))) {
            const userOpdName = user?.opd || 'Tidak Diketahui';
            Swal.fire({
                title: 'Perangkat Daerah Dibatasi',
                text: `Aturan Wajib Sesuai Target OPD aktif. Perangkat Daerah Anda (${userOpdName}) tidak terdaftar dalam target kegiatan ini.`,
                icon: 'error'
            }).then(() => batalAbsen());
            return;
        }
    }

    // Tambahkan state ke history browser untuk navigasi tombol kembali
    history.pushState({ view: 'form' }, "Konfirmasi Kehadiran", '#form');

    // Matikan kamera terlebih dahulu saat form awal dirender
    if (typeof videoStream !== 'undefined' && videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }

    window._isHadirStarted = false;

    switchView('view-form');
}

window.bukaPilihMetode = function () {
    cleanupAbsenForm();
    switchView('view-pilih-metode');
    history.pushState({ view: 'pilih-metode' }, "Pilih Metode Absensi", '#metode');
}

window.batalPilihMetode = function () {
    if (location.hash === '#metode') {
        history.back();
    } else {
        switchView('view-dashboard');
    }
}

window.prosesKodeManualDariPilihMetode = function (event) {
    event.preventDefault();
    const kode = document.getElementById('inputKodeManual').value.trim();
    if (kode === "") return;
    document.getElementById('inputKodeManual').value = ""; // reset
    batalPilihMetode();
    prosesQrCode(kode);
}

window.pilihOpsiKehadiran = async function (opsi) {
    const radioEl = document.querySelector(`input[name="tipeKehadiran"][value="${opsi}"]`);
    if (radioEl) radioEl.checked = true;

    const elOpsiAwal = document.getElementById('opsiKehadiranAwal');
    if (elOpsiAwal) elOpsiAwal.classList.add('hidden-view');
    if (opsi === 'hadir') {
        if (currentJadwal && currentJadwal.is_strict_time == 1 && isTerlambat) {
            Swal.fire({
                title: 'Waktu Berakhir',
                text: 'Aturan Waktu Berlaku aktif. Absensi Hadir tidak dapat dilakukan karena batas waktu telah lewat.',
                icon: 'error'
            }).then(() => batalAbsen());
            return;
        }

        if (currentJadwal && currentJadwal.is_strict_opd == 1) {
            const token = await localforage.getItem("asn_jwt_token");
            const user = token ? parseJwt(token) : null;
            const targetOpd = Array.isArray(currentJadwal.target_opd) ? currentJadwal.target_opd : [];
            if (targetOpd.length > 0 && (!user || !user.opd || !targetOpd.includes(user.opd))) {
                const userOpdName = user?.opd || 'Tidak Diketahui';
                Swal.fire({
                    title: 'Perangkat Daerah Dibatasi',
                    text: `Aturan Wajib Sesuai Target OPD aktif. Perangkat Daerah Anda (${userOpdName}) tidak terdaftar dalam target kegiatan ini.`,
                    icon: 'error'
                }).then(() => batalAbsen());
                return;
            }
        }

        // Reset data dari opsi Tidak Hadir jika sempat diisi sebelumnya
        const setVal = (id, val = '') => {
            const el = document.getElementById(id);
            if (el) { el.value = val; if (el.tagName === 'SELECT') el.selectedIndex = 0; }
        };
        setVal('alasanIzin');
        setVal('keteranganIzin');
        setVal('buktiIzin');

        window._isTidakHadir = false;
        const elFlowHadir = document.getElementById('flowHadir');
        if (elFlowHadir) elFlowHadir.classList.remove('hidden-view');
        const elFlowIzin = document.getElementById('flowIzin');
        if (elFlowIzin) elFlowIzin.classList.add('hidden-view');
        const elWarning = document.getElementById('warningTidakHadir');
        if (elWarning) elWarning.classList.add('hidden-view');
        startHadirFlow();
    } else {
        // Matikan kamera selfie jika sempat berjalan
        if (videoStream) {
            videoStream.getTracks().forEach(t => t.stop());
            videoStream = null;
        }
        ulangFoto();

        // Reset data dari opsi Hadir jika sempat diisi sebelumnya
        const setVal = (id, val = '') => {
            const el = document.getElementById(id);
            if (el) { el.value = val; if (el.tagName === 'SELECT') el.selectedIndex = 0; }
        };
        setVal('keterangan');
        setVal('alasanKondisi');
        setVal('buktiHadir');
        setVal('lat');
        setVal('lng');
        setVal('alamat');
        setVal('fotoBase64');

        const elFlowHadir = document.getElementById('flowHadir');
        if (elFlowHadir) elFlowHadir.classList.add('hidden-view');
        const elFormLanjutan = document.getElementById('form-absen-lanjutan');
        if (elFormLanjutan) elFormLanjutan.classList.add('hidden-view');
        const elFlowIzin = document.getElementById('flowIzin');
        if (elFlowIzin) elFlowIzin.classList.remove('hidden-view');

        window._isTidakHadir = true;
        checkIzinForm(); // Lakukan pengecekan validasi form izin
    }
}

window.checkIzinForm = function () {
    const alasan = document.getElementById('alasanIzin').value;
    const ket = document.getElementById('keteranganIzin').value.trim();
    const file = document.getElementById('buktiIzin').files[0];
    const btnKirim = document.getElementById('btnKirim');
    const warningEl = document.getElementById('warningTidakHadir');

    // Tampilkan peringatan jika alasan adalah sakit (non-cuti) atau lainnya
    if (alasan === 'Sakit' || alasan === 'Lainnya') {
        if (warningEl) warningEl.classList.remove('hidden-view');
    } else {
        if (warningEl) warningEl.classList.add('hidden-view');
    }

    let isValid = true;
    if (!alasan) isValid = false;
    if (!ket) isValid = false;
    if (!validateProofFile(file).isValid) isValid = false;

    if (isValid) {
        btnKirim.disabled = false;
        btnKirim.className = "w-full bg-red-700 active:scale-95 text-white font-extrabold py-4 rounded-xl shadow-[0_5px_15px_rgba(185,28,28,0.4)] transition-all flex items-center justify-center gap-2";
    } else {
        btnKirim.disabled = true;
        btnKirim.className = "w-full bg-gray-300 text-gray-500 font-extrabold py-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2";
    }
}
/**
 * Handler utama setelah QR code berhasil dipindai.
 * Membedakan antara alur absensi normal dan alur absensi cepat admin.
 * @param {string} decodedText - Teks dari hasil pindaian QR.
 */
async function ambilSnapshotFotoCepat() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.setAttribute('capture', 'user');
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) {
                resolve(null);
                return;
            }
            try {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const maxDim = 480;
                        let w = img.width;
                        let h = img.height;
                        if (w > h && w > maxDim) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        } else if (h > maxDim) {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);
                        resolve(compressedBase64);
                    };
                    img.src = evt.target.result;
                };
                reader.readAsDataURL(file);
            } catch (err) {
                console.warn("Gagal memproses snapshot kamera:", err);
                resolve(null);
            }
        };
        input.click();
    });
}

async function handleScanSuccess(decodedText) {
    if (isProcessingScan) return;
    isProcessingScan = true;

    // Alur Absensi Cepat Admin (Continuous Scan)
    if (isAbsenCepatMode) {
        // 1. Langsung hentikan scanner untuk mencegah pindaian ganda saat proses berlangsung.
        if (html5QrCode && html5QrCode.isScanning) {
            await html5QrCode.stop().catch(err => console.warn("Gagal menghentikan scanner setelah sukses.", err));
        }

        const cleanText = typeof decodedText === 'string' ? decodedText.trim() : '';
        const isProfileToken = cleanText.startsWith("BP:") || cleanText.startsWith("BB:");
        if (isProfileToken) {
            const token = cleanText;
            const modeFoto = adminCepatState.mode_foto || 'tidak';
            const userData = cleanText.startsWith("BB:") ? (parseJwt(cleanText.replace("BB:", ""), true) || { nama: 'Pegawai ASN', nip: '-' }) : { nama: 'Pegawai ASN (E-Presensi Pass)', nip: '-' };

            try {
                let fotoBase64 = null;

                if (modeFoto === 'tanya') {
                    showLoading(false);
                    const promptResult = await Swal.fire({
                        title: 'QR Code Terverifikasi',
                        html: `<div class="text-left text-sm space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <div><strong class="text-gray-700">Nama:</strong> ${userData.nama || '-'}</div>
                                <div><strong class="text-gray-700">NIP:</strong> <span class="font-mono">${userData.nip || '-'}</span></div>
                                <div><strong class="text-gray-700">OPD:</strong> ${userData.opd || '-'}</div>
                               </div>
                               <p class="text-xs text-gray-500 mt-3">Apakah Anda ingin menyertakan foto pegawai atau kirim langsung?</p>`,
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonText: '<i class="bi bi-camera-fill"></i> Foto Pegawai',
                        cancelButtonText: '<i class="bi bi-send-fill"></i> Kirim Langsung',
                        confirmButtonColor: '#2563eb',
                        cancelButtonColor: '#16a34a',
                        showDenyButton: true,
                        denyButtonText: 'Batal',
                        denyButtonColor: '#6b7280'
                    });

                    if (promptResult.isConfirmed) {
                        fotoBase64 = await ambilSnapshotFotoCepat();
                        showLoading(true, "Mengirim Absensi + Foto...");
                        await adminCepatKirimAbsensi(token, fotoBase64);
                    } else if (promptResult.isDismissed && promptResult.dismiss === Swal.DismissReason.cancel) {
                        showLoading(true, "Memproses Absensi...");
                        await adminCepatKirimAbsensi(token, null);
                    }
                } else if (modeFoto === 'wajib') {
                    showLoading(false);
                    fotoBase64 = await ambilSnapshotFotoCepat();
                    if (fotoBase64) {
                        showLoading(true, "Mengirim Absensi + Foto...");
                        await adminCepatKirimAbsensi(token, fotoBase64);
                    }
                } else {
                    // Mode 'tidak' (Default instan)
                    showLoading(true, "Memproses Absensi...");
                    await adminCepatKirimAbsensi(token, null);
                }
            } catch (e) {
                console.error("Terjadi kesalahan saat mengirim absensi cepat:", e);
                Swal.fire("Kesalahan", `Ada kesalahan di aplikasi, ${e.message || e}`, "error");
            } finally {
                showLoading(false);
                setTimeout(() => {
                    if (isAbsenCepatMode) {
                        const selectedCameraId = document.getElementById('camera-select').value;
                        _startScanner(selectedCameraId);
                    }
                }, 600);
            }
        } else {
            // 5. Jika QR tidak valid, tampilkan pesan error yang memblokir.
            Swal.fire({
                title: "QR Code Tidak Sesuai",
                text: "Harap pindai QR Code Profil Pegawai yang valid (diawali dengan 'BP:').",
                icon: "error",
                confirmButtonText: "Coba Lagi"
            }).then(() => {
                if (isAbsenCepatMode) {
                    const selectedCameraId = document.getElementById('camera-select').value;
                    _startScanner(selectedCameraId);
                }
            });
        }
    } else { // Alur Absensi Normal (tidak berubah)
        if (html5QrCode && html5QrCode.isScanning) {
            await html5QrCode.stop().catch(err => console.warn("Gagal menghentikan scanner setelah sukses.", err));
            if (html5QrCode.clear) {
                try { await html5QrCode.clear(); } catch (e) { }
            }
            html5QrCode = null;
        }
        handleDecodedQrText(decodedText);
    }
}

function startHadirFlow() {
    window._isHadirStarted = true;
    ulangFoto();
    cekLokasiOtomatis();
}

function updateConditionalFormElements() {
    const boxKeterangan = document.getElementById('boxKeterangan');
    const keteranganLabel = document.getElementById('keteranganLabel');
    const warningMsg = document.getElementById('warningMsg');
    const inputAlasan = document.getElementById('inputAlasanKondisi');
    const inputBukti = document.getElementById('inputBuktiKondisi');

    // Sembunyikan selalu opsi alasan kondisi dan bukti pendukung untuk alur Hadir
    if (inputAlasan) inputAlasan.classList.add('hidden');
    if (inputBukti) inputBukti.classList.add('hidden');

    if (isTerlambat || isLuarRadius || isKameraError || isGpsError) {
        boxKeterangan.classList.remove('hidden-view');
        if (keteranganLabel) keteranganLabel.innerText = "Keterangan (Wajib Diisi)";
        if (warningMsg) warningMsg.classList.remove('hidden');
    } else {
        boxKeterangan.classList.add('hidden-view');
        if (keteranganLabel) keteranganLabel.innerText = "Keterangan (Opsional)";
        if (warningMsg) warningMsg.classList.add('hidden');
    }
}

// EXPORTS UNTUK TESTING (Diabaikan oleh browser)
if (typeof module !== 'undefined') {
    if (module.exports) {
        module.exports = { getDistanceInMeters, parseJwt, switchView, pilihOpsiKehadiran, batalAbsen };
    }
}
