import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GitCommandResult } from '../../../core/domains/git-blame/public-api';
import { GitBlamePortAdapter } from './git-blame-port-adapter';
import { GitCommandRunner } from './git-command-runner';

describe('GitBlamePortAdapter', () => {
  it('reads tracked working-tree and historical blame from a real repository', async () => {
    const repository = await createRepository();
    const git = new GitCommandRunner();
    const adapter = new GitBlamePortAdapter(git, () => true);
    try {
      const initialCommit = (
        await runGit(git, repository, ['rev-parse', 'HEAD'])
      ).stdout.trim();
      await runGit(git, repository, ['mv', 'main.ts', 'renamed.ts']);
      await runGit(git, repository, ['commit', '-m', 'rename']);
      await writeFile(
        path.join(repository, 'renamed.ts'),
        'first\nsecond\nworking tree\n',
      );
      const resource = { repositoryRoot: repository, relativePath: 'renamed.ts' };

      await expect(
        adapter.getAnnotations(
          { resource, ignoreWhitespace: false },
          { aborted: false },
        ),
      ).resolves.toMatchObject({
        status: 'available',
        lines: [
          { line: 1, author: 'vscode-toolbox-namewta Test' },
          { line: 2, author: 'vscode-toolbox-namewta Test' },
          { line: 3, commit: '0'.repeat(40), author: 'Not Committed Yet' },
        ],
      });
      await expect(
        adapter.getAnnotations(
          {
            resource: { repositoryRoot: repository, relativePath: 'main.ts' },
            ref: initialCommit,
            ignoreWhitespace: false,
          },
          { aborted: false },
        ),
      ).resolves.toMatchObject({ status: 'available' });
    } finally {
      await rm(repository, { recursive: true, force: true });
    }
  });

  it('returns unavailable for an untracked file', async () => {
    const repository = await createRepository();
    const git = new GitCommandRunner();
    const adapter = new GitBlamePortAdapter(git, () => true);
    try {
      await writeFile(path.join(repository, 'draft.ts'), 'draft\n');
      await expect(
        adapter.getAnnotations(
          {
            resource: { repositoryRoot: repository, relativePath: 'draft.ts' },
            ignoreWhitespace: false,
          },
          { aborted: false },
        ),
      ).resolves.toEqual({ status: 'unavailable', reason: 'untracked' });
    } finally {
      await rm(repository, { recursive: true, force: true });
    }
  });
});

async function createRepository(): Promise<string> {
  const repository = await mkdtemp(
    path.join(tmpdir(), 'vscode-toolbox-namewta-blame-'),
  );
  const git = new GitCommandRunner();
  await runGit(git, repository, ['init']);
  await runGit(git, repository, ['config', 'user.name', 'vscode-toolbox-namewta Test']);
  await runGit(git, repository, ['config', 'user.email', 'test@example.invalid']);
  await writeFile(path.join(repository, 'main.ts'), 'first\nsecond\n');
  await runGit(git, repository, ['add', '--', 'main.ts']);
  await runGit(git, repository, ['commit', '-m', 'initial']);
  return repository;
}

function runGit(
  git: GitCommandRunner,
  cwd: string,
  args: readonly string[],
): Promise<GitCommandResult> {
  return git.run({ operation: 'test-fixture', cwd, args });
}
