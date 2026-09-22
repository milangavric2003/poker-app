import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'node', environment: 'node',
        include: ['tests/{unit,contract,integration}/**/*.test.ts'] } },
      { test: { name: 'ui', environment: 'jsdom',
        include: ['tests/ui/**/*.test.{ts,tsx}'] } },
    ],
  },
});
