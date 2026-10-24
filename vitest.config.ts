import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30000,
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // These files contain only erased interfaces/type aliases, no executable statements.
      exclude: [
        'src/application/contracts/*.ts',
        'src/application/internal/protocols.ts',
        'src/application/ports/FileStore.ts',
        'src/application/ports/SvgCodec.ts',
        'src/domain/values/contracts.ts',
        'src/domain/internal/protocols.ts',
        'src/infrastructure/svg/parsed-types.ts',
        'src/infrastructure/files/file-system-port.ts',
      ],
      reporter: ['text', 'json-summary', 'json', 'lcov'],
      reportOnFailure: true,
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 75,
        'src/domain/**/*.ts': { lines: 90, statements: 90, branches: 85 },
        'src/application/history/**/*.ts': { lines: 90, statements: 90, branches: 85 },
        'src/application/session/**/*.ts': { lines: 90, statements: 90, branches: 85 },
      },
    },
  },
});
