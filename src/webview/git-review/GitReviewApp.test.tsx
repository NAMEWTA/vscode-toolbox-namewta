// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  GitReviewSessionSnapshot,
  GitReviewWebviewStrings,
} from '../../core/contracts';
import type { ToolMessageClient } from '../platform/webview-message-client';
import { GitReviewApp } from './GitReviewApp';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { readonly count: number }) => ({
    getTotalSize: (): number => count * 320,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 320,
      })),
    measureElement: vi.fn(),
    scrollToIndex: vi.fn(),
  }),
}));

describe('GitReviewApp', () => {
  it('renders all file patches and exposes icon actions', async () => {
    const execute = vi.fn<ToolMessageClient['execute']>().mockResolvedValue({
      ok: true,
      data: {
        kind: 'patch',
        additions: 1,
        deletions: 1,
        hunks: [
          {
            header: '@@ -1 +1 @@',
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 1,
            lines: [
              { kind: 'deletion', oldLine: 1, text: 'old' },
              { kind: 'addition', newLine: 1, text: 'next' },
            ],
          },
        ],
      },
    });
    const postAction = vi.fn();

    render(
      <GitReviewApp
        client={{ execute }}
        initialSnapshot={snapshot}
        strings={strings}
        postAction={postAction}
      />,
    );

    await expect(screen.findByText('next')).resolves.toBeInTheDocument();
    expect(screen.getByText('src/main.ts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stage' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy reference' }));
    expect(postAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'gitReview.action',
        action: 'copy-reference',
        itemId: 'unstaged:src/main.ts',
      }),
    );
  });
});

const snapshot: GitReviewSessionSnapshot = {
  state: 'active',
  session: {
    repositoryRoot: '/repository',
    currentItemId: 'unstaged:src/main.ts',
    currentItemPath: 'src/main.ts',
    items: [
      {
        itemId: 'unstaged:src/main.ts',
        layer: 'unstaged',
        path: 'src/main.ts',
        contentIdentity: 'a'.repeat(64),
        change: 'modified',
        presentation: 'text',
        reviewState: 'unreviewed',
      },
    ],
    progress: { total: 1, reviewed: 0, skipped: 0, remaining: 1 },
  },
};

const strings: GitReviewWebviewStrings = {
  title: 'Git Review',
  conflict: 'Conflicts',
  staged: 'Staged',
  unstaged: 'Changes',
  stage: 'Stage',
  unstage: 'Unstage',
  discard: 'Discard',
  openFile: 'Open file',
  openDiff: 'Open diff',
  copyReference: 'Copy reference',
  markReviewed: 'Mark reviewed',
  skip: 'Skip',
  mergeChanges: 'Merge changes',
  loading: 'Loading',
  retry: 'Retry',
  binary: 'Binary',
  submodule: 'Submodule',
  tooLarge: 'Too large',
  unavailable: 'Unavailable',
  noChanges: 'No changes',
  refreshRequired: 'Refresh required',
  additions: 'additions',
  deletions: 'deletions',
};
