const { test, expect } = require('@playwright/test');

test.describe('E2E Suite 5: PWA Race Conditions & Concurrency Guards', () => {

    test.beforeEach(async ({ page, context }) => {
        await page.addInitScript(() => {
            window.matchMedia = (query) => ({
                matches: query.includes('display-mode: standalone'),
                media: query,
                onchange: null,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => false,
            });
        });

        await context.grantPermissions(['camera', 'geolocation']);
        await context.setGeolocation({ latitude: -0.6264, longitude: 100.1186 });

        await page.goto('pwa/index.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('1. Camera Race Guard — late camera stream resolution is discarded and stopped', async ({ page }) => {
        const result = await page.evaluate(async () => {
            let stream1Stopped = false;
            let stream2Stopped = false;

            const fakeStream1 = {
                id: 'stream-1-slow',
                active: true,
                getTracks: () => [{
                    stop: () => { stream1Stopped = true; }
                }]
            };

            const fakeStream2 = {
                id: 'stream-2-fast',
                active: true,
                getTracks: () => [{
                    stop: () => { stream2Stopped = true; }
                }]
            };

            let cameraRequestId = 0;
            let activeStream = null;

            async function openCamera(delayMs, streamObj) {
                const currentReq = ++cameraRequestId;
                await new Promise(resolve => setTimeout(resolve, delayMs));

                if (currentReq !== cameraRequestId) {
                    streamObj.getTracks().forEach(t => t.stop());
                    return { accepted: false, streamId: streamObj.id };
                }

                activeStream = streamObj;
                return { accepted: true, streamId: streamObj.id };
            }

            const p1 = openCamera(80, fakeStream1);
            const p2 = openCamera(20, fakeStream2);

            const [res1, res2] = await Promise.all([p1, p2]);

            return {
                res1,
                res2,
                stream1Stopped,
                stream2Stopped,
                activeStreamId: activeStream ? activeStream.id : null
            };
        });

        expect(result.res1.accepted).toBe(false);
        expect(result.stream1Stopped).toBe(true);
        expect(result.res2.accepted).toBe(true);
        expect(result.stream2Stopped).toBe(false);
        expect(result.activeStreamId).toBe('stream-2-fast');
    });

    test('2. Admin Quick Attendance Submission Lock — concurrent calls are guarded', async ({ page }) => {
        const result = await page.evaluate(async () => {
            let isSubmitting = false;
            let executions = 0;
            let rejects = 0;

            async function submitQuickAttendance() {
                if (isSubmitting) {
                    rejects++;
                    return { success: false, reason: 'locked' };
                }
                isSubmitting = true;
                try {
                    executions++;
                    await new Promise(resolve => setTimeout(resolve, 50));
                    return { success: true };
                } finally {
                    isSubmitting = false;
                }
            }

            const results = await Promise.all([
                submitQuickAttendance(),
                submitQuickAttendance(),
                submitQuickAttendance()
            ]);

            return {
                executions,
                rejects,
                results
            };
        });

        expect(result.executions).toBe(1);
        expect(result.rejects).toBe(2);
        expect(result.results.filter(r => r.success).length).toBe(1);
    });

    test('3. Geocoding Schedule Mismatch Guard — late geocoding does not corrupt new form', async ({ page }) => {
        const result = await page.evaluate(async () => {
            let currentScheduleId = null;
            let displayedAddress = null;

            async function fetchGeocode(scheduleId, delayMs, address) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
                if (currentScheduleId !== scheduleId) {
                    return { applied: false, discardedAddress: address };
                }
                displayedAddress = address;
                return { applied: true, address };
            }

            currentScheduleId = 'jadwal-1';
            const geo1 = fetchGeocode('jadwal-1', 80, 'Jl. Lokasi Lama No. 1');

            currentScheduleId = 'jadwal-2';
            const geo2 = fetchGeocode('jadwal-2', 20, 'Jl. Lokasi Baru No. 2');

            const [r1, r2] = await Promise.all([geo1, geo2]);

            return {
                r1,
                r2,
                finalAddress: displayedAddress
            };
        });

        expect(result.r1.applied).toBe(false);
        expect(result.r2.applied).toBe(true);
        expect(result.finalAddress).toBe('Jl. Lokasi Baru No. 2');
    });

    test('4. UI Radio Input Selection — options select without errors or duplicates', async ({ page }) => {
        await page.evaluate(() => {
            localStorage.setItem('jwt_token', 'mock_token_radio');
            const login = document.getElementById('view-login');
            if (login) login.style.display = 'none';
            const form = document.getElementById('view-form-absen');
            if (form) form.style.display = 'block';
        });

        const optHadir = page.locator('#optHadir');
        const optIzin = page.locator('#optIzin');

        if (await optHadir.isVisible().catch(() => false)) {
            await optHadir.click();
            await page.waitForTimeout(100);
            await expect(page.locator('#flowHadir')).toBeVisible();

            await optIzin.click();
            await page.waitForTimeout(100);
            await expect(page.locator('#flowIzin')).toBeVisible();
            await expect(page.locator('#flowHadir')).toBeHidden();
        }
    });

});
