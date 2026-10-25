import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    // Bound concurrent worker startup across both projects, including jsdom.
    maxWorkers: Math.min(4, availableParallelism()),
    projects: [
      { test: { name: 'node', environment: 'node',
        include: ['tests/{unit,contract,integration}/**/*.test.ts'] } },
      { test: { name: 'ui', environment: 'jsdom',
        include: ['tests/ui/**/*.test.{ts,tsx}'] } },
    ],
  },
});
