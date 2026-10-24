import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    reporters: ['default', 'json', 'junit'],
    outputFile: { json: 'reports/tests.json', junit: 'reports/junit.xml' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/test-setup.ts', 'src/main.tsx', 'src/types.ts'],
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      thresholds: { statements: 85, branches: 75, functions: 85, lines: 85 },
    },
  },
});
