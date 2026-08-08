import { describe, expect, it, vi } from 'vitest';
import { GIT_EMPTY_TREE_HASH } from './git-history-model';
import type {
  GitLineHistoryLocator,
  GitLineHistoryPort,
  GitLineHistoryStep,
} from './git-line-history-model';
import { GitLineHistoryTracker } from './git-line-history-tracker';

const firstCommit = 'a'.repeat(40);
const secondCommit = 'b'.repeat(40);
const resource = { repositoryRoot: '/repo', relativePath: 'renamed.ts' };
const signal = { aborted: false };

describe('GitLineHistoryTracker', () => {
  it('preserves page order and resumes from the opaque cursor', async () => {
    const port = createPort((locator) => historyStep(locator));
    const tracker = new GitLineHistoryTracker(port);

    const first = await tracker.getPage(
      { resource, ref: 'HEAD', path: 'renamed.ts', line: 9, limit: 1 },
      signal,
    );
    const second = await tracker.getPage(
      {
        resource,
        ref: 'HEAD',
        path: 'renamed.ts',
        line: 9,
        limit: 1,
        cursor: requiredCursor(first.nextCursor),
      },
      signal,
    );

    expect(first).toMatchObject({
      complete: false,
      entries: [{ commit: secondCommit, changeType: 'renamed' }],
    });
    expect(second).toMatchObject({
      complete: true,
      entries: [{ commit: firstCommit, changeType: 'added' }],
    });
  });

  it('terminates deterministically when a mapping repeats', async () => {
    const port = createPort((locator) => ({
      entry: entry(secondCommit, firstCommit, locator, 'modified'),
      previous: locator,
    }));
    const tracker = new GitLineHistoryTracker(port);

    await expect(
      tracker.getPage(
        { resource, ref: 'HEAD', path: 'renamed.ts', line: 9, limit: 10 },
        signal,
      ),
    ).resolves.toMatchObject({ complete: true, entries: [{ commit: secondCommit }] });
  });

  it('rejects a cursor created for a different origin', async () => {
    const tracker = new GitLineHistoryTracker(
      createPort((locator) => historyStep(locator)),
    );
    const first = await tracker.getPage(
      { resource, ref: 'HEAD', path: 'renamed.ts', line: 9, limit: 1 },
      signal,
    );

    await expect(
      tracker.getPage(
        {
          resource,
          ref: 'HEAD',
          path: 'other.ts',
          line: 9,
          limit: 1,
          cursor: requiredCursor(first.nextCursor),
        },
        signal,
      ),
    ).rejects.toMatchObject({ code: 'invalid-input' });
  });
});

function historyStep(locator: GitLineHistoryLocator): GitLineHistoryStep {
  if (locator.ref === 'HEAD') {
    return {
      entry: entry(secondCommit, firstCommit, locator, 'renamed', 'main.ts'),
      previous: { ref: firstCommit, path: 'main.ts', line: 4 },
    };
  }
  return {
    entry: {
      ...entry(firstCommit, GIT_EMPTY_TREE_HASH, locator, 'added'),
      path: 'main.ts',
      line: 4,
    },
  };
}

function entry(
  commit: string,
  parentCommit: string,
  locator: GitLineHistoryLocator,
  changeType: 'added' | 'modified' | 'renamed',
  previousPath?: string,
): GitLineHistoryStep['entry'] {
  return {
    changeType,
    path: locator.path,
    line: locator.line,
    commit,
    parentCommit,
    author: 'Alice',
    authoredAt: 1_700_000_000,
    summary: 'change line',
    lineText: 'const value = 1;',
    ...(previousPath === undefined ? {} : { previousPath }),
  };
}

function createPort(
  getStep: (locator: GitLineHistoryLocator) => GitLineHistoryStep,
): GitLineHistoryPort {
  const getLineHistoryStep = vi.fn<GitLineHistoryPort['getLineHistoryStep']>(
    (_resource, locator) => Promise.resolve(getStep(locator)),
  );
  return { getLineHistoryStep };
}

function requiredCursor(value: string | undefined): string {
  if (value === undefined) {
    throw new Error('测试预期存在下一页 cursor。');
  }
  return value;
}
