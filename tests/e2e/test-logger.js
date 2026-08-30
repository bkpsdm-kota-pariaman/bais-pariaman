/**
 * Helper logger universal untuk pengujian Playwright E2E.
 * Menampilkan seluruh aktivitas browser secara detail di terminal:
 * - Akses URL / Navigasi
 * - Network Request & Response Fetch API (Status HTTP, Body JSON, Failed requests)
 * - Browser Console logs & Uncaught Page Errors
 * - Aksi interaksi UI (Input, Klik, Select, Pindah Menu, Verifikasi)
 */

function attachLogger(page, moduleName = 'E2E') {
  // 1. Log Navigasi URL
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      console.log(`  🌐 [NAVIGASI URL] Halaman berpindah ke -> ${frame.url()}`);
    }
  });

  // 2. Log Network Request Fetch / XHR
  page.on('request', request => {
    const resourceType = request.resourceType();
    if (['fetch', 'xhr'].includes(resourceType)) {
      const postData = request.postData();
      const bodySnippet = postData ? ` | Payload: ${postData.slice(0, 300)}${postData.length > 300 ? '...' : ''}` : '';
      console.log(`  🚀 [FETCH REQUEST] ${request.method()} ${request.url()}${bodySnippet}`);
    }
  });

  // 3. Log Network Response Fetch / XHR
  page.on('response', async response => {
    const resourceType = response.request().resourceType();
    if (['fetch', 'xhr'].includes(resourceType)) {
      const url = response.url();
      const status = response.status();
      let bodySnippet = '';
      try {
        const text = await response.text();
        if (text) {
          bodySnippet = ` | Respon (${status}): ${text.replace(/\s+/g, ' ').slice(0, 400)}${text.length > 400 ? '...' : ''}`;
        }
      } catch (e) {
        bodySnippet = ` | Respon (${status}): [Gagal membaca body]`;
      }
      console.log(`  📥 [FETCH RESPONSE] HTTP ${status} <- ${url}${bodySnippet}`);
    }
  });

  // 4. Log Network Request Failed (Connection Refused / Failed to Fetch / Timeout)
  page.on('requestfailed', request => {
    const resourceType = request.resourceType();
    if (['fetch', 'xhr'].includes(resourceType)) {
      const failure = request.failure();
      const errorText = failure ? failure.errorText : 'Unknown Error';
      console.log(`  ❌ [FETCH FAILED] ${request.method()} ${request.url()} -> ERROR: ${errorText}`);
    }
  });

  // 5. Log Uncaught Page JS Error
  page.on('pageerror', err => {
    console.log(`  💥 [PAGE JS ERROR] ${err.stack || err.message}`);
  });

  // 6. Log Browser Console (Error / Warning / Log)
  page.on('console', msg => {
    const type = msg.type();
    if (['error', 'warning'].includes(type)) {
      console.log(`  🖥️  [CONSOLE ${type.toUpperCase()}] ${msg.text()}`);
    }
  });

  // 7. Log Browser Dialogs (Alert / Confirm / Prompt)
  page.on('dialog', async dialog => {
    console.log(`  💬 [BROWSER DIALOG] Tipe: "${dialog.type()}", Pesan: "${dialog.message()}"`);
  });
}

// Helpers logging aksi UI
const logAction = {
  navigate: (url) => console.log(`\n➡️  [AKSI: NAVIGASI] Mengakses URL -> "${url}"`),
  menu: (namaMenu) => console.log(`\n📂 [AKSI: PINDAH MENU] Membuka Halaman/Menu -> "${namaMenu}"`),
  input: (label, selector, value) => console.log(`  ✏️  [AKSI: ISI INPUT] ${label} (${selector}) <- "${value}"`),
  select: (label, selector, value) => console.log(`  🔽 [AKSI: PILIH DROPDOWN] ${label} (${selector}) <- "${value}"`),
  check: (label, selector) => console.log(`  ☑️  [AKSI: CENTANG] ${label} (${selector})`),
  click: (label, selector) => console.log(`  👆 [AKSI: KLIK TOMBOL] ${label} (${selector})`),
  dialogConfirm: (title) => console.log(`  ✅ [AKSI: KONFIRMASI DIALOG] Menyetujui dialog: "${title}"`),
  step: (deskripsi) => console.log(`\n📌 [LANGKAH] ${deskripsi}`),
  info: (deskripsi) => console.log(`  ℹ️  ${deskripsi}`),
  verify: (deskripsi) => console.log(`  🔍 [VERIFIKASI] ${deskripsi}`),
  success: (deskripsi) => console.log(`  ✨ [BERHASIL] ${deskripsi}\n`),
  error: (deskripsi) => console.log(`  🚨 [ERROR DETECTED] ${deskripsi}\n`)
};

module.exports = { attachLogger, logAction };

