import { describe, expect, it, vi } from 'vitest';
import {
  GIT_EMPTY_TREE_HASH,
  type GitCommandPort,
} from '../../../core/domains/git-blame/public-api';
import { GitHistoryPortAdapter } from './git-history-port-adapter';

const rootCommit = 'a'.repeat(40);
const renameCommit = 'b'.repeat(40);
const resource = { repositoryRoot: '/repo', relativePath: 'renamed.ts' };

describe('GitHistoryPortAdapter', () => {
  it('maps root, rename and content Git protocols into reproducible descriptors', async () => {
    const git = createGitPort([
      `${rootCommit}\n`,
      'A\tmain.ts\n',
      `${renameCommit} ${rootCommit}\n`,
      'R100\tmain.ts\trenamed.ts\n',
      'first\nsecond\n',
    ]);
    const adapter = new GitHistoryPortAdapter(git, () => true);

    await expect(
      adapter.getCommitChanges({ resource, commit: rootCommit }, { aborted: false }),
    ).resolves.toMatchObject({
      changes: [
        {
          status: 'added',
          before: { ref: GIT_EMPTY_TREE_HASH, path: 'main.ts' },
          after: { ref: rootCommit, path: 'main.ts' },
        },
      ],
    });
    await expect(
      adapter.getCommitChanges({ resource, commit: renameCommit }, { aborted: false }),
    ).resolves.toMatchObject({
      changes: [
        {
          status: 'renamed',
          previousPath: 'main.ts',
          path: 'renamed.ts',
        },
      ],
    });
    await expect(
      adapter.getHistoricalContent(
        { resource, ref: rootCommit, path: 'main.ts' },
        { aborted: false },
      ),
    ).resolves.toEqual({ content: 'first\nsecond\n' });
    expect(git.run).toHaveBeenCalledTimes(5);
  });
});

function createGitPort(outputs: readonly string[]): GitCommandPort & {
  readonly run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn();
  for (const stdout of outputs) {
    run.mockResolvedValueOnce({ stdout, stdoutBytes: stdout.length, stderrBytes: 0 });
  }
  return { run };
}
