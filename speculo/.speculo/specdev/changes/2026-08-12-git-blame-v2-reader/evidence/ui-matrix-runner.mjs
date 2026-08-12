import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const changeDirectory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(changeDirectory, '../../../../../..');
const codeExecutable = path.join(
  repository,
  '.vscode-test/vscode-darwin-arm64-1.133.0/Visual Studio Code.app/Contents/MacOS/Code',
);
const matrixRoot = await mkdtemp('/tmp/brm-');
const workspace = path.join(matrixRoot, 'workspace');
const sourcePath = 'src/extension/bootstrap/create-extension-runtime.ts';
const largePath = 'large-reader-fixture.ts';
const unavailablePath = 'untracked-reader-fixture.ts';
const zooms = [
  { label: '100', level: 0, dpr: 1, port: 9350 },
  { label: '125', level: 1.2239010857, dpr: 1.25, port: 9351 },
  { label: '150', level: 2.2239010857, dpr: 1.5, port: 9352 },
];
const themes = [
  {
    key: 'light',
    label: 'Light Modern',
    themeId: 'Light Modern',
    className: 'vscode-light',
  },
  {
    key: 'dark',
    label: 'Dark Modern',
    themeId: 'Dark Modern',
    className: 'vscode-dark',
  },
  {
    key: 'high-contrast',
    label: 'Dark High Contrast',
    themeId: 'Default High Contrast',
    className: 'vscode-high-contrast',
  },
];

await run('git', ['clone', '--quiet', '--no-hardlinks', repository, workspace]);
const sourceFixture = await readFile(path.join(workspace, sourcePath));
const largeFixture = Buffer.from(
  Array.from(
    { length: 5_001 },
    (_, index) =>
      `export const line${String(index + 1)} = "Reader 大文件 ${String(index + 1)}\t保真";`,
  ).join('\n') + '\n',
);
await writeFile(path.join(workspace, largePath), largeFixture);
await runInWorkspace('git', ['add', largePath]);
await runInWorkspace('git', [
  '-c',
  'user.name=Reader Matrix',
  '-c',
  'user.email=reader@example.com',
  'commit',
  '--quiet',
  '-m',
  '添加 Reader 大文件矩阵夹具',
]);
await writeFile(path.join(workspace, unavailablePath), 'const untracked = true;\n');
const results = [];
const interactionResults = {};
const originalClipboard = await runCapture('pbpaste', []);
try {
  for (const zoom of zooms) {
    const result = await runZoomMatrix(zoom);
    results.push(...result);
  }
} finally {
  await runWithInput('pbcopy', [], originalClipboard);
}
await writeFile(
  path.join(changeDirectory, 'ui-matrix-results.json'),
  `${JSON.stringify({ workspace, results }, null, 2)}\n`,
  'utf8',
);
await writeFile(
  path.join(changeDirectory, 'ui-interaction-results.json'),
  `${JSON.stringify(interactionResults, null, 2)}\n`,
  'utf8',
);
console.log(
  `UI_MATRIX_PASS combinations=${String(results.length)} workspace=${workspace}`,
);

async function runZoomMatrix(zoom) {
  const profileRoot = path.join(matrixRoot, `profile-${zoom.label}`);
  const userDirectory = path.join(profileRoot, 'user-data');
  const extensionDirectory = path.join(profileRoot, 'extensions');
  await mkdir(path.join(userDirectory, 'User'), { recursive: true });
  await mkdir(extensionDirectory, { recursive: true });
  await writeFile(
    path.join(userDirectory, 'User', 'settings.json'),
    `${JSON.stringify(
      {
        'workbench.colorTheme': 'Dark Modern',
        'window.zoomLevel': zoom.level,
        'editor.accessibilitySupport': 'on',
        'editor.wordWrap': 'on',
        'editor.rulers': [80],
        'telemetry.telemetryLevel': 'off',
        'update.mode': 'none',
        'extensions.autoUpdate': false,
        'security.workspace.trust.enabled': false,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  const process = spawn(
    codeExecutable,
    [
      `--user-data-dir=${userDirectory}`,
      `--extensions-dir=${extensionDirectory}`,
      `--extensionDevelopmentPath=${repository}`,
      '--disable-workspace-trust',
      '--skip-welcome',
      '--skip-release-notes',
      '--disable-updates',
      '--locale=en',
      `--remote-debugging-port=${String(zoom.port)}`,
      '--new-window',
      workspace,
    ],
    { cwd: repository, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const output = [];
  process.stdout.on('data', (chunk) => output.push(chunk));
  process.stderr.on('data', (chunk) => output.push(chunk));
  try {
    await waitForTargets(zoom.port, (targets) =>
      targets.some((target) => target.type === 'page'),
    );
    const page = await connectToTarget(zoom.port, 'page');
    await page.call('Page.bringToFront');
    await page.call('Runtime.enable');
    await waitForWorkbench(page);
    await openSourceAndReader(page, zoom);
    const combinations = [];
    for (const theme of themes) {
      await selectTheme(page, theme.label);
      const measurement = await measureCombination(page, zoom, theme);
      combinations.push(measurement);
      console.log(
        `UI_MATRIX_CASE theme=${theme.key} zoom=${zoom.label} dpr=${String(measurement.workbench.dpr)} width=${String(measurement.reader.viewport[0])}`,
      );
    }
    if (zoom.label === '100') {
      interactionResults.readerWorkflow = await verifyReaderWorkflow(page);
      await writeFile(path.join(workspace, sourcePath), sourceFixture);
      console.log('UI_INTERACTION_PASS workflow=reader');
    }
    page.close();
    return combinations;
  } finally {
    await stopProcess(process);
    await writeFile(
      path.join(changeDirectory, `ui-matrix-vscode-${zoom.label}.log`),
      Buffer.concat(output),
    );
  }
}

async function openSourceAndReader(page, zoom) {
  await page.press('p', 'KeyP', 80, 4);
  await waitForValue(
    page,
    `Boolean(document.querySelector('.quick-input-widget'))`,
    Boolean,
    'Quick Open 未显示',
  );
  await replaceInput(page, sourcePath);
  const sourceCandidates = await waitForValue(
    page,
    `[...document.querySelectorAll('.quick-input-list .monaco-list-row')].map((element) => element.innerText)`,
    (value) =>
      value.some((candidate) => candidate.includes('create-extension-runtime.ts')),
    'Quick Open 没有目标源码',
  );
  assert(
    sourceCandidates.some((candidate) =>
      candidate.includes('create-extension-runtime.ts'),
    ),
    `Quick Open 没有目标源码: ${JSON.stringify(sourceCandidates)}`,
  );
  await page.press('Enter', 'Enter', 13);
  await delay(1_000);
  const activeResource = await page.evaluate(
    `document.querySelector('.tab.active .label-name')?.textContent ?? document.querySelector('.tab.active')?.ariaLabel ?? ''`,
  );
  assert(
    activeResource.includes('create-extension-runtime.ts'),
    `活动编辑器不是目标源码: ${activeResource}`,
  );
  await page.press('g', 'KeyG', 71, 2);
  await page.call('Input.insertText', { text: '25' });
  await page.press('Enter', 'Enter', 13);
  await delay(300);
  if (zoom.label === '100') {
    interactionResults.normalEditor = await verifyNormalEditorLayout(page);
  }
  await executeCommand(page, 'toolbox-Open Full-file Blame Reader');
  await waitForTargets(page.port, (targets) =>
    targets.some((target) => target.type === 'iframe'),
  );
  await waitForReader(page.port, (value) => value.lineCount > 0);
}

async function executeCommand(page, title) {
  await page.press('p', 'KeyP', 80, 12);
  await delay(250);
  await page.call('Input.insertText', { text: title });
  const candidates = await waitForValue(
    page,
    `[...document.querySelectorAll('.quick-input-list .monaco-list-row')].map((element) => element.innerText)`,
    (value) => value.some((candidate) => candidate.includes(title)),
    `命令面板没有 ${title}`,
  );
  assert(candidates.length > 0, `命令候选为空: ${title}`);
  await page.press('Enter', 'Enter', 13);
}

async function verifyNormalEditorLayout(page) {
  for (let index = 0; index < 8; index += 1) {
    await page.press('ArrowRight', 'ArrowRight', 39, 8);
  }
  await waitForValue(
    page,
    `document.querySelectorAll('.editor-instance .selected-text').length`,
    (count) => count > 0,
    '原生编辑器选择层未渲染',
  );
  await waitForStableValue(
    page,
    `[...document.querySelectorAll('.editor-instance .selected-text')].map((element) => element.getBoundingClientRect().width)`,
    '原生编辑器选择层未稳定',
  );
  const baseline = await captureEditorLayout(page);
  await executeCommand(page, 'toolbox-Show Git Blame Annotations');
  const status = await waitForValue(
    page,
    `document.querySelector('.part.statusbar')?.innerText ?? ''`,
    (value) =>
      value.includes('2026') && value.includes('wta') && value.includes('990d7b9c7a94'),
    'Git Blame 状态栏未显示',
  );
  const shown = await captureEditorLayout(page);
  await executeCommand(page, 'toolbox-Hide Git Blame Annotations');
  await waitForValue(
    page,
    `document.body.innerText`,
    (value) => !value.includes('990d7b9c7a94'),
    'Git Blame 状态栏未隐藏',
  );
  const hidden = await captureEditorLayout(page);
  assertSameLayout(baseline, shown, '显示 Blame 后');
  assertSameLayout(baseline, hidden, '隐藏 Blame 后');
  return {
    lineCount: baseline.lines.length,
    lineLeft: baseline.lines[0]?.left,
    selection: baseline.selection,
    ruler: baseline.ruler,
    scroll: baseline.scroll,
    statusBarContainsDateAuthorSha:
      status.includes('2026') &&
      status.includes('wta') &&
      status.includes('990d7b9c7a94'),
    unchangedAfterShow: true,
    unchangedAfterHide: true,
  };
}

async function captureEditorLayout(page) {
  return page.evaluate(`(() => {
    const editor = document.querySelector('.editor-instance .monaco-editor.focused') ?? document.querySelector('.editor-instance .monaco-editor');
    const rect = (element) => element?.getBoundingClientRect().toJSON();
    const scroll = editor?.querySelector('.monaco-scrollable-element');
    const dimensions = (element) => {
      const value = rect(element);
      return { left: value.left, width: value.width, height: value.height };
    };
    return {
      lines: [...editor.querySelectorAll('.view-lines .view-line')].map(dimensions),
      selection: [...editor.querySelectorAll('.selected-text')].map(dimensions),
      ruler: [...editor.querySelectorAll('.view-ruler')].map(dimensions),
      scroll: { left: scroll.scrollLeft, width: scroll.clientWidth, scrollWidth: scroll.scrollWidth }
    };
  })()`);
}

function assertSameLayout(expected, actual, label) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label}编辑器几何发生变化: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`,
  );
}

async function verifyReaderWorkflow(page) {
  const reader = await connectReader(page.port);
  try {
    const model = await reader.client.evaluateInContext(
      reader.context.id,
      `JSON.parse(document.getElementById('git-blame-reader-model').textContent)`,
    );
    const copyFormats = await verifyCopyFormats(reader, model);
    const selections = await verifyNativeSelections(reader, model);
    const search = await verifySearchShortcut(reader);
    const commitDetail = await verifyCommitDetail(page, reader, model);
    const navigation = await verifyReaderNavigation(page, reader);
    const lifecycle = await verifyReaderLifecycle(page);
    const unavailable = await verifyUnavailableState(page);
    const largeFile = await verifyLargeFile(page);
    const refreshFailure = await verifyRefreshFailure(page);
    return {
      copyFormats,
      selections,
      search,
      commitDetail,
      navigation,
      lifecycle,
      unavailable,
      largeFile,
      refreshFailure,
    };
  } finally {
    reader.client.close();
  }
}

async function connectReader(port) {
  const client = await connectToTarget(port, 'iframe');
  await client.call('Runtime.enable');
  await delay(100);
  return { client, context: await client.findReaderContext() };
}

async function verifyCopyFormats(reader, model) {
  const line = model.lines[model.sourceLine - 1];
  const block = model.blocks.find(
    (candidate) =>
      model.sourceLine >= candidate.startLine && model.sourceLine <= candidate.endLine,
  );
  assert(line !== undefined && block !== undefined, '当前行复制目标不存在');
  const formats = [
    ['Copy Code', line.text],
    ['Copy Line With Blame', formatBlameLine(line)],
    ['Copy All Code', joinCode(model.lines, model)],
    ['Copy Commit SHA', block.commit],
    ['Copy Commit Info', formatCommitInfo(block)],
    ['Copy Block Code', joinCode(block.lines, model)],
    ['Copy All With Blame', joinBlame(model.lines, model)],
    ['Copy Block With Blame', joinBlame(block.lines, model)],
  ];
  const results = {};
  for (const [label, expected] of formats) {
    await clickReaderCopy(reader, label);
    const clipboard = await waitForClipboard(expected);
    results[label] = clipboardSummary(clipboard, expected);
  }
  const source = await readFile(path.join(workspace, sourcePath));
  const allCode = await runCapture('pbpaste', []);
  await clickReaderCopy(reader, 'Copy All Code');
  const copiedSource = await waitForClipboard(source);
  results.sourceFileByteExact = copiedSource.equals(source);
  results.sourceFileBytes = source.byteLength;
  results.sourceFileSha256 = sha256(source);
  assert(results.sourceFileByteExact, 'Copy All Code 与源文件字节不一致');
  void allCode;
  return results;
}

async function clickReaderCopy(reader, label) {
  const encoded = JSON.stringify(label);
  const clicked = await reader.client.evaluateInContext(
    reader.context.id,
    `(() => {
      const label = ${encoded};
      const current = document.querySelector('.blame-reader-line.is-current');
      const scoped = label === 'Copy Block With Blame'
        ? [...current.closest('.blame-reader-block').querySelectorAll('button')]
        : [...document.querySelectorAll('.blame-reader-actions button')];
      const button = scoped.find((candidate) => candidate.textContent.trim() === label);
      if (button === undefined) return false;
      button.click();
      return true;
    })()`,
  );
  assert(clicked, `Reader 中没有复制操作: ${label}`);
}

async function verifyNativeSelections(reader, model) {
  const selectAll = await copySelectAll(reader);
  const crossBlock = await copyAcrossBlockBoundary(reader, model);
  return { selectAll, crossBlock };
}

async function copySelectAll(reader) {
  await reader.client.evaluateInContext(
    reader.context.id,
    `document.querySelector('.blame-reader-line.is-current').focus()`,
  );
  await reader.client.press('a', 'KeyA', 65, 4);
  await reader.client.press('c', 'KeyC', 67, 4);
  const clipboard = await runCapture('pbpaste', []);
  const text = clipboard.toString('utf8');
  assert(
    text.includes('Git Blame Reader') &&
      text.includes('Copy Block With Blame') &&
      text.includes('GitBlameVisibilityHost'),
    'Cmd+A/C 没有复制完整 Reader 标准文本',
  );
  return { bytes: clipboard.byteLength, sha256: sha256(clipboard), complete: true };
}

async function copyAcrossBlockBoundary(reader, model) {
  const boundary = model.blocks.findIndex(
    (block, index) => index < model.blocks.length - 1 && block.endLine > 1,
  );
  assert(boundary >= 0, '没有可用于跨 block 选择的边界');
  const startLine = model.blocks[boundary].endLine;
  const endLine = model.blocks[boundary + 1].startLine;
  const coordinates = await reader.client.evaluateInContext(
    reader.context.id,
    `(() => {
      const start = document.querySelector('[data-reader-line="${String(startLine)}"]');
      const end = document.querySelector('[data-reader-line="${String(endLine)}"]');
      start.scrollIntoView({ block: 'center' });
      const first = start.querySelector('code').firstChild;
      const second = end.querySelector('code').firstChild;
      const selection = window.getSelection();
      selection.removeAllRanges();
      const firstCharacter = document.createRange();
      firstCharacter.setStart(first, 0);
      firstCharacter.setEnd(first, Math.min(1, first.textContent.length));
      const lastCharacter = document.createRange();
      lastCharacter.setStart(second, Math.max(0, second.textContent.length - 1));
      lastCharacter.setEnd(second, second.textContent.length);
      const firstRect = firstCharacter.getBoundingClientRect();
      const lastRect = lastCharacter.getBoundingClientRect();
      return {
        start: [firstRect.left + 1, firstRect.top + firstRect.height / 2],
        end: [lastRect.right - 1, lastRect.top + lastRect.height / 2]
      };
    })()`,
  );
  await reader.client.call('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: coordinates.start[0],
    y: coordinates.start[1],
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  for (let step = 1; step <= 16; step += 1) {
    const progress = step / 16;
    await reader.client.call('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: coordinates.start[0] + (coordinates.end[0] - coordinates.start[0]) * progress,
      y: coordinates.start[1] + (coordinates.end[1] - coordinates.start[1]) * progress,
      button: 'left',
      buttons: 1,
    });
  }
  await reader.client.call('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: coordinates.end[0],
    y: coordinates.end[1],
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
  const selected = await reader.client.evaluateInContext(
    reader.context.id,
    `window.getSelection().toString()`,
  );
  assert(selected.length > 0, '跨 block 鼠标拖选 Selection 为空');
  await reader.client.press('c', 'KeyC', 67, 4);
  const clipboard = await waitForClipboard(selected);
  assert(
    selected.includes(model.lines[startLine - 1].text) &&
      selected.includes(model.lines[endLine - 1].text),
    '跨 block 选择没有同时包含边界两侧源码',
  );
  return {
    startLine,
    endLine,
    bytes: clipboard.byteLength,
    sha256: sha256(clipboard),
    includesMetadata: /\d{4}-\d{2}-\d{2}T/u.test(selected),
    includesBothSourceLines: true,
    selectionMethod: 'trusted-mouse-drag-and-trusted-cmd-c',
  };
}

async function verifySearchShortcut(reader) {
  await reader.client.press('f', 'KeyF', 70, 4);
  const focused = await reader.client.evaluateInContext(
    reader.context.id,
    `document.activeElement?.getAttribute('aria-label')`,
  );
  assert(focused === 'Search source', 'Cmd+F 未聚焦 Reader 搜索框');
  await reader.client.call('Input.insertText', { text: 'GitBlameVisibilityHost' });
  const status = await waitForReaderValue(
    reader,
    `document.querySelector('.blame-reader-actions span').textContent`,
    (value) => value.includes('match'),
    'Reader 搜索未返回匹配',
  );
  return { shortcutFocused: true, query: 'GitBlameVisibilityHost', status };
}

async function verifyCommitDetail(page, reader, model) {
  const block = model.blocks.find(
    (candidate) =>
      model.sourceLine >= candidate.startLine &&
      model.sourceLine <= candidate.endLine &&
      candidate.kind === 'committed',
  );
  assert(block !== undefined, '当前行没有 committed detail');
  await openCommitDetail(reader);
  const detail = await waitForValue(
    page,
    `document.body.innerText`,
    (value) =>
      value.includes(block.commit) &&
      value.includes(`<${block.email}>`) &&
      value.includes(new Date(block.authoredAt * 1_000).toISOString()) &&
      [
        'Copy Commit SHA',
        'Copy Commit Info',
        'Open Commit',
        'Open Previous Revision',
      ].every((label) => value.includes(label)),
    'Commit Detail 没有完整元数据或四个动作',
  );
  await runWithInput('pbcopy', [], Buffer.from('commit-sha-sentinel'));
  await clickWorkbenchAction(page, 'Copy Commit SHA');
  const sha = await waitForClipboard(block.commit);
  await openCommitDetail(reader);
  await runWithInput('pbcopy', [], Buffer.from('commit-info-sentinel'));
  await clickWorkbenchAction(page, 'Copy Commit Info');
  const infoText = formatCommitInfo(block);
  const info = await waitForClipboard(infoText);
  return {
    fullShaVisible: detail.includes(block.commit),
    authorAndSummaryVisible:
      detail.includes(block.author) && detail.includes(block.summary),
    emailAndAuthoredDateVisible:
      detail.includes(`<${block.email}>`) &&
      detail.includes(new Date(block.authoredAt * 1_000).toISOString()),
    actions: [
      'Copy Commit SHA',
      'Copy Commit Info',
      'Open Commit',
      'Open Previous Revision',
    ],
    copiedSha: clipboardSummary(sha, block.commit),
    copiedInfo: clipboardSummary(info, infoText),
  };
}

async function openCommitDetail(reader) {
  const opened = await reader.client.evaluateInContext(
    reader.context.id,
    `(() => {
      const line = document.querySelector('.blame-reader-line.is-current');
      const button = line.closest('.blame-reader-block').querySelector('.blame-reader-commit');
      button.click();
      return button.textContent.trim();
    })()`,
  );
  assert(opened.length === 12, 'Commit Detail SHA 按钮不正确');
}

async function clickWorkbenchAction(page, label) {
  await waitForValue(
    page,
    `[...document.querySelectorAll('.notification-toast .monaco-button, .notification-list-item .monaco-button')].map((element) => element.textContent.trim())`,
    (labels) => labels.includes(label),
    `通知中没有动作 ${label}`,
  );
  const clicked = await page.evaluate(`(() => {
    const label = ${JSON.stringify(label)};
    const action = [...document.querySelectorAll('.notification-toast .monaco-button, .notification-list-item .monaco-button')]
      .find((element) => element.textContent.trim() === label);
    action?.click();
    return action !== undefined;
  })()`);
  assert(clicked, `无法执行通知动作 ${label}`);
}

async function verifyReaderNavigation(page, reader) {
  const initial = await reader.client.evaluateInContext(
    reader.context.id,
    `({ line: document.querySelector('.blame-reader-line.is-current').dataset.readerLine, visible: (() => {
      const line = document.querySelector('.blame-reader-line.is-current').getBoundingClientRect();
      const pane = document.querySelector('.blame-reader-scroll').getBoundingClientRect();
      return line.bottom > pane.top && line.top < pane.bottom;
    })() })`,
  );
  await openReaderLineWithKeyboard(reader, 40);
  const keyboard = await waitForSourceLine(page, 40);
  await activateTab(page, 'Git Blame Reader:');
  await waitForReaderVisibility(page, true);
  await openReaderLineWithClick(reader, 55);
  const click = await waitForSourceLine(page, 55);
  await activateTab(page, 'Git Blame Reader:');
  await waitForReaderVisibility(page, true);
  return { initial, keyboard, click: { ...click, method: 'dom-click' } };
}

async function openReaderLineWithKeyboard(reader, line) {
  const focused = await reader.client.evaluateInContext(
    reader.context.id,
    `(() => {
      const element = document.querySelector('[data-reader-line="${String(line)}"]');
      element.scrollIntoView({ block: 'center' });
      element.focus();
      return document.activeElement === element;
    })()`,
  );
  assert(focused, `Reader 第 ${String(line)} 行无法获得焦点`);
  await reader.client.press('Enter', 'Enter', 13);
}

async function openReaderLineWithClick(reader, line) {
  const clicked = await reader.client.evaluateInContext(
    reader.context.id,
    `(() => {
      const element = document.querySelector('[data-reader-line="${String(line)}"]');
      element.scrollIntoView({ block: 'center' });
      element.click();
      return true;
    })()`,
  );
  assert(clicked, `Reader 第 ${String(line)} 行 click 未触发`);
}

async function waitForSourceLine(page, line) {
  const text = await waitForValue(
    page,
    `document.body.innerText`,
    (value) =>
      value.includes(`Ln ${String(line)}, Col 1`) &&
      value.includes('create-extension-runtime.ts'),
    `源编辑器没有定位到第 ${String(line)} 行`,
  );
  return {
    line,
    column: 1,
    activeSourceTab: text.includes('create-extension-runtime.ts'),
  };
}

async function activateTab(page, labelPrefix) {
  const position = await page.evaluate(`(() => {
    const prefix = ${JSON.stringify(labelPrefix)};
    const tab = [...document.querySelectorAll('.tab')].find((candidate) =>
      candidate.innerText.includes(prefix),
    );
    if (tab === undefined) return undefined;
    const rect = tab.getBoundingClientRect();
    return [rect.left + rect.width / 2, rect.top + rect.height / 2];
  })()`);
  assert(position !== undefined, `找不到标签页: ${labelPrefix}`);
  await page.call('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: position[0],
    y: position[1],
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  await page.call('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: position[0],
    y: position[1],
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
}

async function waitForReaderVisibility(page, visible) {
  await waitForValue(
    page,
    `getComputedStyle(document.querySelector('iframe.webview')).visibility`,
    (value) => value === (visible ? 'visible' : 'hidden'),
    `Reader 可见状态不是 ${String(visible)}`,
  );
}

async function verifyReaderLifecycle(page) {
  await activateTab(page, 'create-extension-runtime.ts');
  await goToLine(page, 1);
  await page.press('Home', 'Home', 36);
  await page.call('Input.insertText', { text: '// 未保存 Reader 快照\n' });
  const dirtyBeforeRefresh = await page.evaluate(
    `document.querySelector('.tab.active')?.classList.contains('dirty')`,
  );
  const reader = await connectReader(page.port);
  try {
    const stale = await waitForReaderValue(
      reader,
      `document.querySelector('.blame-reader-status').textContent`,
      (value) => value.includes('Source changed'),
      '未保存修改后 Reader 未进入 stale',
    );
    await activateTab(page, 'Git Blame Reader:');
    await waitForReaderVisibility(page, true);
    await reader.client.evaluateInContext(
      reader.context.id,
      `[...document.querySelectorAll('button')].find((element) => element.textContent.trim() === 'Refresh').click()`,
    );
    const refreshed = await waitForReaderSnapshot(reader, 329, '// 未保存 Reader 快照');
    await activateTab(page, 'create-extension-runtime.ts');
    await goToLine(page, 1);
    await page.press('Home', 'Home', 36);
    await page.call('Input.insertText', { text: '// 保存后 Reader 快照\n' });
    await waitForReaderValue(
      reader,
      `document.querySelector('.blame-reader-status').textContent`,
      (value) => value.includes('Source changed'),
      '第二次修改后 Reader 未进入 stale',
    );
    await page.press('s', 'KeyS', 83, 4);
    const saved = await waitForReaderSnapshot(reader, 330, '// 保存后 Reader 快照');
    const dirtyAfterSave = await page.evaluate(
      `document.querySelector('.tab.active')?.classList.contains('dirty')`,
    );
    await activateTab(page, 'Git Blame Reader:');
    await waitForReaderVisibility(page, true);
    return {
      dirtyBeforeRefresh,
      staleMessage: stale,
      explicitRefresh: refreshed,
      saveReload: saved,
      dirtyAfterSave,
    };
  } finally {
    reader.client.close();
  }
}

async function goToLine(page, line) {
  await page.press('g', 'KeyG', 71, 2);
  await page.call('Input.insertText', { text: String(line) });
  await page.press('Enter', 'Enter', 13);
  await delay(250);
}

async function waitForReaderSnapshot(reader, lineCount, firstLine) {
  return waitForReaderValue(
    reader,
    `(() => ({
      lineCount: document.querySelectorAll('[data-reader-line]').length,
      firstLine: document.querySelector('[data-reader-line="1"] code')?.textContent,
      firstMeta: document.querySelector('[data-reader-line="1"] .blame-reader-meta')?.textContent
    }))()`,
    (value) =>
      value.lineCount === lineCount &&
      value.firstLine === firstLine &&
      value.firstMeta.includes('Working Tree') &&
      value.firstMeta.includes('Uncommitted'),
    `Reader 快照没有更新到 ${String(lineCount)} 行`,
  );
}

async function verifyUnavailableState(page) {
  await page.press('w', 'KeyW', 87, 4);
  await waitForValue(
    page,
    `[...document.querySelectorAll('.tab')].filter((candidate) => candidate.innerText.includes('Git Blame Reader:')).length`,
    (count) => count === 0,
    '无法关闭 Reader 标签页',
  );
  await page.press('p', 'KeyP', 80, 4);
  await delay(250);
  await replaceInput(page, unavailablePath);
  await waitForValue(
    page,
    `[...document.querySelectorAll('.quick-input-list .monaco-list-row')].map((element) => element.innerText)`,
    (value) => value.some((candidate) => candidate.includes(unavailablePath)),
    'Quick Open 没有 untracked fixture',
  );
  await page.press('Enter', 'Enter', 13);
  await delay(500);
  await executeCommand(page, 'toolbox-Open Full-file Blame Reader');
  const body = await waitForValue(
    page,
    `document.body.innerText`,
    (value) => value.includes('Git Blame Reader is unavailable for this file.'),
    '未跟踪文件没有稳定 unavailable 提示',
  );
  const readerTabs = await page.evaluate(
    `[...document.querySelectorAll('.tab')].filter((candidate) => candidate.innerText.includes('Git Blame Reader:')).length`,
  );
  assert(readerTabs === 0, 'unavailable 路径创建了误导 Reader Panel');
  return {
    fixture: unavailablePath,
    stableMessage: body.includes('Git Blame Reader is unavailable for this file.'),
    readerPanelCount: readerTabs,
  };
}

async function verifyLargeFile(page) {
  await page.press('p', 'KeyP', 80, 4);
  await delay(250);
  await replaceInput(page, largePath);
  await waitForValue(
    page,
    `[...document.querySelectorAll('.quick-input-list .monaco-list-row')].map((element) => element.innerText)`,
    (value) => value.some((candidate) => candidate.includes(largePath)),
    'Quick Open 没有大文件 fixture',
  );
  await page.press('Enter', 'Enter', 13);
  await delay(500);
  await goToLine(page, 5_001);
  await executeCommand(page, 'toolbox-Open Full-file Blame Reader');
  await waitForReader(page.port, (value) => value.lineCount > 0);
  const reader = await connectReader(page.port);
  try {
    const model = await reader.client.evaluateInContext(
      reader.context.id,
      `JSON.parse(document.getElementById('git-blame-reader-model').textContent)`,
    );
    assert(model.lineCount === 5_001, '大文件 Reader model 行数不是 5,001');
    const initial = await waitForReaderValue(
      reader,
      `(() => ({
        renderedLines: document.querySelectorAll('[data-reader-line]').length,
        currentLine: document.querySelector('.blame-reader-line.is-current')?.dataset.readerLine,
        generation: JSON.parse(document.getElementById('git-blame-reader-model').textContent).generation
      }))()`,
      (value) => value.currentLine === '5001' && value.renderedLines < 100,
      '大文件 Reader 未虚拟化或未定位末行',
    );
    await reader.client.evaluateInContext(
      reader.context.id,
      `document.querySelector('.blame-reader-scroll').scrollTop = 0`,
    );
    const firstVisible = await waitForReaderValue(
      reader,
      `Boolean(document.querySelector('[data-reader-line="1"]'))`,
      Boolean,
      '大文件 Reader 无法滚动到首行',
    );
    await reader.client.evaluateInContext(
      reader.context.id,
      `(() => {
        const pane = document.querySelector('.blame-reader-scroll');
        pane.scrollTop = pane.scrollHeight;
      })()`,
    );
    const lastVisible = await waitForReaderValue(
      reader,
      `Boolean(document.querySelector('[data-reader-line="5001"]'))`,
      Boolean,
      '大文件 Reader 无法滚动到末行',
    );
    await clickReaderCopy(reader, 'Copy All Code');
    const clipboard = await waitForClipboard(largeFixture);
    const final = await reader.client.evaluateInContext(
      reader.context.id,
      `({
        renderedLines: document.querySelectorAll('[data-reader-line]').length,
        generation: JSON.parse(document.getElementById('git-blame-reader-model').textContent).generation
      })`,
    );
    assert(final.renderedLines < 100, '大文件滚动后 DOM 行数失控');
    assert(
      final.generation === initial.generation,
      '大文件滚动或复制触发了新 generation',
    );
    return {
      modelLines: model.lineCount,
      initialRenderedLines: initial.renderedLines,
      finalRenderedLines: final.renderedLines,
      firstVisible,
      lastVisible,
      generationStable: true,
      copyAll: clipboardSummary(clipboard, largeFixture),
    };
  } finally {
    reader.client.close();
  }
}

async function verifyRefreshFailure(page) {
  const gitDirectory = path.join(workspace, '.git');
  const hiddenGitDirectory = path.join(workspace, '.git-reader-matrix-hidden');
  await rename(gitDirectory, hiddenGitDirectory);
  try {
    const reader = await connectReader(page.port);
    try {
      await reader.client.evaluateInContext(
        reader.context.id,
        `[...document.querySelectorAll('button')].find((element) => element.textContent.trim() === 'Refresh').click()`,
      );
      const message = await waitForReaderValue(
        reader,
        `document.querySelector('.blame-reader-status').textContent`,
        (value) =>
          value.includes('could not be loaded') || value.includes('unavailable'),
        'Refresh 失败没有在当前 Reader 显示稳定状态',
      );
      return { visible: true, message };
    } finally {
      reader.client.close();
    }
  } finally {
    await rename(hiddenGitDirectory, gitDirectory);
  }
}

async function waitForReaderValue(reader, expression, predicate, message) {
  const deadline = Date.now() + 10_000;
  let value;
  while (Date.now() < deadline) {
    value = await reader.client.evaluateInContext(reader.context.id, expression);
    if (predicate(value)) return value;
    await delay(150);
  }
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}

function formatBlameLine(line) {
  const sha =
    line.kind === 'uncommitted' ? 'Uncommitted' : line.blame.commit.slice(0, 12);
  const date =
    line.kind === 'uncommitted'
      ? 'Working Tree'
      : new Date(line.blame.authoredAt * 1_000).toISOString();
  return `${String(line.line)}\t${date}\t${line.blame.author}\t${sha}\t${line.text}`;
}

function formatCommitInfo(block) {
  const sha = block.kind === 'uncommitted' ? 'Uncommitted' : block.commit;
  return `${sha}\n${block.author} <${block.email}>\n${new Date(block.authoredAt * 1_000).toISOString()}\n${block.summary}`;
}

function joinCode(lines, model) {
  return joinReaderLines(
    lines.map((line) => line.text),
    lines,
    model,
  );
}

function joinBlame(lines, model) {
  return joinReaderLines(lines.map(formatBlameLine), lines, model);
}

function joinReaderLines(values, lines, model) {
  return (
    values.join(model.lineEnding) +
    (model.hasFinalNewline && lines.at(-1)?.line === model.lineCount
      ? model.lineEnding
      : '')
  );
}

async function waitForClipboard(expected) {
  const expectedBuffer = Buffer.isBuffer(expected) ? expected : Buffer.from(expected);
  const deadline = Date.now() + 5_000;
  let actual = Buffer.alloc(0);
  while (Date.now() < deadline) {
    actual = await runCapture('pbpaste', []);
    if (actual.equals(expectedBuffer)) return actual;
    await delay(100);
  }
  throw new Error(
    `剪贴板不匹配: expected=${sha256(expectedBuffer)} actual=${sha256(actual)}`,
  );
}

function clipboardSummary(actual, expected) {
  const expectedBuffer = Buffer.isBuffer(expected) ? expected : Buffer.from(expected);
  return {
    bytes: actual.byteLength,
    sha256: sha256(actual),
    exact: actual.equals(expectedBuffer),
  };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function waitForWorkbench(page) {
  await waitForValue(
    page,
    `Boolean(document.querySelector('.monaco-workbench'))`,
    Boolean,
    'VS Code 工作台未就绪',
  );
  await delay(1_500);
}

async function waitForValue(page, expression, predicate, message) {
  const deadline = Date.now() + 10_000;
  let value;
  while (Date.now() < deadline) {
    value = await page.evaluate(expression);
    if (predicate(value)) return value;
    await delay(200);
  }
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}

async function waitForStableValue(page, expression, message) {
  const deadline = Date.now() + 5_000;
  let previous;
  let stableCount = 0;
  while (Date.now() < deadline) {
    const value = await page.evaluate(expression);
    if (JSON.stringify(value) === JSON.stringify(previous)) stableCount += 1;
    else stableCount = 0;
    if (stableCount >= 2) return value;
    previous = value;
    await delay(200);
  }
  throw new Error(`${message}: ${JSON.stringify(previous)}`);
}

async function selectTheme(page, theme) {
  await page.press('Escape', 'Escape', 27);
  await page.press('k', 'KeyK', 75, 4);
  await delay(120);
  await page.press('t', 'KeyT', 84, 4);
  await delay(700);
  await replaceInput(page, theme);
  await delay(500);
  const rows = await page.evaluate(
    `[...document.querySelectorAll('.quick-input-list .monaco-list-row')].map((element) => element.innerText)`,
  );
  assert(
    rows[0]?.startsWith(theme) === true,
    `主题过滤结果不是 ${theme}: ${JSON.stringify(rows)}`,
  );
  await page.press('Enter', 'Enter', 13);
  const selectedTheme = themes.find((candidate) => candidate.label === theme);
  assert(selectedTheme !== undefined, `没有主题定义: ${theme}`);
  await waitForReader(page.port, (value) => value.themeId === selectedTheme.themeId);
}

async function replaceInput(page, text) {
  await waitForValue(
    page,
    `Boolean(document.querySelector('.quick-input-widget input'))`,
    Boolean,
    'Quick Input 输入框未显示',
  );
  await page.evaluate(`document.querySelector('.quick-input-widget input').focus()`);
  await page.press('a', 'KeyA', 65, 4);
  await page.call('Input.insertText', { text });
}

async function measureCombination(page, zoom, theme) {
  const workbench = await page.evaluate(
    `({
      dpr: devicePixelRatio,
      viewport: [innerWidth, innerHeight],
      activeTabs: [...document.querySelectorAll('.tab.active')].map((element) => element.dataset.resourceName),
      frame: (() => {
        const element = document.querySelector('iframe.webview');
        return { rect: element.getBoundingClientRect().toJSON(), visibility: getComputedStyle(element).visibility };
      })()
    })`,
  );
  assert(
    Math.abs(workbench.dpr - zoom.dpr) < 0.02,
    `缩放 ${zoom.label}% 的 DPR 为 ${String(workbench.dpr)}`,
  );
  assert(workbench.frame.visibility === 'visible', 'Reader Webview 不可见');

  const reader = await connectToTarget(page.port, 'iframe');
  await reader.call('Runtime.enable');
  await reader.call('Accessibility.enable');
  await delay(200);
  const context = await reader.findReaderContext();
  const readerMetrics = await reader.evaluateInContext(
    context.id,
    `(() => {
      const rectangle = (element) => element.getBoundingClientRect().toJSON();
      const controls = [...document.querySelectorAll('.blame-reader-toolbar button, .blame-reader-toolbar input, .blame-reader-actions button, .blame-reader-actions > span')].filter((element) => rectangle(element).width > 0);
      const overlaps = [];
      for (let first = 0; first < controls.length; first += 1) {
        for (let second = first + 1; second < controls.length; second += 1) {
          const left = controls[first].getBoundingClientRect();
          const right = controls[second].getBoundingClientRect();
          if (left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top) {
            overlaps.push([controls[first].innerText || controls[first].ariaLabel, controls[second].innerText || controls[second].ariaLabel]);
          }
        }
      }
      const required = [...document.querySelectorAll('h1, .blame-reader-status, .blame-reader-search, .blame-reader-search input, .blame-reader-actions button, .blame-reader-commit, .blame-reader-meta, .blame-reader-block-header span')];
      const clipped = required.filter((element) => {
        const style = getComputedStyle(element);
        return (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) && (style.overflowX === 'hidden' || style.overflowY === 'hidden');
      }).map((element) => element.innerText || element.value || element.ariaLabel);
      const lines = [...document.querySelectorAll('[data-reader-line]')];
      const longest = lines.reduce((current, line) => line.querySelector('code').textContent.length > current.querySelector('code').textContent.length ? line : current, lines[0]);
      const current = document.querySelector('.blame-reader-line.is-current');
      current.focus();
      const pane = document.querySelector('.blame-reader-scroll');
      const code = longest.querySelector('code');
      const button = document.querySelector('.blame-reader-actions button');
      const focusStyle = getComputedStyle(current);
      return {
        bodyClass: document.body.className,
        themeId: document.body.dataset.vscodeThemeId,
        viewport: [document.documentElement.clientWidth, document.documentElement.clientHeight],
        lineCount: lines.length,
        currentLine: current.dataset.readerLine,
        currentVisible: rectangle(current).bottom > rectangle(pane).top && rectangle(current).top < rectangle(pane).bottom,
        longestLine: {
          line: longest.dataset.readerLine,
          lineNumberCount: longest.querySelectorAll('.blame-reader-line-number').length,
          codeTextLength: code.textContent.length,
          lineHeight: rectangle(longest).height,
          codeStyle: {
            whiteSpace: getComputedStyle(code).whiteSpace,
            overflowWrap: getComputedStyle(code).overflowWrap,
            userSelect: getComputedStyle(code).userSelect,
            background: getComputedStyle(code).backgroundColor
          }
        },
        colors: {
          root: { foreground: getComputedStyle(document.documentElement).color, background: getComputedStyle(document.documentElement).backgroundColor },
          button: { foreground: getComputedStyle(button).color, background: getComputedStyle(button).backgroundColor }
        },
        focus: { outlineColor: focusStyle.outlineColor, outlineStyle: focusStyle.outlineStyle, outlineWidth: focusStyle.outlineWidth },
        screenReaderClass: document.body.classList.contains('vscode-using-screen-reader'),
        overflow: {
          root: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
          body: [document.body.scrollWidth, document.body.clientWidth],
          pane: [pane.scrollWidth, pane.clientWidth]
        },
        overlaps,
        clipped
      };
    })()`,
  );
  const accessibility = await reader.accessibilitySummary(context.frameId);
  reader.close();

  assert(readerMetrics.themeId === theme.themeId, 'Reader 主题 ID 不匹配');
  assert(
    readerMetrics.bodyClass.includes(theme.className),
    `Reader 主题 class 不包含 ${theme.className}`,
  );
  assert(readerMetrics.screenReaderClass, 'Reader 未进入 screen-reader 优化状态');
  assert(readerMetrics.lineCount > 0, 'Reader 没有 logical line');
  assert(readerMetrics.currentLine === '25', 'Reader 初始行不是 25');
  assert(readerMetrics.currentVisible, 'Reader 当前行不在可视区');
  assert(readerMetrics.longestLine.lineNumberCount === 1, '长行产生了重复行号');
  assert(
    readerMetrics.longestLine.codeStyle.whiteSpace === 'pre-wrap',
    '源码未使用 soft wrap',
  );
  assert(readerMetrics.longestLine.codeStyle.userSelect === 'text', '源码不可选择');
  assert(
    readerMetrics.longestLine.codeStyle.background === 'rgba(0, 0, 0, 0)',
    '源码继承了 inline-code 背景',
  );
  assert(
    readerMetrics.overlaps.length === 0,
    `控件重叠: ${JSON.stringify(readerMetrics.overlaps)}`,
  );
  assert(
    readerMetrics.clipped.length === 0,
    `必需文本截断: ${JSON.stringify(readerMetrics.clipped)}`,
  );
  assert(
    readerMetrics.overflow.root[0] <= readerMetrics.overflow.root[1] + 1,
    'Reader 根节点横向溢出',
  );
  assert(
    readerMetrics.overflow.body[0] <= readerMetrics.overflow.body[1] + 1,
    'Reader body 横向溢出',
  );
  assert(
    readerMetrics.overflow.pane[0] <= readerMetrics.overflow.pane[1] + 1,
    'Reader 滚动区横向溢出',
  );
  assert(readerMetrics.focus.outlineStyle !== 'none', '当前行没有焦点轮廓');
  for (const role of [
    'main',
    'heading',
    'textbox',
    'toolbar',
    'list',
    'listitem',
    'button',
  ]) {
    assert(accessibility.roles[role] > 0, `Accessibility Tree 缺少 ${role}`);
  }

  const screenshotName = `ui-${theme.key}-${zoom.label}.png`;
  const screenshot = await page.call('Page.captureScreenshot', {
    format: 'png',
    fromSurface: false,
    captureBeyondViewport: false,
  });
  const screenshotBytes = Buffer.from(screenshot.result.data, 'base64');
  assert(screenshotBytes.byteLength > 20_000, '截图像素数据过小');
  await writeFile(path.join(changeDirectory, screenshotName), screenshotBytes);
  return {
    theme: theme.label,
    themeKey: theme.key,
    zoom: zoom.label,
    screenshot: screenshotName,
    screenshotBytes: screenshotBytes.byteLength,
    workbench,
    reader: readerMetrics,
    accessibility,
  };
}

async function waitForReader(port, predicate) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const reader = await connectToTarget(port, 'iframe');
      await reader.call('Runtime.enable');
      await delay(100);
      const context = await reader.findReaderContext();
      const value = await reader.evaluateInContext(
        context.id,
        `({ themeId: document.body.dataset.vscodeThemeId, lineCount: document.querySelectorAll('[data-reader-line]').length })`,
      );
      reader.close();
      if (predicate(value)) return;
    } catch (error) {
      void error;
    }
    await delay(250);
  }
  throw new Error('等待 Reader 状态超时');
}

async function connectToTarget(port, type) {
  const targets = await fetch(`http://127.0.0.1:${String(port)}/json/list`).then(
    (response) => response.json(),
  );
  const target = targets.find((candidate) => candidate.type === type);
  if (target === undefined) throw new Error(`未找到 ${type} target`);
  const websocket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    websocket.onopen = resolve;
    websocket.onerror = reject;
  });
  let callId = 0;
  const pending = new Map();
  const contexts = [];
  websocket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.executionContextCreated') {
      contexts.push(message.params.context);
    }
    if (message.id !== undefined && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++callId;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP 调用超时: ${method}`));
      }, 10_000);
      pending.set(id, (message) => {
        clearTimeout(timeout);
        if (message.error !== undefined) {
          reject(new Error(`${method}: ${message.error.message}`));
          return;
        }
        resolve(message);
      });
      websocket.send(JSON.stringify({ id, method, params }));
    });
  return {
    port,
    call,
    close: () => websocket.close(),
    press: async (key, code, virtualKey, modifiers = 0) => {
      for (const eventType of ['keyDown', 'keyUp']) {
        await call('Input.dispatchKeyEvent', {
          type: eventType,
          key,
          code,
          windowsVirtualKeyCode: virtualKey,
          nativeVirtualKeyCode: virtualKey,
          modifiers,
        });
      }
    },
    evaluate: async (expression) => {
      const response = await call('Runtime.evaluate', {
        expression,
        returnByValue: true,
      });
      if (response.result.exceptionDetails !== undefined) {
        throw new Error(response.result.exceptionDetails.text);
      }
      return response.result.result.value;
    },
    evaluateInContext: async (contextId, expression) => {
      const response = await call('Runtime.evaluate', {
        contextId,
        expression,
        returnByValue: true,
      });
      if (response.result.exceptionDetails !== undefined) {
        throw new Error(response.result.exceptionDetails.text);
      }
      return response.result.result.value;
    },
    findReaderContext: async () => {
      for (const context of contexts) {
        const response = await call('Runtime.evaluate', {
          contextId: context.id,
          expression: `Boolean(document.querySelector('[data-reader-line]'))`,
          returnByValue: true,
        });
        if (response.result.result.value === true) {
          return { id: context.id, frameId: context.auxData.frameId };
        }
      }
      throw new Error('未找到 Reader execution context');
    },
    accessibilitySummary: async (frameId) => {
      const response = await call('Accessibility.getFullAXTree', { frameId });
      const roles = {};
      const names = [];
      for (const node of response.result.nodes) {
        const role = node.role?.value;
        if (typeof role === 'string') roles[role] = (roles[role] ?? 0) + 1;
        if (
          ['heading', 'textbox', 'toolbar', 'list', 'button'].includes(role) &&
          typeof node.name?.value === 'string'
        ) {
          names.push({ role, name: node.name.value });
        }
      }
      return { nodeCount: response.result.nodes.length, roles, names };
    },
  };
}

async function waitForTargets(port, predicate) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const targets = await fetch(`http://127.0.0.1:${String(port)}/json/list`).then(
        (response) => response.json(),
      );
      if (predicate(targets)) return targets;
    } catch (error) {
      void error;
    }
    await delay(250);
  }
  throw new Error(`等待调试端口 ${String(port)} 超时`);
}

async function stopProcess(process) {
  if (process.exitCode !== null) return;
  process.kill('SIGINT');
  await Promise.race([
    new Promise((resolve) => process.once('exit', resolve)),
    delay(5_000),
  ]);
  if (process.exitCode === null) process.kill('SIGKILL');
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repository, stdio: 'inherit' });
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} 退出码 ${String(code)}`));
    });
    child.once('error', reject);
  });
}

function runInWorkspace(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: workspace, stdio: 'inherit' });
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} 退出码 ${String(code)}`));
    });
    child.once('error', reject);
  });
}

function runCapture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repository,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('exit', (code) => {
      if (code === 0) resolve(Buffer.concat(stdout));
      else
        reject(
          new Error(
            `${command} 退出码 ${String(code)}: ${Buffer.concat(stderr).toString('utf8')}`,
          ),
        );
    });
    child.once('error', reject);
  });
}

function runWithInput(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repository,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    const stderr = [];
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${command} 退出码 ${String(code)}: ${Buffer.concat(stderr).toString('utf8')}`,
          ),
        );
    });
    child.once('error', reject);
    child.stdin.end(input);
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
