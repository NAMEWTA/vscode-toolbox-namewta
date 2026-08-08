import { describe, expect, it, vi, type Mock } from 'vitest';
import {
  GIT_EMPTY_TREE_HASH,
  type GitCommandPort,
} from '../../../core/domains/git-blame/public-api';
import { GitLineHistoryPortAdapter } from './git-line-history-port-adapter';

const rootCommit = 'a'.repeat(40);
const mergeCommit = 'b'.repeat(40);
const firstParent = 'c'.repeat(40);
const selectedParent = 'd'.repeat(40);
const resource = { repositoryRoot: '/repo', relativePath: 'src/main.ts' };
const signal = { aborted: false };

describe('GitLineHistoryPortAdapter', () => {
  it('maps a root line to the empty tree and terminates', async () => {
    const git = createGitPort([
      blame({ commit: rootCommit, path: 'src/main.ts', line: 3 }),
      `${rootCommit}\n`,
    ]);
    const adapter = new GitLineHistoryPortAdapter(git, () => true);

    await expect(
      adapter.getLineHistoryStep(
        resource,
        { ref: 'HEAD', path: 'src/main.ts', line: 3 },
        signal,
      ),
    ).resolves.toEqual({
      entry: {
        changeType: 'added',
        path: 'src/main.ts',
        line: 3,
        commit: rootCommit,
        parentCommit: GIT_EMPTY_TREE_HASH,
        author: 'Alice',
        authoredAt: 1_700_000_000,
        summary: 'change line',
        lineText: 'const value = 1;',
      },
    });
  });

  it('uses the blame-selected merge parent and preserves a renamed path', async () => {
    const git = createGitPort([
      blame({
        commit: mergeCommit,
        path: 'src/main.ts',
        line: 8,
        previousCommit: selectedParent,
        previousPath: 'src/old.ts',
      }),
      `${mergeCommit} ${firstParent} ${selectedParent}\n`,
      [
        'diff --git a/src/old.ts b/src/main.ts',
        'rename from src/old.ts',
        'rename to src/main.ts',
        '@@ -6,2 +8,2 @@',
        '-const old = 1;',
        '-const value = 0;',
        '+const inserted = true;',
        '+const value = 1;',
        '',
      ].join('\n'),
    ]);
    const adapter = new GitLineHistoryPortAdapter(git, () => true);

    await expect(
      adapter.getLineHistoryStep(
        resource,
        { ref: 'HEAD', path: 'src/main.ts', line: 10 },
        signal,
      ),
    ).resolves.toMatchObject({
      entry: {
        changeType: 'renamed',
        path: 'src/main.ts',
        previousPath: 'src/old.ts',
        line: 8,
        commit: mergeCommit,
        parentCommit: selectedParent,
      },
      previous: { ref: selectedParent, path: 'src/old.ts', line: 6 },
    });
    const mappingRequest = git.run.mock.calls[2]?.[0];
    expect(mappingRequest?.args).toContain(`${selectedParent}:src/old.ts`);
    expect(mappingRequest?.args).toContain(`${mergeCommit}:src/main.ts`);
  });

  it('terminates at a newly added line without inventing a parent line', async () => {
    const git = createGitPort([
      blame({
        commit: mergeCommit,
        path: 'src/main.ts',
        line: 4,
        previousCommit: firstParent,
        previousPath: 'src/main.ts',
      }),
      `${mergeCommit} ${firstParent}\n`,
      '@@ -3,0 +4 @@\n+const value = 1;\n',
    ]);
    const adapter = new GitLineHistoryPortAdapter(git, () => true);

    await expect(
      adapter.getLineHistoryStep(
        resource,
        { ref: mergeCommit, path: 'src/main.ts', line: 4 },
        signal,
      ),
    ).resolves.toMatchObject({
      entry: { changeType: 'added', parentCommit: firstParent },
    });
  });

  it('proves a single-parent rename when blame omits previous metadata', async () => {
    const git = createGitPort([
      blame({ commit: mergeCommit, path: 'src/main.ts', line: 2 }),
      `${mergeCommit} ${firstParent}\n`,
      'R80\tsrc/old.ts\tsrc/main.ts\n',
      '@@ -2 +2 @@\n-old\n+new\n',
    ]);
    const adapter = new GitLineHistoryPortAdapter(git, () => true);

    await expect(
      adapter.getLineHistoryStep(
        resource,
        { ref: mergeCommit, path: 'src/main.ts', line: 2 },
        signal,
      ),
    ).resolves.toMatchObject({
      entry: {
        changeType: 'renamed',
        previousPath: 'src/old.ts',
        parentCommit: firstParent,
      },
      previous: { ref: firstParent, path: 'src/old.ts', line: 2 },
    });
  });
});

type BlameOptions = {
  readonly commit: string;
  readonly path: string;
  readonly line: number;
  readonly previousCommit?: string;
  readonly previousPath?: string;
};

function blame(options: BlameOptions): string {
  return [
    `${options.commit} ${options.line} 1 1`,
    'author Alice',
    'author-mail <alice@example.com>',
    'author-time 1700000000',
    'summary change line',
    ...(options.previousCommit === undefined
      ? []
      : [`previous ${options.previousCommit} ${options.previousPath ?? options.path}`]),
    `filename ${options.path}`,
    '\tconst value = 1;',
    '',
  ].join('\n');
}

function createGitPort(
  outputs: readonly string[],
): GitCommandPort & { readonly run: Mock<GitCommandPort['run']> } {
  const run = vi.fn<GitCommandPort['run']>();
  for (const stdout of outputs) {
    run.mockResolvedValueOnce({ stdout, stdoutBytes: stdout.length, stderrBytes: 0 });
  }
  return { run };
}
