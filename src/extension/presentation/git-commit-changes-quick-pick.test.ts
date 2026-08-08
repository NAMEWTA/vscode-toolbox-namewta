import { describe, expect, it, vi } from 'vitest';
import type {
  GitCommitChange,
  GitCommitChangesInput,
  GitCommitChangesResult,
} from '../../core/domains/git-blame/public-api';
import {
  GitCommitChangesQuickPick,
  type GitCommitChangesLoader,
  type GitCommitChangesSelector,
} from './git-commit-changes-quick-pick';

const input: GitCommitChangesInput = {
  resource: { repositoryRoot: '/repo', relativePath: 'main.ts' },
  commit: 'a'.repeat(40),
};

describe('GitCommitChangesQuickPick', () => {
  it('opens a single change without showing a picker', async () => {
    const change = createChange('main.ts');
    const select = vi.fn<GitCommitChangesSelector>();
    const open = vi
      .fn<(change: GitCommitChange) => Promise<void>>()
      .mockResolvedValue(undefined);
    const picker = new GitCommitChangesQuickPick(
      loader({ changes: [change] }),
      select,
      open,
    );

    await picker.show(input);

    expect(select).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(change);
  });

  it('opens only the selected change from a multi-file commit', async () => {
    const first = createChange('first.ts');
    const second = createChange('second.ts');
    const select = vi.fn<GitCommitChangesSelector>().mockResolvedValue(second);
    const open = vi
      .fn<(change: GitCommitChange) => Promise<void>>()
      .mockResolvedValue(undefined);
    const picker = new GitCommitChangesQuickPick(
      loader({ changes: [first, second] }),
      select,
      open,
    );

    await picker.show(input);

    expect(select).toHaveBeenCalledWith([first, second], expect.any(AbortSignal));
    expect(open).toHaveBeenCalledWith(second);
  });
});

function loader(result: GitCommitChangesResult): GitCommitChangesLoader {
  return vi.fn<GitCommitChangesLoader>().mockResolvedValue(result);
}

function createChange(path: string): GitCommitChange {
  return {
    status: 'modified',
    path,
    before: { resource: input.resource, ref: 'b'.repeat(40), path },
    after: { resource: input.resource, ref: input.commit, path },
  };
}
