import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, realpath, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type {
  GitReviewSession,
  GitReviewSessionSnapshot,
} from '../../src/core/domains/git-review/public-api';
import type { VscodeToolboxNamewtaExtensionApi } from '../../src/core/contracts';

const executeFile = promisify(execFile);
const REVIEW_CHANGES_TITLE =
  'Git Review · 2 items · staged 0 · unstaged 2 · conflicts 0';

suite('Git Review Extension Host 集成', () => {
  test('通过公开 API 审核真实 staged、unstaged、untracked 与删除变更，且不写入 Git', async () => {
    const fixture = await createReviewRepository();
    try {
      const api = await extensionApi();
      const started = await api.execute('gitReview.start', {
        repositoryRoot: fixture.repository,
        replace: false,
      });
      assert.equal(started.ok, true);
      if (!started.ok) {
        return;
      }

      const initialSession = requireSession(started.data);
      const changes = new Map(
        initialSession.items.map((item) => [item.path, item.change]),
      );
      assert.equal(changes.get('main.ts'), 'modified');
      assert.equal(changes.get('staged.ts'), 'modified');
      assert.equal(changes.get('untracked.ts'), 'untracked');
      assert.equal(changes.get('deleted.ts'), 'deleted');
      assert.equal(changes.get('renamed.ts'), 'renamed');

      const renamedItem = initialSession.items.find(
        (item) => item.path === 'renamed.ts',
      );
      assert.ok(renamedItem);
      assert.equal(renamedItem.previousPath, 'before-rename.ts');
      const renamedContent = await api.execute('gitReview.getItemContent', {
        path: renamedItem.path,
        contentIdentity: renamedItem.contentIdentity,
      });
      assert.equal(renamedContent.ok, true);
      if (!renamedContent.ok) {
        return;
      }
      assert.deepEqual(renamedContent.data, {
        kind: 'text',
        before: 'rename base\n',
        after: 'rename base\n',
      });

      const binaryItem = initialSession.items.find(
        (item) => item.path === 'binary.bin',
      );
      assert.ok(binaryItem);
      assert.equal(binaryItem.presentation, 'binary');
      const binaryContent = await api.execute('gitReview.getItemContent', {
        path: binaryItem.path,
        contentIdentity: binaryItem.contentIdentity,
      });
      assert.equal(binaryContent.ok, true);
      if (!binaryContent.ok) {
        return;
      }
      assert.deepEqual(binaryContent.data, { kind: 'summary', reason: 'binary' });

      const mainItem = initialSession.items.find((item) => item.path === 'main.ts');
      assert.ok(mainItem);
      const content = await api.execute('gitReview.getItemContent', {
        path: mainItem.path,
        contentIdentity: mainItem.contentIdentity,
      });
      assert.equal(content.ok, true);
      if (!content.ok) {
        return;
      }
      assert.deepEqual(content.data, {
        kind: 'text',
        before: 'main base\n',
        after: 'main working tree\n',
      });

      await writeFile(path.join(fixture.repository, 'later.ts'), 'later\n');
      const statusBeforeReview = await gitStatus(fixture.repository);
      const stale = await api.execute('gitReview.markStale', {});
      assert.equal(stale.ok, true);
      if (!stale.ok) {
        return;
      }
      assert.equal(stale.data.state, 'stale');

      const refreshed = await api.execute('gitReview.refresh', {});
      assert.equal(refreshed.ok, true);
      if (!refreshed.ok) {
        return;
      }
      assert.equal(refreshed.data.state, 'active');
      assert.ok(
        requireSession(refreshed.data).items.some((item) => item.path === 'later.ts'),
      );

      const completed = await completeReview(api, refreshed.data);
      assert.equal(completed.state, 'completed');
      if (completed.state === 'completed') {
        assert.equal(completed.summary.total, 7);
        assert.equal(completed.summary.reviewed, 7);
        assert.equal(completed.summary.skipped, 0);
      }
      const ended = await api.execute('gitReview.end', {});
      assert.equal(ended.ok, true);
      if (ended.ok) {
        assert.equal(ended.data.state, 'inactive');
      }
      assert.equal(await gitStatus(fixture.repository), statusBeforeReview);
    } finally {
      await removeFixtureRepository(fixture.repository);
    }
  });
});

suite('Git Review Extension Host 无 HEAD 集成', () => {
  test('通过公开 API 以空基准读取无 HEAD 仓库，且不写入 Git', async () => {
    const fixture = await createUnbornReviewRepository();
    try {
      const api = await extensionApi();
      const statusBeforeReview = await gitStatus(fixture.repository);
      const started = await api.execute('gitReview.start', {
        repositoryRoot: fixture.repository,
        replace: false,
      });
      assert.equal(started.ok, true);
      if (!started.ok) {
        return;
      }

      const session = requireSession(started.data);
      assert.equal(session.items.length, 1);
      const [item] = session.items;
      assert.ok(item);
      assert.equal(item.path, 'first.ts');
      assert.equal(item.change, 'added');
      const content = await api.execute('gitReview.getItemContent', {
        path: item.path,
        contentIdentity: item.contentIdentity,
      });
      assert.equal(content.ok, true);
      if (!content.ok) {
        return;
      }
      assert.deepEqual(content.data, {
        kind: 'text',
        before: '',
        after: 'first\n',
      });

      const ended = await api.execute('gitReview.end', {});
      assert.equal(ended.ok, true);
      assert.equal(await gitStatus(fixture.repository), statusBeforeReview);
    } finally {
      await removeFixtureRepository(fixture.repository);
    }
  });
});

suite('Git Review Extension Host 命令集成', () => {
  test('通过 SCM 标题菜单上下文启动指定仓库', async () => {
    const fixture = await createUiReviewRepository();
    const sourceControl = vscode.scm.createSourceControl(
      'vscode-toolbox-namewta-integration-review',
      'Toolbox Integration Review',
      vscode.Uri.file(fixture.repository),
    );
    let api: VscodeToolboxNamewtaExtensionApi | undefined;
    try {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      api = await extensionApi();

      await vscode.commands.executeCommand(
        'vscodeToolboxNamewta.gitReview.start',
        sourceControl,
      );
      await waitForNativeReviewChanges();
      const refreshed = await api.execute('gitReview.refresh', {});

      assert.equal(refreshed.ok, true);
      if (refreshed.ok) {
        assert.equal(
          await realpath(requireSession(refreshed.data).repositoryRoot),
          await realpath(fixture.repository),
        );
      }
    } finally {
      if (api !== undefined) {
        await finishCommandReview(api);
      }
      sourceControl.dispose();
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      await removeFixtureRepository(fixture.repository);
    }
  });

  test('通过公开命令打开单一原生 Changes 页并执行普通导航', async () => {
    const fixture = await createUiReviewRepository();
    try {
      const api = await extensionApi();
      const document = await vscode.workspace.openTextDocument(
        vscode.Uri.file(path.join(fixture.repository, 'main.ts')),
      );
      await vscode.window.showTextDocument(document);
      const statusBeforeReview = await gitStatus(fixture.repository);

      await vscode.commands.executeCommand('vscodeToolboxNamewta.gitReview.start');
      await waitForNativeReviewChanges();
      assert.equal(reviewChangesCount(), 1);
      await vscode.commands.executeCommand('vscodeToolboxNamewta.gitReview.next');
      assert.equal(reviewChangesCount(), 1);

      const stale = await api.execute('gitReview.markStale', {});
      assert.equal(stale.ok, true);
      if (stale.ok) {
        assert.equal(stale.data.state, 'stale');
        assert.equal(requireSession(stale.data).currentItemPath, 'second.ts');
      }

      await finishCommandReview(api);
      const ended = await api.execute('gitReview.end', {});
      assert.equal(ended.ok, true);
      if (ended.ok) {
        assert.equal(ended.data.state, 'inactive');
      }
      assert.equal(await gitStatus(fixture.repository), statusBeforeReview);
    } finally {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      await removeFixtureRepository(fixture.repository);
    }
  });
});

async function extensionApi(): Promise<VscodeToolboxNamewtaExtensionApi> {
  const extension = vscode.extensions.getExtension<VscodeToolboxNamewtaExtensionApi>(
    'NAMEWTA.vscode-toolbox-namewta',
  );
  assert.ok(extension);
  return extension.activate();
}

async function completeReview(
  api: VscodeToolboxNamewtaExtensionApi,
  initial: GitReviewSessionSnapshot,
): Promise<GitReviewSessionSnapshot> {
  let snapshot = initial;
  for (let index = 0; index < 8 && snapshot.state !== 'completed'; index += 1) {
    const result = await api.execute('gitReview.markReviewedAndNext', {});
    assert.equal(result.ok, true);
    if (!result.ok) {
      throw new Error('Git 审核组合命令失败。');
    }
    snapshot = result.data;
  }
  return snapshot;
}

function requireSession(snapshot: GitReviewSessionSnapshot): GitReviewSession {
  if (!('session' in snapshot)) {
    throw new Error('Git 审核会话不处于可读取状态。');
  }
  return snapshot.session;
}

async function waitForNativeReviewChanges(): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (reviewChangesCount() === 1) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `没有在预期时间内打开单一 Git 审核原生 Changes 页。当前标签：${JSON.stringify(tabSnapshot())}`,
  );
}

async function finishCommandReview(
  api: VscodeToolboxNamewtaExtensionApi,
): Promise<void> {
  await vscode.commands.executeCommand('vscodeToolboxNamewta.gitReview.refresh');
  const current = await api.execute('gitReview.refresh', {});
  if (!current.ok || !('session' in current.data)) {
    return;
  }
  let remaining = current.data.session.items.length;
  while (remaining > 0) {
    await vscode.commands.executeCommand(
      'vscodeToolboxNamewta.gitReview.markReviewedAndNext',
    );
    remaining -= 1;
  }
}

async function removeFixtureRepository(repository: string): Promise<void> {
  await rm(repository, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
}

function reviewChangesCount(): number {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter(
      (tab) =>
        tab.label.startsWith(REVIEW_CHANGES_TITLE) &&
        !(tab.input instanceof vscode.TabInputWebview),
    ).length;
}

function tabSnapshot(): readonly object[] {
  return vscode.window.tabGroups.all.flatMap((group) =>
    group.tabs.map((tab) => ({
      label: tab.label,
      viewType:
        typeof tab.input === 'object' && tab.input !== null && 'viewType' in tab.input
          ? String(tab.input.viewType)
          : undefined,
    })),
  );
}

type ReviewFixture = { readonly repository: string };

async function createReviewRepository(): Promise<ReviewFixture> {
  const repository = await createRepository('vscode-toolbox-namewta-host-review-');
  await writeFile(path.join(repository, 'main.ts'), 'main base\n');
  await writeFile(path.join(repository, 'staged.ts'), 'staged base\n');
  await writeFile(path.join(repository, 'deleted.ts'), 'deleted base\n');
  await writeFile(path.join(repository, 'before-rename.ts'), 'rename base\n');
  await git(repository, [
    'add',
    '--',
    'main.ts',
    'staged.ts',
    'deleted.ts',
    'before-rename.ts',
  ]);
  await git(repository, ['commit', '-m', 'initial']);
  await writeFile(path.join(repository, 'main.ts'), 'main working tree\n');
  await writeFile(path.join(repository, 'staged.ts'), 'staged working tree\n');
  await git(repository, ['add', '--', 'staged.ts']);
  await writeFile(path.join(repository, 'untracked.ts'), 'untracked\n');
  await writeFile(path.join(repository, 'binary.bin'), Buffer.from([0, 1, 2, 3]));
  await unlink(path.join(repository, 'deleted.ts'));
  await git(repository, ['mv', 'before-rename.ts', 'renamed.ts']);
  return { repository };
}

async function createUnbornReviewRepository(): Promise<ReviewFixture> {
  const repository = await createRepository(
    'vscode-toolbox-namewta-host-review-unborn-',
  );
  await writeFile(path.join(repository, 'first.ts'), 'first\n');
  await git(repository, ['add', '--', 'first.ts']);
  return { repository };
}

async function createUiReviewRepository(): Promise<ReviewFixture> {
  const repository = await createRepository('vscode-toolbox-namewta-host-review-ui-');
  await writeFile(path.join(repository, 'main.ts'), 'before\n');
  await writeFile(path.join(repository, 'second.ts'), 'second before\n');
  await git(repository, ['add', '--', 'main.ts', 'second.ts']);
  await git(repository, ['commit', '-m', 'initial']);
  await writeFile(path.join(repository, 'main.ts'), 'after\n');
  await writeFile(path.join(repository, 'second.ts'), 'second after\n');
  return { repository };
}

async function createRepository(prefix: string): Promise<string> {
  const repository = await mkdtemp(path.join(tmpdir(), prefix));
  await git(repository, ['init']);
  await git(repository, ['config', 'user.name', 'vscode-toolbox-namewta Test']);
  await git(repository, ['config', 'user.email', 'test@example.invalid']);
  return repository;
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await executeFile('git', args, { cwd });
}

async function gitStatus(cwd: string): Promise<string> {
  return (await executeFile('git', ['status', '--porcelain=v2', '-z'], { cwd })).stdout;
}
