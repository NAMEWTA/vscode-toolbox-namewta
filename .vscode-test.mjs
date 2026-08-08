import { defineConfig } from '@vscode/test-cli';
import os from 'node:os';
import path from 'node:path';

const testProfileDirectory = path.join(os.tmpdir(), 'dt-vscode-test');

export default defineConfig({
  label: 'desktop',
  files: 'dist-tests/**/*.integration.test.js',
  version: 'stable',
  workspaceFolder: './tests/fixtures/empty-workspace',
  mocha: {
    timeout: 30_000,
    color: true,
    ui: 'tdd',
  },
  launchArgs: [
    '--disable-extensions',
    '--skip-welcome',
    '--skip-release-notes',
    `--user-data-dir=${path.join(testProfileDirectory, 'user-data')}`,
    `--extensions-dir=${path.join(testProfileDirectory, 'extensions')}`,
  ],
});
