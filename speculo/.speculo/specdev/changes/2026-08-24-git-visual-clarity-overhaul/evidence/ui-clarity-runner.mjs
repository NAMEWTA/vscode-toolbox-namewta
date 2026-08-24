import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const evidenceDirectory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(evidenceDirectory, '../../../../../..');
const codeExecutable = path.join(
  repository,
  '.vscode-test/vscode-darwin-arm64-1.134.0/Visual Studio Code.app/Contents/MacOS/Code',
);
const temporaryRoot = await mkdtemp('/tmp/git-visual-clarity-');
const workspace = path.join(temporaryRoot, 'workspace');
const extensionTestsPath = path.join(temporaryRoot, 'hold-open-tests.cjs');
const commandRequestDirectory = path.join(temporaryRoot, 'command-requests');
const commandResponseDirectory = path.join(temporaryRoot, 'command-responses');
let nextCommandId = 1;
const sourcePath = 'visual-fixture.ts';
const zooms = [
  { label: '100', level: 0, dpr: 1, port: 9460 },
  { label: '125', level: 1.2239010857, dpr: 1.25, port: 9461 },
  { label: '150', level: 2.2239010857, dpr: 1.5, port: 9462 },
];
const themes = [
  { key: 'light', label: 'Light Modern', id: 'Light Modern' },
  { key: 'dark', label: 'Dark Modern', id: 'Dark Modern' },
  { key: 'high-contrast', label: 'Dark High Contrast', id: 'Default High Contrast' },
];

await mkdir(commandRequestDirectory);
await mkdir(commandResponseDirectory);
await writeFile(extensionTestsPath, createExtensionTestBridge(), 'utf8');
await run('git', ['clone', '--quiet', '--no-hardlinks', repository, workspace]);
await runGit(['config', 'user.name', 'Matrix Author']);
await runGit(['config', 'user.email', 'matrix@example.invalid']);
await writeFile(
  path.join(workspace, sourcePath),
  [
    'export const alpha = 1;',
    'export const beta = 1;',
    'export const gamma = 1;',
    'export const delta = 1;',
    'export const epsilon = 1;',
    'export const zeta = 1;',
    'export const eta = 1;',
    'export const theta = 1;',
    '',
  ].join('\n'),
);
await writeFile(path.join(workspace, 'compare-old-name.md'), 'base comparison\n');
await runGit(['add', sourcePath, 'compare-old-name.md']);
await commit('建立可视化基准');
const baseCommit = await revParseHead();

await replaceSourceLine(3, 'export const gamma = 2;');
await writeFile(path.join(workspace, 'compare-extra.ts'), 'export const extra = 1;\n');
await runGit(['add', sourcePath, 'compare-extra.ts']);
await commit('修改第一块并新增文件');

await replaceSourceLine(5, 'export const epsilon = 3;');
await runGit(['mv', 'compare-old-name.md', 'compare-renamed-note.md']);
await runGit(['add', sourcePath]);
await commit('修改第二块并重命名文件');

await replaceSourceLine(7, 'export const eta = 4;');
await writeFile(
  path.join(workspace, 'compare-renamed-note.md'),
  'base comparison\nrenamed comparison\n',
);
await runGit(['add', sourcePath, 'compare-renamed-note.md']);
await commit('修改第三块');
const targetCommit = await revParseHead();

const results = [];
for (const zoom of zooms) results.push(await runZoom(zoom));
await writeFile(
  path.join(evidenceDirectory, 'ui-clarity-results.json'),
  `${JSON.stringify({ baseCommit, targetCommit, workspace, results }, null, 2)}\n`,
  'utf8',
);
process.stdout.write(`UI_CLARITY_PASS combinations=${String(results.length * 3)}\n`);

async function runZoom(zoom) {
  const profile = path.join(temporaryRoot, `profile-${zoom.label}`);
  const userData = path.join(profile, 'user-data');
  const extensions = path.join(profile, 'extensions');
  await mkdir(path.join(userData, 'User'), { recursive: true });
  await mkdir(extensions, { recursive: true });
  await writeFile(
    path.join(userData, 'User', 'settings.json'),
    `${JSON.stringify(
      {
        'workbench.colorTheme': 'Dark Modern',
        'window.zoomLevel': zoom.level,
        'editor.accessibilitySupport': 'on',
        'editor.wordWrap': 'on',
        'telemetry.telemetryLevel': 'off',
        'update.mode': 'none',
        'extensions.autoUpdate': false,
        'security.workspace.trust.enabled': false,
        'vscodeToolboxNamewta.gitBlame.dateFormatStyle': 'YYYY-MM-DD',
        'vscodeToolboxNamewta.gitBlame.authorNameStyle': 'first',
        'vscodeToolboxNamewta.gitBlame.showCommitNumber': true,
        'vscodeToolboxNamewta.gitBlame.mergeCommitLines': true,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  const process = spawn(
    codeExecutable,
    [
      '--no-sandbox',
      '--disable-gpu-sandbox',
      '--no-cached-data',
      `--extensionTestsPath=${extensionTestsPath}`,
      `--user-data-dir=${userData}`,
      `--extensions-dir=${extensions}`,
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
    await page.call('Runtime.enable');
    await page.call('Page.bringToFront');
    await waitForWorkbench(page);
    await openFile(page, sourcePath);
    const annotations = await verifyEditorAnnotations(page, zoom);
    const compare =
      zoom.label === '100' ? await verifyNativeCompare(page, zoom) : undefined;
    await openFile(page, sourcePath);
    await runHostCommand('vscodeToolboxNamewta.gitBlame.openReader');
    await waitForReader(zoom.port);
    const combinations = [];
    for (const theme of themes) {
      await selectTheme(page, theme);
      combinations.push(await verifyReaderCombination(page, zoom, theme));
    }
    page.close();
    return { zoom: zoom.label, annotations, compare, combinations };
  } finally {
    await stopProcess(process);
    await writeFile(
      path.join(evidenceDirectory, `ui-vscode-${zoom.label}.log`),
      Buffer.concat(output),
    );
  }
}

async function verifyEditorAnnotations(page, zoom) {
  await runHostCommand('vscodeToolboxNamewta.gitBlame.show');
  const metrics = await waitForPageValue(
    page,
    `(() => {
      const values = [...document.querySelectorAll('.editor-instance .view-line span')]
        .map((element) => ({
          text: getComputedStyle(element, '::before').content,
          width: getComputedStyle(element, '::before').width,
          color: getComputedStyle(element, '::before').color,
          background: getComputedStyle(element, '::before').backgroundColor
        }))
        .filter((value) => value.text !== 'none' && value.text !== 'normal' && value.text !== '""');
      const stripes = values.filter((value) => value.text.includes('▌') && value.background !== 'rgba(0, 0, 0, 0)');
      return { values, stripes, status: document.querySelector('.part.statusbar')?.innerText ?? '' };
    })()`,
    (value) =>
      value.values.some(
        (item) => item.text.includes('Matrix') && item.text.includes('2026-'),
      ),
    '编辑器固定 Blame 注解列未渲染',
  );
  const widths = new Set(metrics.values.map((value) => value.width));
  assert(widths.size === 1, `编辑器注解列宽不稳定: ${JSON.stringify([...widths])}`);
  assert(
    metrics.stripes.length > 0,
    `编辑器注解没有提交时间色条: ${JSON.stringify(metrics)}`,
  );
  await capture(page, `ui-editor-annotations-${zoom.label}.png`);
  return {
    visibleAnnotationCount: metrics.values.length,
    fixedWidth: [...widths][0],
    hasAuthorAndDate: true,
    hasHeatStripe: true,
    statusContainsAuthor: metrics.status.includes('Matrix Author'),
  };
}

async function verifyNativeCompare(page, zoom) {
  const command = runHostCommand('vscodeToolboxNamewta.gitCompare.start');
  await waitForQuickPickTitle(page, 'Select comparison base');
  await replaceInput(page, baseCommit.slice(0, 12));
  await page.press('Enter', 'Enter', 13);
  await waitForQuickPickTitle(page, 'Select comparison target');
  await replaceInput(page, targetCommit.slice(0, 12));
  await page.press('Enter', 'Enter', 13);
  await command;
  await waitForPageValue(
    page,
    `document.querySelector('.tab.active')?.innerText ?? ''`,
    (value) => value.includes('Git comparison'),
    '原生 Git Compare 没有成为活动编辑器',
  );
  const editorText = await waitForPageValue(
    page,
    `(() => {
      const editors = [...document.querySelectorAll('.editor-instance')].filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      return editors.at(-1)?.innerText ?? '';
    })()`,
    (value) =>
      value.includes(sourcePath) &&
      value.includes('compare-old-name.md') &&
      value.includes('compare-renamed-note.md'),
    '原生 Git Compare 没有显示全部实际文件名',
  );
  assert(!editorText.includes('revision /'), '原生 Git Compare 仍显示 revision /');
  const labels = editorText
    .split('\n')
    .filter((line) => /visual-fixture|compare-(?:old|renamed)/u.test(line));
  await capture(page, `ui-native-compare-${zoom.label}.png`);
  await page.press('w', 'KeyW', 87, 4);
  return { labels, excludesRevisionPlaceholder: true };
}

async function verifyReaderCombination(page, zoom, theme) {
  const reader = await connectReader(page.port);
  try {
    const metrics = await waitForReaderValue(
      reader,
      `(() => {
        const model = JSON.parse(document.getElementById('git-blame-reader-model').textContent);
        const committed = model.blocks.filter((block) => block.kind === 'committed');
        const blameRows = [...document.querySelectorAll('[data-blame-line]')];
        const codeRows = [...document.querySelectorAll('[data-code-line]')];
        const pairs = blameRows.map((blame, index) => {
          const code = codeRows[index];
          return {
            line: blame.dataset.blameLine,
            blameColor: blame.dataset.commitColor,
            codeColor: code?.dataset.commitColor,
            blameTint: getComputedStyle(blame).backgroundColor,
            codeTint: code === undefined ? '' : getComputedStyle(code).backgroundColor
          };
        });
        const commits = [...new Set(committed.map((block) => block.commit))];
        const hashCounts = commits.map((commit) => ({
          hash: commit.slice(0, 12),
          expected: committed.filter((block) => block.commit === commit).length,
          count: document.querySelector('.blame-reader-column-blame').textContent.split(commit.slice(0, 12)).length - 1
        }));
        const blockStarts = [...document.querySelectorAll('.blame-reader-blame-row.is-block-start')]
          .map((row) => ({ color: row.dataset.commitColor, accent: getComputedStyle(row).getPropertyValue('--reader-commit-accent').trim() }));
        const controls = [...document.querySelectorAll('button, input, [role="separator"]')]
          .filter((element) => element.getBoundingClientRect().width > 0);
        const overlaps = [];
        for (let first = 0; first < controls.length; first += 1) {
          for (let second = first + 1; second < controls.length; second += 1) {
            const left = controls[first].getBoundingClientRect();
            const right = controls[second].getBoundingClientRect();
            if (left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top) {
              overlaps.push([controls[first].ariaLabel ?? controls[first].textContent, controls[second].ariaLabel ?? controls[second].textContent]);
            }
          }
        }
        return {
          themeId: document.body.dataset.vscodeThemeId,
          viewport: [innerWidth, innerHeight],
          pairs,
          hashCounts,
          blockStarts,
          blameStarts: document.querySelectorAll('.blame-reader-blame-row.is-block-start').length,
          codeStarts: document.querySelectorAll('.blame-reader-code-row.is-block-start').length,
          blameEnds: document.querySelectorAll('.blame-reader-blame-row.is-block-end').length,
          codeEnds: document.querySelectorAll('.blame-reader-code-row.is-block-end').length,
          overflow: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
          overlaps
        };
      })()`,
      (value) => value.pairs.length === 8 && value.blockStarts.length >= 4,
      'Reader 双列与提交块未稳定',
    );
    assert(metrics.themeId === theme.id, `Reader 主题不匹配: ${metrics.themeId}`);
    assert(
      metrics.pairs.every(
        (pair) =>
          pair.blameColor === pair.codeColor && pair.blameTint === pair.codeTint,
      ),
      'Reader 同一行 Blame 与 Code 的提交颜色不一致',
    );
    assert(
      metrics.hashCounts.every((item) => item.count === item.expected),
      `Reader 提交 SHA 出现次数错误: ${JSON.stringify(metrics.hashCounts)}`,
    );
    assert(
      new Set(metrics.blockStarts.map((item) => item.color)).size >= 4 &&
        metrics.blockStarts.every(
          (item, index) =>
            index === 0 || item.color !== metrics.blockStarts[index - 1].color,
        ),
      'Reader 相邻提交未使用不同色槽或不同提交色槽不足',
    );
    assert(
      metrics.blameStarts === metrics.codeStarts &&
        metrics.blameEnds === metrics.codeEnds,
      'Reader 两列块边界数量不一致',
    );
    assert(metrics.overflow[0] <= metrics.overflow[1] + 1, 'Reader 根节点横向溢出');
    assert(
      metrics.overlaps.length === 0,
      `Reader 控件重叠: ${JSON.stringify(metrics.overlaps)}`,
    );
    await capture(page, `ui-reader-${theme.key}-${zoom.label}.png`);

    await reader.evaluateInContext(
      reader.contextId,
      `document.querySelector('button[aria-label="Show commit details"]').click()`,
    );
    const dialog = await waitForReaderValue(
      reader,
      `(() => {
        const element = document.querySelector('[role="dialog"]');
        if (element === null) return undefined;
        const rect = element.getBoundingClientRect();
        return {
          text: element.textContent,
          inViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
          focusedInside: element.contains(document.activeElement),
          buttonCount: element.querySelectorAll('button').length
        };
      })()`,
      Boolean,
      'React 提交详情模态未打开',
    );
    assert(dialog.text.includes('Commit details'), 'React 模态缺少标题');
    assert(dialog.text.includes('Matrix Author'), 'React 模态缺少提交数据');
    assert(dialog.inViewport && dialog.focusedInside, 'React 模态越界或未接管焦点');
    assert(dialog.buttonCount >= 4, 'React 模态缺少提交操作');
    const notifications = await page.evaluate(
      `document.querySelectorAll('.notification-toast, .notification-list-item').length`,
    );
    assert(notifications === 0, '点击提交详情仍触发 VS Code 通知');
    await capture(page, `ui-dialog-${theme.key}-${zoom.label}.png`);
    await reader.press('Escape', 'Escape', 27);
    await waitForReaderValue(
      reader,
      `document.querySelector('[role="dialog"]') === null`,
      Boolean,
      'Escape 未关闭提交详情模态',
    );
    return {
      theme: theme.key,
      zoom: zoom.label,
      lineCount: metrics.pairs.length,
      hashCounts: metrics.hashCounts,
      blockColors: metrics.blockStarts,
      columnsShareTint: true,
      pairedBlockBoundaries: true,
      noOverlap: true,
      dialog: { ...dialog, noVscodeNotification: true, escapeClosed: true },
    };
  } finally {
    reader.close();
  }
}

async function openFile(page, file) {
  await page.press('p', 'KeyP', 80, 4);
  await replaceInput(page, file);
  await waitForPageValue(
    page,
    `[...document.querySelectorAll('.quick-input-list .monaco-list-row')].map((element) => element.innerText)`,
    (values) => values.some((value) => value.includes(file)),
    `Quick Open 没有 ${file}`,
  );
  await page.press('Enter', 'Enter', 13);
  await waitForPageValue(
    page,
    `document.querySelector('.tab.active')?.innerText ?? ''`,
    (value) => value.includes(file),
    `没有打开 ${file}`,
  );
}

async function selectTheme(page, theme) {
  await page.press('Escape', 'Escape', 27);
  await page.press('k', 'KeyK', 75, 4);
  await delay(100);
  await page.press('t', 'KeyT', 84, 4);
  await delay(500);
  await replaceInput(page, theme.label);
  await page.press('Enter', 'Enter', 13);
  await waitForReader(page.port, theme.id);
}

async function replaceInput(page, value) {
  await waitForPageValue(
    page,
    `Boolean(document.querySelector('.quick-input-widget input'))`,
    Boolean,
    'Quick Input 未显示',
  );
  await page.evaluate(`document.querySelector('.quick-input-widget input').focus()`);
  await page.press('a', 'KeyA', 65, 4);
  await page.call('Input.insertText', { text: value });
}

async function waitForQuickPickTitle(page, title) {
  await waitForPageValue(
    page,
    `document.querySelector('.quick-input-title')?.textContent ?? ''`,
    (value) => value.includes(title),
    `Quick Pick 标题不是 ${title}`,
  );
}

async function waitForWorkbench(page) {
  await waitForPageValue(
    page,
    `Boolean(document.querySelector('.monaco-workbench'))`,
    Boolean,
    'VS Code 工作台未就绪',
  );
  await delay(1_500);
}

async function waitForReader(port, themeId) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const reader = await connectReader(port);
      const value = await reader.evaluateInContext(
        reader.contextId,
        `({ lineCount: document.querySelectorAll('[data-code-line]').length, themeId: document.body.dataset.vscodeThemeId })`,
      );
      reader.close();
      if (value.lineCount > 0 && (themeId === undefined || value.themeId === themeId)) {
        return;
      }
    } catch (error) {
      void error;
    }
    await delay(250);
  }
  throw new Error('等待 Reader 状态超时');
}

async function connectReader(port) {
  const client = await connectToTarget(port, 'iframe');
  await client.call('Runtime.enable');
  const contextId = await client.findContext('.blame-reader-shell');
  return { ...client, contextId };
}

async function waitForReaderValue(reader, expression, predicate, message) {
  const deadline = Date.now() + 10_000;
  let value;
  while (Date.now() < deadline) {
    value = await reader.evaluateInContext(reader.contextId, expression);
    if (predicate(value)) return value;
    await delay(150);
  }
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}

async function waitForPageValue(page, expression, predicate, message) {
  const deadline = Date.now() + 15_000;
  let value;
  while (Date.now() < deadline) {
    value = await page.evaluate(expression);
    if (predicate(value)) return value;
    await delay(200);
  }
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}

async function capture(page, fileName) {
  const response = await page.call('Page.captureScreenshot', {
    format: 'png',
    fromSurface: false,
    captureBeyondViewport: false,
  });
  const bytes = Buffer.from(response.result.data, 'base64');
  assert(bytes.byteLength > 20_000, `截图像素数据过小: ${fileName}`);
  await writeFile(path.join(evidenceDirectory, fileName), bytes);
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
        if (message.error !== undefined) reject(new Error(message.error.message));
        else resolve(message);
      });
      websocket.send(JSON.stringify({ id, method, params }));
    });
  return {
    port,
    call,
    close: () => websocket.close(),
    press: async (key, code, virtualKey, modifiers = 0) => {
      for (const type of ['keyDown', 'keyUp']) {
        await call('Input.dispatchKeyEvent', {
          type,
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
    findContext: async (selector) => {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        for (const context of contexts) {
          const response = await call('Runtime.evaluate', {
            contextId: context.id,
            expression: `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
            returnByValue: true,
          });
          if (response.result.result.value === true) return context.id;
        }
        await delay(100);
      }
      throw new Error(`未找到 execution context: ${selector}`);
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
      if (predicate(targets)) return;
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

async function runHostCommand(command) {
  const id = String(nextCommandId++);
  const temporaryRequest = path.join(commandRequestDirectory, `${id}.tmp`);
  const request = path.join(commandRequestDirectory, `${id}.json`);
  const response = path.join(commandResponseDirectory, `${id}.json`);
  await writeFile(temporaryRequest, JSON.stringify({ id, command }), 'utf8');
  await rename(temporaryRequest, request);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const result = JSON.parse(await readFile(response, 'utf8'));
      if (result.ok === true) return;
      throw new Error(`公开命令执行失败 ${command}: ${result.error}`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    await delay(100);
  }
  throw new Error(`公开命令执行超时: ${command}`);
}

function createExtensionTestBridge() {
  return `const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');
const requests = ${JSON.stringify(commandRequestDirectory)};
const responses = ${JSON.stringify(commandResponseDirectory)};
exports.run = async function () {
  while (true) {
    for (const name of fs.readdirSync(requests).filter((value) => value.endsWith('.json'))) {
      const requestPath = path.join(requests, name);
      const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
      fs.rmSync(requestPath);
      try {
        await vscode.commands.executeCommand(request.command);
        fs.writeFileSync(path.join(responses, name), JSON.stringify({ ok: true }));
      } catch (error) {
        fs.writeFileSync(path.join(responses, name), JSON.stringify({ ok: false, error: String(error) }));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};
`;
}

async function replaceSourceLine(line, text) {
  const source = (await readFile(path.join(workspace, sourcePath), 'utf8')).split('\n');
  source[line - 1] = text;
  await writeFile(path.join(workspace, sourcePath), source.join('\n'));
}

async function commit(message) {
  await runGit(['commit', '--quiet', '-m', message]);
}

async function revParseHead() {
  return (await runCapture('git', ['rev-parse', 'HEAD'], workspace)).trim();
}

function runGit(args) {
  return run('git', args, workspace);
}

function run(command, args, cwd = repository) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} 退出码 ${String(code)}`));
    });
    child.once('error', reject);
  });
}

function runCapture(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('exit', (code) => {
      if (code === 0) resolve(Buffer.concat(stdout).toString('utf8'));
      else reject(new Error(Buffer.concat(stderr).toString('utf8')));
    });
    child.once('error', reject);
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
