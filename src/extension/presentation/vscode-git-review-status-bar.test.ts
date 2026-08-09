import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GitReviewItem,
  GitReviewSessionSnapshot,
} from '../../core/domains/git-review/public-api';
import { VscodeGitReviewStatusBar } from './vscode-git-review-status-bar';

const vscodeState = vi.hoisted(() => ({
  item: {
    name: undefined as string | undefined,
    text: '',
    tooltip: undefined as string | undefined,
    accessibilityInformation: undefined as unknown,
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  },
  createStatusBarItem: vi.fn(),
}));

vi.mock('vscode', () => ({
  StatusBarAlignment: { Left: 1 },
  l10n: {
    t: (message: string, ...values: readonly unknown[]): string =>
      values.reduce<string>(
        (text, value, index) => text.replace(`{${String(index)}}`, String(value)),
        message,
      ),
  },
  window: { createStatusBarItem: vscodeState.createStatusBarItem },
}));

beforeEach(() => {
  vscodeState.createStatusBarItem.mockReturnValue(vscodeState.item);
  vscodeState.item.name = undefined;
  vscodeState.item.text = '';
  vscodeState.item.tooltip = undefined;
  vscodeState.item.accessibilityInformation = undefined;
});

describe('VS Code Git Review 状态栏', () => {
  it('展示与队列相同的进度、stale 状态和可访问标签', () => {
    const statusBar = new VscodeGitReviewStatusBar();
    statusBar.render(snapshot('active'));

    expect(vscodeState.item.name).toBe('Git Review progress');
    expect(vscodeState.item.text).toBe('Git Review: 2/3, 1 remaining');
    expect(vscodeState.item.tooltip).toBe(
      'Git Review: 1 reviewed, 1 skipped, 1 remaining',
    );
    expect(vscodeState.item.accessibilityInformation).toEqual({
      label: 'Git Review: 2/3, 1 remaining',
    });

    statusBar.render(snapshot('stale'));

    expect(vscodeState.item.text).toBe(
      'Git Review: 2/3, 1 remaining - Refresh required',
    );
    expect(vscodeState.item.show).toHaveBeenCalledTimes(2);
  });

  it('在非活动状态隐藏并释放状态栏资源', () => {
    const statusBar = new VscodeGitReviewStatusBar();

    statusBar.render({ state: 'inactive' });
    statusBar.dispose();

    expect(vscodeState.item.hide).toHaveBeenCalledTimes(1);
    expect(vscodeState.item.dispose).toHaveBeenCalledTimes(1);
  });
});

function snapshot(
  state: Extract<GitReviewSessionSnapshot['state'], 'active' | 'stale'>,
): GitReviewSessionSnapshot {
  return {
    state,
    session: {
      repositoryRoot: '/private/repository',
      currentItemPath: 'src/second.ts',
      items: [
        item('src/first.ts', 'reviewed'),
        item('src/second.ts', 'unreviewed'),
        item('src/third.ts', 'skipped'),
      ],
      progress: { total: 3, reviewed: 1, skipped: 1, remaining: 1 },
    },
  };
}

function item(
  path: string,
  reviewState: 'reviewed' | 'unreviewed' | 'skipped',
): GitReviewItem {
  return {
    path,
    contentIdentity: `${path.length}`.padStart(64, '0'),
    change: 'modified' as const,
    presentation: 'text' as const,
    reviewState,
  };
}
