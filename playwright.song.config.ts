import { defineConfig } from '@playwright/test';

/**
 * Local acceptance profile for the Sóng Homestay project. Start the local
 * Convex backend first (`npm run convex:dev`), then run `npm run test:e2e:song`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/song-homestay.e2e.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4175',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
