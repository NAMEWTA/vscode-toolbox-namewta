import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { VscodeToolboxNamewtaExtensionApi } from '../../src/core/contracts';

const executeFile = promisify(execFile);

suite('Git Commit Compare integration', () => {
  test('lists HEAD ancestors and compares snapshots including rename and binary files', async () => {
    const repository = await createRepository();
    try {
      const extension =
        vscode.extensions.getExtension<VscodeToolboxNamewtaExtensionApi>(
          'NAMEWTA.vscode-toolbox-namewta',
        );
      assert.ok(extension);
      const api = await extension.activate();
      const firstPage = await api.execute('gitCompare.listCommits', {
        repositoryRoot: repository.root,
        limit: 10,
      });
      assert.equal(firstPage.ok, true);
      if (!firstPage.ok) return;
      assert.equal(firstPage.data.commits.length, 2);
      assert.equal(firstPage.data.commits[0]?.sha, repository.target);
      assert.equal(firstPage.data.complete, true);

      const resolved = await api.execute('gitCompare.resolveRevision', {
        repositoryRoot: repository.root,
        revision: repository.side.slice(0, 8),
      });
      assert.equal(resolved.ok, true);
      if (!resolved.ok) return;
      assert.equal(resolved.data.sha, repository.side);
      assert.equal(resolved.data.subject, 'side');

      const comparison = await api.execute('gitCompare.compareCommits', {
        repositoryRoot: repository.root,
        base: repository.side,
        target: repository.target,
      });
      assert.equal(comparison.ok, true);
      if (!comparison.ok) return;
      assert.equal(comparison.data.stats.files, 4);
      assert.deepEqual(
        comparison.data.changes
          .map((change) => [change.status, change.path, change.contentKind])
          .sort((left, right) => String(left[1]).localeCompare(String(right[1]))),
        [
          ['added', 'asset.bin', 'binary'],
          ['modified', 'main.ts', 'text'],
          ['renamed', 'renamed.ts', 'text'],
          ['deleted', 'side.ts', 'text'],
        ],
      );
    } finally {
      await rm(repository.root, { recursive: true, force: true });
    }
  });
});

type CompareFixture = {
  readonly root: string;
  readonly base: string;
  readonly target: string;
  readonly side: string;
};

async function createRepository(): Promise<CompareFixture> {
  const root = await mkdtemp(path.join(tmpdir(), 'vscode-toolbox-namewta-compare-'));
  await git(root, ['init']);
  await git(root, ['config', 'user.name', 'vscode-toolbox-namewta Test']);
  await git(root, ['config', 'user.email', 'test@example.invalid']);
  await writeFile(path.join(root, 'main.ts'), 'before\n');
  await writeFile(path.join(root, 'original.ts'), 'rename me\n');
  await git(root, ['add', '--', 'main.ts', 'original.ts']);
  await git(root, ['commit', '-m', 'base']);
  const base = await revParse(root);
  await writeFile(path.join(root, 'main.ts'), 'before\nafter\n');
  await git(root, ['mv', 'original.ts', 'renamed.ts']);
  await writeFile(path.join(root, 'asset.bin'), Buffer.from([0, 1, 2, 3]));
  await git(root, ['add', '--', 'main.ts', 'renamed.ts', 'asset.bin']);
  await git(root, ['commit', '-m', 'target']);
  const target = await revParse(root);
  await git(root, ['checkout', '-b', 'comparison-side', base]);
  await writeFile(path.join(root, 'side.ts'), 'side only\n');
  await git(root, ['add', '--', 'side.ts']);
  await git(root, ['commit', '-m', 'side']);
  const side = await revParse(root);
  await git(root, ['checkout', '--detach', target]);
  return { root, base, target, side };
}

async function revParse(cwd: string): Promise<string> {
  return (await executeFile('git', ['rev-parse', 'HEAD'], { cwd })).stdout.trim();
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await executeFile('git', args, { cwd });
}
