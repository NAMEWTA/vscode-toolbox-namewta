import { readFile } from 'node:fs/promises';

const tag = process.argv[2];
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const expectedTag = `v${packageJson.version}`;

if (tag !== expectedTag) {
  process.stderr.write(
    `发布标签必须与 package.json 版本一致：期望 ${expectedTag}，实际 ${tag ?? '未提供'}。\n`,
  );
  process.exitCode = 1;
}
