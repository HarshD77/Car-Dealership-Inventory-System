import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 15000,
    hookTimeout: 20000,
    fileParallelism: false,
    reporters: ['default', 'json', 'junit'],
    outputFile: { json: 'reports/tests.json', junit: 'reports/junit.xml' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/create-admin.ts'],
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      thresholds: { statements: 90, branches: 80, functions: 90, lines: 90 },
    },
  },
});
