const { defineConfig, devices } = require('@playwright/test');

const isRemote = Boolean(process.env.BASE_URL);

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
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
  webServer: isRemote ? undefined : {
    command: 'node tests/server.js',
    port: 8080,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'Admin Desktop',
      testMatch: /admin-(?!full-cycle).*\.spec\.js$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'PWA Mobile',
      testMatch: /pwa-(?!admin).*\.spec\.js$/,
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
      testMatch: /.*full-cycle.*\.spec\.js$/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
