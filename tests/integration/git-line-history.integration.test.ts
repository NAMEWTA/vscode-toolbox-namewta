import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { VscodeToolboxNamewtaExtensionApi } from '../../src/core/contracts';
import {
  GIT_EMPTY_TREE_HASH,
  type GitLineHistoryEntry,
} from '../../src/core/domains/git-blame/public-api';

const executeFile = promisify(execFile);

suite('Git line history integration', () => {
  test('tracks root, rename and a selected merge parent across pages', async () => {
    const fixture = await createRepository();
    try {
      const api = await extensionApi();
      const entries = await loadAllEntries(api, fixture);

      assert.equal(entries[0]?.commit, fixture.mergeCommit);
      assert.ok(
        fixture.mergeParents.includes(entries[0]?.parentCommit ?? ''),
        'merge entry must select a real parent',
      );
      const renameEntry = entries.find(
        (entry) => entry.commit === fixture.renameCommit,
      );
      assert.ok(renameEntry);
      assert.equal(renameEntry.changeType, 'renamed');
      assert.equal(renameEntry.path, 'renamed.txt');
      assert.equal(renameEntry.previousPath, 'original.txt');
      const rootEntry = entries.find((entry) => entry.commit === fixture.rootCommit);
      assert.ok(rootEntry);
      assert.equal(rootEntry.changeType, 'added');
      assert.equal(rootEntry.path, 'original.txt');
      assert.equal(rootEntry.parentCommit, GIT_EMPTY_TREE_HASH);
    } finally {
      await rm(fixture.repository, { recursive: true, force: true });
    }
  });
});

type RepositoryFixture = {
  readonly repository: string;
  readonly rootCommit: string;
  readonly renameCommit: string;
  readonly mergeCommit: string;
  readonly mergeParents: readonly string[];
};

async function loadAllEntries(
  api: VscodeToolboxNamewtaExtensionApi,
  fixture: RepositoryFixture,
): Promise<readonly GitLineHistoryEntry[]> {
  const entries: GitLineHistoryEntry[] = [];
  let cursor: string | undefined;
  for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
    const result = await api.execute('gitBlame.getLineHistory', {
      resource: {
        repositoryRoot: fixture.repository,
        relativePath: 'renamed.txt',
      },
      ref: fixture.mergeCommit,
      path: 'renamed.txt',
      line: 2,
      limit: 1,
      ...(cursor === undefined ? {} : { cursor }),
    });
    if (!result.ok) {
      const previousEntry = entries.at(-1);
      const probe =
        previousEntry === undefined
          ? ''
          : await gitOutput(fixture.repository, [
              '-c',
              'core.quotePath=false',
              'blame',
              '--line-porcelain',
              '-L',
              `${String(previousEntry.line)},${String(previousEntry.line)}`,
              previousEntry.parentCommit,
              '--',
              previousEntry.previousPath ?? previousEntry.path,
            ]);
      assert.fail(JSON.stringify({ error: result.error, entries, pageNumber, probe }));
    }
    entries.push(...result.data.entries);
    if (result.data.complete) {
      return entries;
    }
    cursor = result.data.nextCursor;
    assert.ok(cursor);
  }
  assert.fail('line history did not terminate');
}

async function extensionApi(): Promise<VscodeToolboxNamewtaExtensionApi> {
  const extension = vscode.extensions.getExtension<VscodeToolboxNamewtaExtensionApi>(
    'NAMEWTA.vscode-toolbox-namewta',
  );
  assert.ok(extension);
  return extension.activate();
}

async function createRepository(): Promise<RepositoryFixture> {
  const repository = await mkdtemp(
    path.join(tmpdir(), 'vscode-toolbox-namewta-line-history-'),
  );
  await git(repository, ['init', '-b', 'main']);
  await git(repository, ['config', 'user.name', 'vscode-toolbox-namewta Test']);
  await git(repository, ['config', 'user.email', 'test@example.invalid']);
  await writeFile(path.join(repository, 'original.txt'), fileContent('target root'));
  await git(repository, ['add', '--', 'original.txt']);
  await git(repository, ['commit', '-m', 'root']);
  const rootCommit = await revParse(repository, 'HEAD');

  await git(repository, ['mv', 'original.txt', 'renamed.txt']);
  await writeFile(path.join(repository, 'renamed.txt'), fileContent('target renamed'));
  await git(repository, ['add', '--', 'renamed.txt']);
  await git(repository, ['commit', '-m', 'rename and modify']);
  const renameCommit = await revParse(repository, 'HEAD');
  await git(repository, ['branch', 'side']);

  await writeFile(path.join(repository, 'renamed.txt'), fileContent('target main'));
  await git(repository, ['commit', '-am', 'main change']);
  await git(repository, ['checkout', 'side']);
  await writeFile(path.join(repository, 'renamed.txt'), fileContent('target side'));
  await git(repository, ['commit', '-am', 'side change']);
  await git(repository, ['checkout', 'main']);
  await expectConflict(repository, ['merge', 'side', '-m', 'merge']);
  await writeFile(path.join(repository, 'renamed.txt'), fileContent('target merged'));
  await git(repository, ['add', '--', 'renamed.txt']);
  await git(repository, ['commit', '-m', 'merge resolution']);
  const mergeCommit = await revParse(repository, 'HEAD');
  const mergeParents = (
    await gitOutput(repository, ['show', '-s', '--format=%P', 'HEAD'])
  )
    .trim()
    .split(/\s+/u);
  return { repository, rootCommit, renameCommit, mergeCommit, mergeParents };
}

async function expectConflict(cwd: string, args: readonly string[]): Promise<void> {
  try {
    await executeFile('git', [...args], { cwd });
    assert.fail('merge was expected to conflict');
  } catch (error: unknown) {
    assert.ok(error instanceof Error);
  }
}

function fileContent(target: string): string {
  return [
    'first',
    target,
    'third',
    'fourth',
    'fifth',
    'sixth',
    'seventh',
    'eighth',
    'ninth',
    'last',
    '',
  ].join('\n');
}

async function revParse(cwd: string, ref: string): Promise<string> {
  return (await gitOutput(cwd, ['rev-parse', ref])).trim();
}

async function gitOutput(cwd: string, args: readonly string[]): Promise<string> {
  return (await executeFile('git', [...args], { cwd })).stdout;
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await executeFile('git', [...args], { cwd });
}
