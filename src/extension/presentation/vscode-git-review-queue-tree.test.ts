import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GitReviewItem,
  GitReviewSession,
} from '../../core/domains/git-review/public-api';
import { VscodeGitReviewQueueTree } from './vscode-git-review-queue-tree';

type ActiveGitReviewSessionSnapshot = {
  readonly state: 'active';
  readonly session: GitReviewSession;
};

const vscodeState = vi.hoisted(() => {
  class EventEmitter {
    public readonly event = vi.fn();
    public readonly fire = vi.fn();
    public readonly dispose = vi.fn();
  }

  class TreeItem {
    public id: string | undefined;
    public description: string | undefined;
    public tooltip: string | undefined;
    public iconPath: unknown;
    public contextValue: string | undefined;
    public accessibilityInformation: unknown;

    public constructor(
      public readonly label: string,
      public readonly collapsibleState: number,
    ) {}
  }

  class ThemeIcon {
    public constructor(public readonly id: string) {}
  }

  return {
    EventEmitter,
    TreeItem,
    ThemeIcon,
    createTreeView: vi.fn(),
    selectionDisposable: { dispose: vi.fn() },
    treeView: {
      onDidChangeSelection: vi.fn(),
      dispose: vi.fn(),
    },
  };
});

vi.mock('vscode', () => ({
  EventEmitter: vscodeState.EventEmitter,
  ThemeIcon: vscodeState.ThemeIcon,
  TreeItem: vscodeState.TreeItem,
  TreeItemCollapsibleState: { None: 0 },
  l10n: {
    t: (message: string, ...values: readonly unknown[]): string =>
      values.reduce<string>(
        (text, value, index) => text.replace(`{${String(index)}}`, String(value)),
        message,
      ),
  },
  window: { createTreeView: vscodeState.createTreeView },
}));

beforeEach(() => {
  vscodeState.createTreeView.mockReturnValue(vscodeState.treeView);
  vscodeState.treeView.onDidChangeSelection.mockReturnValue(
    vscodeState.selectionDisposable,
  );
});

describe('VS Code Git Review 队列树', () => {
  it('投影当前条目、处理状态和可访问标签，并转义控制字符路径', () => {
    const queue = new VscodeGitReviewQueueTree(
      vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    );
    const current = item('src/\ncurrent.ts', 'unreviewed');
    const skipped = item('src/skipped.ts', 'skipped');

    queue.render(activeSnapshot(current.path, [current, skipped]));
    const entries = queue.getChildren();
    const treeItem = queue.getTreeItem(entries[0]!);

    expect(vscodeState.createTreeView).toHaveBeenCalledWith(
      'vscodeToolboxNamewta.gitReview.queue',
      expect.objectContaining({ treeDataProvider: queue }),
    );
    expect(treeItem.label).toBe('src/\\u000acurrent.ts');
    expect(treeItem.description).toBe('Current - Unreviewed');
    expect(treeItem.accessibilityInformation).toEqual({
      label: 'Current, src/\\u000acurrent.ts, Unreviewed',
    });
    expect(queue.getTreeItem(entries[1]!).description).toBe('Skipped');
  });

  it('只在活动会话中将键盘选择转为普通导航请求，并在释放时清理资源', async () => {
    const onSelect = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const queue = new VscodeGitReviewQueueTree(onSelect);
    const current = item('src/current.ts', 'unreviewed');
    const target = item('src/target.ts', 'reviewed');
    queue.render(activeSnapshot(current.path, [current, target]));
    const entries = queue.getChildren();
    const listener = vscodeState.treeView.onDidChangeSelection.mock.calls[0]?.[0] as
      | ((event: { readonly selection: readonly (typeof entries)[number][] }) => void)
      | undefined;

    listener?.({ selection: [entries[1]!] });
    await Promise.resolve();
    queue.render({
      state: 'stale',
      session: activeSnapshot(current.path, [current, target]).session,
    });
    listener?.({ selection: [entries[1]!] });
    await Promise.resolve();
    queue.dispose();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(target);
    expect(vscodeState.selectionDisposable.dispose).toHaveBeenCalledTimes(1);
    expect(vscodeState.treeView.dispose).toHaveBeenCalledTimes(1);
  });
});

function activeSnapshot(
  currentItemPath: string,
  items: readonly GitReviewItem[],
): ActiveGitReviewSessionSnapshot {
  return {
    state: 'active',
    session: {
      repositoryRoot: '/private/repository',
      currentItemId:
        items.find((candidate) => candidate.path === currentItemPath)?.itemId ?? '',
      currentItemPath,
      items,
      progress: {
        total: items.length,
        reviewed: 0,
        skipped: 0,
        remaining: items.length,
      },
    },
  };
}

function item(path: string, reviewState: GitReviewItem['reviewState']): GitReviewItem {
  return {
    itemId: `unstaged:${path}`,
    layer: 'unstaged',
    path,
    contentIdentity: `${path.length}`.padStart(64, '0'),
    change: 'modified',
    presentation: 'text',
    reviewState,
  };
}
