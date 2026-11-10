import { defineConfig } from '@playwright/test';

// In local emulator mode, start (or reuse) the emulators and the web dev server.
const startLocalStack =
  process.env['BARBERHQ_TEST_MODE'] === 'emulator' &&
  !process.env['BARBERHQ_TEST_CONFIG'] &&
  !process.env['BARBERHQ_BASE_URL'];

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: process.env['BARBERHQ_BASE_URL'] ?? 'http://127.0.0.1:4200',
    trace: 'retain-on-failure',
  },
  reporter: 'list',
  webServer: startLocalStack
    ? [
        {
          name: 'emulators',
          command: 'npm run dev:emulators',
          // The Emulator UI comes up after every emulator is ready.
          url: 'http://127.0.0.1:4000',
          reuseExistingServer: true,
          timeout: 180_000,
          // SIGINT lets --export-on-exit save .emulator-data.
          gracefulShutdown: { signal: 'SIGINT', timeout: 30_000 },
        },
        {
          name: 'web',
          command: 'npm run dev:web',
          url: 'http://127.0.0.1:4200',
          reuseExistingServer: true,
          timeout: 180_000,
        },
      ]
    : undefined,
});
