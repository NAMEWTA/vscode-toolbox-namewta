import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import * as esbuild from 'esbuild';

export async function buildWebview(options = {}) {
  const production = options.production ?? process.argv.includes('--production');
  const watch = options.watch ?? process.argv.includes('--watch');
  await mkdir('dist/webview', { recursive: true });
  await mkdir('dist/meta', { recursive: true });

  const context = await esbuild.context({
    entryPoints: {
      main: 'src/webview/main.tsx',
      'git-review': 'src/webview/git-review-main.tsx',
    },
    bundle: true,
    outdir: 'dist/webview',
    entryNames: '[name]',
    assetNames: 'assets/[name]-[hash]',
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    jsx: 'automatic',
    sourcemap: production ? false : 'inline',
    minify: production,
    metafile: true,
    logLevel: 'info',
    legalComments: 'none',
  });

  const result = await context.rebuild();
  await writeFile(
    'dist/meta/webview-meta.json',
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
  await buildWebview();
}
