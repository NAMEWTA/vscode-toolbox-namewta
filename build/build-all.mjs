import process from 'node:process';
import { buildExtension } from './build-extension.mjs';
import { buildWebview } from './build-webview.mjs';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

if (!watch) {
  await Promise.all([buildExtension({ production }), buildWebview({ production })]);
} else {
  const contexts = await Promise.all([
    buildExtension({ production, watch: true }),
    buildWebview({ production, watch: true }),
  ]);

  const dispose = async () => {
    await Promise.all(contexts.map((context) => context?.dispose()));
    process.exit(0);
  };

  process.once('SIGINT', () => void dispose());
  process.once('SIGTERM', () => void dispose());
  process.stdout.write('正在监听扩展与 Webview 源码。\n');
  await new Promise(() => undefined);
}
