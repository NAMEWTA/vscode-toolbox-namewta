import { mkdir } from 'node:fs/promises';
import process from 'node:process';
import * as esbuild from 'esbuild';

await mkdir('dist-tests', { recursive: true });

await esbuild.build({
  entryPoints: [
    'src/extension/extension.integration.test.ts',
    'tests/integration/git-blame-repository.integration.test.ts',
    'tests/integration/git-blame-annotations.integration.test.ts',
    'tests/integration/git-blame-hover.integration.test.ts',
    'tests/integration/git-history.integration.test.ts',
    'tests/integration/git-line-history.integration.test.ts',
    'tests/integration/trusted-workspace.integration.test.ts',
    'tests/integration/suite/index.ts',
  ],
  bundle: true,
  outdir: 'dist-tests',
  outbase: '.',
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  sourcemap: true,
  logLevel: 'info',
});

if (process.env.CI === 'true') {
  process.stdout.write('扩展宿主集成测试 Bundle 已生成。\n');
}
