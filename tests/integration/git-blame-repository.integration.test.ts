import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { VscodeToolboxNamewtaExtensionApi } from '../../src/core/contracts';

const executeFile = promisify(execFile);

suite('Git blame repository integration', () => {
  test('returns serialized annotations through the public API', async () => {
    const repository = await createRepository();
    try {
      const extension =
        vscode.extensions.getExtension<VscodeToolboxNamewtaExtensionApi>(
          'NAMEWTA.vscode-toolbox-namewta',
        );
      assert.ok(extension);
      const api = await extension.activate();

      const result = await api.execute('gitBlame.getAnnotations', {
        resource: { repositoryRoot: repository, relativePath: 'main.ts' },
        documentVersion: 3,
        lineCount: 3,
        ignoreWhitespace: false,
        maxLines: 20_000,
      });

      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.data.status, 'available');
        if (result.data.status === 'available') {
          assert.equal(result.data.documentVersion, 3);
          assert.equal(result.data.lines.length, 2);
          assert.equal(result.data.lines[0]?.author, 'vscode-toolbox-namewta Test');
        }
      }
    } finally {
      await rm(repository, { recursive: true, force: true });
    }
  });
});

async function createRepository(): Promise<string> {
  const repository = await mkdtemp(
    path.join(tmpdir(), 'vscode-toolbox-namewta-host-blame-'),
  );
  await git(repository, ['init']);
  await git(repository, ['config', 'user.name', 'vscode-toolbox-namewta Test']);
  await git(repository, ['config', 'user.email', 'test@example.invalid']);
  await writeFile(path.join(repository, 'main.ts'), 'first\nsecond\n');
  await git(repository, ['add', '--', 'main.ts']);
  await git(repository, ['commit', '-m', 'initial']);
  return repository;
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await executeFile('git', args, { cwd });
}
