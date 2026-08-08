import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/extension/**/*.integration.test.ts'],
    setupFiles: ['./src/webview/test/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/core/**/*.ts',
        'src/webview/platform/**/*.ts',
        'src/webview/app/**/*.tsx',
        'src/webview/features/**/*.tsx',
        'src/webview/features/**/*.ts',
      ],
      exclude: [
        '**/*.test.*',
        'src/webview/main.tsx',
        '**/public-api.ts',
        '**/index.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
