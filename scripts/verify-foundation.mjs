import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];
const requiredFiles = [
  'package.json',
  'AGENTS.md',
  'README.md',
  'LICENSE.zh-CN.md',
  'docs/architecture/overview.md',
  'docs/architecture/adding-a-domain.md',
  'src/extension/extension.ts',
  'src/extension/bootstrap/create-extension-runtime.ts',
  'src/core/orchestration/toolbox-gateway.ts',
  'src/core/orchestration/tool-registry.ts',
  'src/core/domains/system-info/system-info-handler.ts',
  'src/webview/main.tsx',
  'src/webview/platform/webview-message-client.ts',
  'src/webview/app/ToolboxApp.tsx',
  'build/build-extension.mjs',
  'build/build-webview.mjs',
  '.github/workflows/ci.yml',
];

for (const relativePath of requiredFiles) {
  if (!(await exists(relativePath))) {
    failures.push(`缺少基座必需文件：${relativePath}`);
  }
}

const ruleFiles = await listFiles('docs/rules');
if (ruleFiles.length < 17) {
  failures.push(`规则文档至少应有 17 份，当前只有 ${ruleFiles.length} 份。`);
}

const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const expectedCommands = [
  'vscodeToolboxNamewta.openToolbox',
  'vscodeToolboxNamewta.showRuntimeInfo',
  'vscodeToolboxNamewta.copyReference.relative',
  'vscodeToolboxNamewta.copyReference.absolute',
  'vscodeToolboxNamewta.gitBlame.toggle',
  'vscodeToolboxNamewta.gitBlame.show',
  'vscodeToolboxNamewta.gitBlame.hide',
  'vscodeToolboxNamewta.gitBlame.refresh',
  'vscodeToolboxNamewta.gitBlame.viewLineHistory',
];
const contributedCommands =
  packageJson.contributes?.commands?.map(({ command }) => command) ?? [];
for (const command of expectedCommands) {
  if (!contributedCommands.includes(command)) {
    failures.push(`package.json 未贡献命令：${command}`);
  }
}
verifyReleaseSurface(packageJson, contributedCommands);
verifyExtensionIdentity(packageJson);
if (packageJson.publisher !== 'NAMEWTA') {
  failures.push('package.json 的 publisher 必须是已确认的发布身份 NAMEWTA。');
}

function verifyExtensionIdentity(manifest) {
  if (manifest.name !== 'vscode-toolbox-namewta') {
    failures.push('package.json 的扩展包名必须是 vscode-toolbox-namewta。');
  }
  if (manifest.displayName !== 'vscode-toolbox-namewta') {
    failures.push('package.json 的显示名必须是 vscode-toolbox-namewta。');
  }
  if (manifest.private !== true) {
    failures.push('package.json 必须保持 private: true，禁止 npm 发布。');
  }
  if (
    manifest.repository?.url !== 'https://github.com/NAMEWTA/vscode-toolbox-namewta.git'
  ) {
    failures.push('package.json 的 repository 必须指向公开 GitHub 仓库。');
  }
}
if (packageJson.main !== './dist/extension/extension.cjs') {
  failures.push('package.json 的 main 必须指向扩展宿主 Bundle 入口。');
}
if (packageJson.packageManager !== 'pnpm@11.18.0') {
  failures.push('packageManager 必须固定为 pnpm@11.18.0。');
}

const sourceFiles = await listFiles('src');
const genericFileNames = new Set([
  'utils.ts',
  'helpers.ts',
  'common.ts',
  'misc.ts',
  'general.ts',
  'manager.ts',
  'processor.ts',
  'handler.ts',
  'types.ts',
  'constants.ts',
]);
for (const file of sourceFiles) {
  if (genericFileNames.has(path.basename(file))) {
    failures.push(`禁止使用模糊源码文件名：${file}`);
  }
}

await verifyImportBoundary('src/core', [
  /from\s+['"]vscode['"]/,
  /from\s+['"]react(?:-dom)?(?:\/[^'"]*)?['"]/,
  /from\s+['"]node:/,
  /from\s+['"][^'"]*\/extension\//,
  /from\s+['"][^'"]*\/webview\//,
]);
await verifyImportBoundary('src/webview', [
  /from\s+['"]vscode['"]/,
  /from\s+['"]node:/,
  /from\s+['"][^'"]*\/extension\//,
]);

const html = await readFile(
  path.join(root, 'src/extension/presentation/toolbox-panel-html.ts'),
  'utf8',
);
for (const marker of [
  "default-src 'none'",
  "script-src 'nonce-${nonce}'",
  'localResourceRoots',
]) {
  const target =
    marker === 'localResourceRoots'
      ? await readFile(
          path.join(root, 'src/extension/presentation/toolbox-panel-controller.ts'),
          'utf8',
        )
      : html;
  if (!target.includes(marker)) {
    failures.push(`缺少 Webview 安全标记：${marker}`);
  }
}

const commandSource = await readFile(
  path.join(root, 'src/extension/commands/open-toolbox-command.ts'),
  'utf8',
);
if (!commandSource.includes("'vscodeToolboxNamewta.openToolbox'")) {
  failures.push('“打开工具箱”命令 ID 与 package.json 不一致。');
}

await verifyChineseMarkdown();
await verifyChineseSourceComments();
await verifyLocalization(packageJson, sourceFiles);
await verifyThirdPartyNotices();

if (failures.length > 0) {
  process.stderr.write(`${failures.map((failure) => `- ${failure}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `基座校验通过：${sourceFiles.length} 个源码文件，${ruleFiles.length} 份规则文档。\n`,
  );
}

async function exists(relativePath) {
  try {
    await stat(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function listFiles(relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(relativePath)));
    } else {
      files.push(relativePath.replaceAll(path.sep, '/'));
    }
  }
  return files.sort();
}

async function verifyImportBoundary(relativeDirectory, forbiddenPatterns) {
  const files = await listFiles(relativeDirectory);
  for (const file of files.filter((candidate) => /\.tsx?$/.test(candidate))) {
    const source = await readFile(path.join(root, file), 'utf8');
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(source)) {
        failures.push(`发现非法跨运行边界导入：${file}，规则 ${pattern}`);
      }
    }
  }
}

function verifyReleaseSurface(manifest, contributedCommands) {
  const changeCommands = contributedCommands.filter(
    (command) =>
      command.startsWith('vscodeToolboxNamewta.copyReference.') ||
      (command.startsWith('vscodeToolboxNamewta.gitBlame.') &&
        command !== 'vscodeToolboxNamewta.gitBlame.openReader'),
  );
  if (changeCommands.length !== 9) {
    failures.push(
      `Copy/Blame 用户命令必须恰好为 9 个，当前为 ${changeCommands.length} 个。`,
    );
  }
  if (contributedCommands.some((command) => command.includes('.internal.'))) {
    failures.push('内部 Hover 命令不得贡献到 Manifest。');
  }
  const blameConfigurations = Object.keys(
    manifest.contributes?.configuration?.properties ?? {},
  ).filter((key) => key.startsWith('vscodeToolboxNamewta.gitBlame.'));
  if (blameConfigurations.length !== 3) {
    failures.push(
      `Git Blame 公开配置必须恰好为 3 项，当前为 ${blameConfigurations.length} 项。`,
    );
  }
  const keybindings = manifest.contributes?.keybindings ?? [];
  if (
    keybindings.length !== 1 ||
    keybindings[0]?.command !== 'vscodeToolboxNamewta.gitBlame.toggle' ||
    keybindings[0]?.key !== 'ctrl+alt+b' ||
    keybindings[0]?.mac !== 'cmd+alt+b'
  ) {
    failures.push('默认快捷键必须只分配给 Git Blame Toggle。');
  }
  const lineMenuCommands = (
    manifest.contributes?.menus?.['editor/lineNumber/context'] ?? []
  ).map(({ command }) => command);
  for (const command of [
    'vscodeToolboxNamewta.gitBlame.toggle',
    'vscodeToolboxNamewta.gitBlame.viewLineHistory',
  ]) {
    if (!lineMenuCommands.includes(command)) {
      failures.push(`行号菜单缺少命令：${command}`);
    }
  }
  if (contributedCommands.some((command) => /paste|combined|all/iu.test(command))) {
    failures.push('Manifest 不得贡献 Paste 或跨域组合命令。');
  }
}

async function verifyLocalization(manifest, sourceFiles) {
  const packageNls = JSON.parse(
    await readFile(path.join(root, 'package.nls.json'), 'utf8'),
  );
  const packageNlsZh = JSON.parse(
    await readFile(path.join(root, 'package.nls.zh-cn.json'), 'utf8'),
  );
  for (const key of collectManifestNlsKeys(manifest)) {
    if (!(key in packageNls) || !(key in packageNlsZh)) {
      failures.push(`Manifest NLS 缺少双语键：${key}`);
    }
  }
  const runtimeNls = JSON.parse(
    await readFile(path.join(root, 'l10n/bundle.l10n.json'), 'utf8'),
  );
  const runtimeNlsZh = JSON.parse(
    await readFile(path.join(root, 'l10n/bundle.l10n.zh-cn.json'), 'utf8'),
  );
  for (const file of sourceFiles.filter((candidate) =>
    candidate.startsWith('src/extension/'),
  )) {
    const source = await readFile(path.join(root, file), 'utf8');
    for (const match of source.matchAll(/vscode\.l10n\.t\(\s*(['"])([^'"]+)\1/gu)) {
      const key = match[2];
      if (key !== undefined && (!(key in runtimeNls) || !(key in runtimeNlsZh))) {
        failures.push(`运行时 l10n 缺少双语键：${key}（${file}）`);
      }
    }
  }
}

function collectManifestNlsKeys(value) {
  const keys = new Set();
  visitJson(value, (text) => {
    const match = /^%([^%]+)%$/u.exec(text);
    if (match?.[1] !== undefined) {
      keys.add(match[1]);
    }
  });
  return keys;
}

function visitJson(value, visit) {
  if (typeof value === 'string') {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      visitJson(item, visit);
    }
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) {
      visitJson(item, visit);
    }
  }
}

async function verifyThirdPartyNotices() {
  const notices = await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  for (const copyright of [
    'Copyright (c) 2023 Hank Bao',
    'Copyright (c) 2024 lkqm',
    'Copyright (c) 2026 NAMEWTA',
  ]) {
    if (!notices.includes(copyright)) {
      failures.push(`第三方声明缺少版权信息：${copyright}`);
    }
  }
  for (const file of ['package.json', 'README.md', 'SECURITY.md']) {
    const content = await readFile(path.join(root, file), 'utf8');
    if (/your-publisher|显式占位说明/iu.test(content)) {
      failures.push(`发布材料仍包含未替换占位：${file}`);
    }
  }
}

async function verifyChineseMarkdown() {
  const rootEntries = await readdir(root, { withFileTypes: true });
  const rootMarkdownFiles = rootEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name);
  const markdownFiles = [
    ...rootMarkdownFiles,
    ...(await listFiles('docs')).filter((file) => file.endsWith('.md')),
    ...(await listFiles('media')).filter((file) => file.endsWith('.md')),
    ...(await listFiles('tests')).filter((file) => file.endsWith('.md')),
  ];

  for (const file of markdownFiles) {
    const lines = (await readFile(path.join(root, file), 'utf8')).split(/\r?\n/u);
    let isCodeBlock = false;

    for (const [index, line] of lines.entries()) {
      if (line.trimStart().startsWith('```')) {
        isCodeBlock = !isCodeBlock;
        continue;
      }
      if (isCodeBlock || hasChinese(line)) {
        continue;
      }

      const prose = line
        .replace(/`[^`]*`/gu, '')
        .replace(/!?\[[^\]]*\]\([^)]*\)/gu, '')
        .replace(/https?:\/\/\S+/gu, '');
      const englishWordCount = prose.match(/[A-Za-z][A-Za-z-]*/gu)?.length ?? 0;
      if (englishWordCount >= 4) {
        failures.push(`Markdown 文档存在英文叙述：${file}:${index + 1} ${line.trim()}`);
      }
    }
  }
}

async function verifyChineseSourceComments() {
  const sourceLikeFiles = [
    ...(await listFiles('src')),
    ...(await listFiles('build')),
    ...(await listFiles('scripts')),
    ...(await listFiles('.github')),
    'eslint.config.mjs',
    'dependency-cruiser.config.cjs',
    'vitest.config.ts',
    '.vscode-test.mjs',
  ].filter((file) => /\.(?:ts|tsx|js|mjs|cjs|css|yml|yaml)$/u.test(file));

  for (const file of sourceLikeFiles) {
    const lines = (await readFile(path.join(root, file), 'utf8')).split(/\r?\n/u);
    let isBlockComment = false;

    for (const [index, line] of lines.entries()) {
      const trimmed = line.trim();
      const startsBlock = trimmed.startsWith('/*');
      const isComment =
        isBlockComment ||
        startsBlock ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('# ');

      if (startsBlock && !trimmed.slice(trimmed.indexOf('/*') + 2).includes('*/')) {
        isBlockComment = true;
      }
      if (isBlockComment && trimmed.includes('*/')) {
        isBlockComment = false;
      }
      if (!isComment || hasChinese(trimmed) || isMachineReadableComment(trimmed)) {
        continue;
      }

      const englishWordCount = trimmed.match(/[A-Za-z][A-Za-z-]*/gu)?.length ?? 0;
      if (englishWordCount >= 4) {
        failures.push(`源码注释存在英文叙述：${file}:${index + 1} ${trimmed}`);
      }
    }
  }
}

function hasChinese(value) {
  return /[\u3400-\u9fff]/u.test(value);
}

function isMachineReadableComment(value) {
  return (
    value.startsWith('// @vitest-environment') ||
    value.startsWith('/** @type') ||
    value.startsWith('/* eslint') ||
    value.startsWith('// eslint')
  );
}
