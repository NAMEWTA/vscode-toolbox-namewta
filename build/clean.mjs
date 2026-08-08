import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

await Promise.all([
  rm('dist', { recursive: true, force: true }),
  rm('dist-tests', { recursive: true, force: true }),
  rm('coverage', { recursive: true, force: true }),
  rm('artifacts', { recursive: true, force: true }),
  rm('.vscode-test', { recursive: true, force: true }),
  rm(path.join(os.tmpdir(), 'dt-vscode-test'), { recursive: true, force: true }),
]);
