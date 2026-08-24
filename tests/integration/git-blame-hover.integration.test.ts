import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { VscodeToolboxNamewtaExtensionApi } from '../../src/core/contracts';

const executeFile = promisify(execFile);

suite('Git blame Hover integration', () => {
  test('returns remote metadata and copies a full hash through the Gateway', async () => {
    const fixture = await createRepository();
    try {
      const extension =
        vscode.extensions.getExtension<VscodeToolboxNamewtaExtensionApi>(
          'NAMEWTA.vscode-toolbox-namewta',
        );
      assert.ok(extension);
      const api = await extension.activate();
      const annotations = await api.execute('gitBlame.getAnnotations', {
        resource: {
          repositoryRoot: fixture.repository,
          relativePath: 'main.ts',
        },
        documentVersion: 1,
        lineCount: 2,
        ignoreWhitespace: false,
        showCommitNumber: false,
        maxLines: 20_000,
      });
      assert.equal(annotations.ok, true);
      if (annotations.ok) {
        assert.equal(annotations.data.status, 'available');
        if (annotations.data.status === 'available') {
          assert.equal(annotations.data.remoteUrl, 'git@github.com:owner/repo.git');
        }
      }
      const copied = await api.execute('gitBlame.copyCommitHash', {
        hash: fixture.commit,
      });
      assert.deepEqual(copied, { ok: true, data: fixture.commit });
      assert.equal(await vscode.env.clipboard.readText(), fixture.commit);
      const commands = await vscode.commands.getCommands(true);
      for (const command of [
        'vscodeToolboxNamewta.gitBlame.internal.copyCommitHash',
        'vscodeToolboxNamewta.gitBlame.internal.viewCommitChanges',
        'vscodeToolboxNamewta.gitBlame.internal.openPreviousVersion',
        'vscodeToolboxNamewta.gitBlame.internal.viewLineHistory',
      ]) {
        assert.ok(commands.includes(command));
      }
    } finally {
      await rm(fixture.repository, { recursive: true, force: true });
    }
  });
});

type HoverFixture = { readonly repository: string; readonly commit: string };

async function createRepository(): Promise<HoverFixture> {
  const repository = await mkdtemp(
    path.join(tmpdir(), 'vscode-toolbox-namewta-hover-'),
  );
  await git(repository, ['init']);
  await git(repository, ['config', 'user.name', 'vscode-toolbox-namewta Test']);
  await git(repository, ['config', 'user.email', 'test@example.invalid']);
  await git(repository, ['remote', 'add', 'origin', 'git@github.com:owner/repo.git']);
  await writeFile(path.join(repository, 'main.ts'), 'first\nsecond');
  await git(repository, ['add', '--', 'main.ts']);
  await git(repository, ['commit', '-m', 'initial']);
  const commit = (
    await executeFile('git', ['rev-parse', 'HEAD'], { cwd: repository })
  ).stdout.trim();
  return { repository, commit };
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await executeFile('git', [...args], { cwd });
}
