import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1, // One prescribed browser Origin/port and one local game at a time.
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 } } }],
});

