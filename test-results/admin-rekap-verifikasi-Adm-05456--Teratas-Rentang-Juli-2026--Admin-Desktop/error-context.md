# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-rekap-verifikasi.spec.js >> Admin Rekap Kehadiran - Fitur Verifikasi Manual & Hapus Data (5 Data Teratas) >> Uji coba Verifikasi Manual & Hapus Data pada 5 Data Teratas (Rentang Juli 2026)
- Location: tests\e2e\admin-rekap-verifikasi.spec.js:47:3

# Error details

```
Error: expect(locator).toBeHidden() failed

Locator:  locator('#modalVerifikasi')
Expected: hidden
Received: visible

Call log:
  - Expect "toBeHidden" with timeout 15000ms
  - waiting for locator('#modalVerifikasi')
    5 × locator resolved to <div tabindex="-1" role="dialog" aria-modal="true" id="modalVerifikasi" class="modal fade show" data-bs-backdrop="static">…</div>
      - unexpected value "visible"
    25 × locator resolved to <div tabindex="-1" role="dialog" aria-modal="true" aria-hidden="true" id="modalVerifikasi" class="modal fade show" data-bs-backdrop="static">…</div>
       - unexpected value "visible"
  - Test ended.

```

```
Error: browserContext.close: Test ended.
Browser logs:

<launching> C:\Users\lenovo\AppData\Local\ms-playwright\chromium_headless_shell-1234\chrome-headless-shell-win64\chrome-headless-shell.exe --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,BlockOriginHeaderModificationOnRedirect,Translate,AutoDeElevate,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --disable-updater-scheduler --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --use-fake-ui-for-media-stream --use-fake-device-for-media-stream --user-data-dir=C:\Users\lenovo\AppData\Local\Temp\playwright_chromiumdev_profile-QH0lhI --remote-debugging-pipe --no-startup-window
<launched> pid=22620
```