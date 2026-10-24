import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['test/performance/**/*.perf.ts'],
    testTimeout: 180000,
    passWithNoTests: false,
    fileParallelism: false,
  },
});
