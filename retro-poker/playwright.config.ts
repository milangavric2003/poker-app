import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 } } }],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173',
    reuseExistingServer: false, timeout: 30_000 },
});

