import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import * as esbuild from 'esbuild';

export async function buildExtension(options = {}) {
  const production = options.production ?? process.argv.includes('--production');
  const watch = options.watch ?? process.argv.includes('--watch');
  await mkdir('dist/extension', { recursive: true });
  await mkdir('dist/meta', { recursive: true });

  const context = await esbuild.context({
    entryPoints: ['src/extension/extension.ts'],
    bundle: true,
    outfile: 'dist/extension/extension.cjs',
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['vscode'],
    sourcemap: production ? false : 'inline',
    minify: production,
    metafile: true,
    logLevel: 'info',
    legalComments: 'none',
  });

  const result = await context.rebuild();
  await writeFile(
    'dist/meta/extension-meta.json',
    `${JSON.stringify(result.metafile, null, 2)}\n`,
  );

  if (watch) {
    await context.watch();
    return context;
  }

  await context.dispose();
  return undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildExtension();
}
