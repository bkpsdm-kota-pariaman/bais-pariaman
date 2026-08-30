const { defineConfig, devices } = require('@playwright/test');

const isRemote = Boolean(process.env.BASE_URL);

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  maxFailures: 1,
  expect: {
    timeout: 10000
  },

  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080/',
    trace: 'on-first-retry',
    permissions: ['geolocation', 'camera'],
    geolocation: { latitude: -0.6276, longitude: 100.1209 },
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
    }
  },
  webServer: (!process.env.BASE_URL || process.env.BASE_URL.includes('localhost') || process.env.USE_LOCAL_SERVER) ? {
    command: 'node tests/server.js',
    port: 8080,
    reuseExistingServer: true,
  } : undefined,
  projects: [
    {
      name: 'Admin Desktop',
      testMatch: '**/admin-*.spec.js',
      testIgnore: '**/admin-full-cycle*.spec.js',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'PWA Mobile',
      testMatch: '**/pwa-*.spec.js',
      use: {
        ...devices['Pixel 5'],
        contextOptions: {
          permissions: ['geolocation', 'camera'],
          geolocation: { latitude: -0.6276, longitude: 100.1209 }
        }
      },
    },
    {
      name: 'Full Cycle E2E',
      testMatch: '**/admin-full-cycle*.spec.js',
      use: {
        ...devices['Pixel 5'],
        permissions: ['geolocation', 'camera'],
        geolocation: { latitude: -0.6276, longitude: 100.1209 },
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
        }
      },
    },
  ],
});
