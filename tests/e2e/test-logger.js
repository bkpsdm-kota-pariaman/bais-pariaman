/**
 * Helper logger universal untuk pengujian Playwright E2E.
 * Menampilkan seluruh aktivitas browser secara detail di terminal:
 * - Akses URL / Navigasi
 * - Network Request & Response Fetch API (Status HTTP, Body JSON)
 * - Browser Console logs & Dialogs
 * - Aksi interaksi UI (Input, Klik, Select, Pindah Menu)
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
      const bodySnippet = postData ? ` | Payload: ${postData.slice(0, 150)}${postData.length > 150 ? '...' : ''}` : '';
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
          bodySnippet = ` | Respon: ${text.replace(/\s+/g, ' ').slice(0, 180)}${text.length > 180 ? '...' : ''}`;
        }
      } catch (e) {}
      console.log(`  📥 [FETCH RESPONSE] HTTP ${status} <- ${url}${bodySnippet}`);
    }
  });

  // 4. Log Browser Console
  page.on('console', msg => {
    const type = msg.type();
    if (['error', 'warning'].includes(type)) {
      console.log(`  🖥️  [CONSOLE ${type.toUpperCase()}] ${msg.text()}`);
    }
  });

  // 5. Log Browser Dialogs (Alert / Confirm / Prompt)
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
  success: (deskripsi) => console.log(`  ✨ [BERHASIL] ${deskripsi}\n`)
};

module.exports = { attachLogger, logAction };
