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
    public command: unknown;

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
    registerCommand: vi.fn(),
    commandDisposable: { dispose: vi.fn() },
    treeView: {
      reveal: vi.fn(),
      dispose: vi.fn(),
    },
  };
});

vi.mock('vscode', () => ({
  EventEmitter: vscodeState.EventEmitter,
  ThemeIcon: vscodeState.ThemeIcon,
  TreeItem: vscodeState.TreeItem,
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  commands: { registerCommand: vscodeState.registerCommand },
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
  vscodeState.registerCommand.mockReturnValue(vscodeState.commandDisposable);
});

describe('VS Code Git Review 队列树', () => {
  it('按变更层和目录投影文件，并保留状态、可访问标签与控制字符转义', () => {
    const queue = new VscodeGitReviewQueueTree(
      vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    );
    const current = item('unstaged', 'src/feature/\ncurrent.ts', 'unreviewed');
    const skipped = item('unstaged', 'src/feature/skipped.ts', 'skipped');
    const staged = item('staged', 'README.md', 'reviewed');

    queue.render(activeSnapshot(current.itemId, [current, skipped, staged]));
    const roots = queue.getChildren();
    const stagedRoot = roots[0]!;
    const unstagedRoot = roots[1]!;
    const stagedFile = queue.getChildren(stagedRoot)[0]!;
    const directory = queue.getChildren(unstagedRoot)[0]!;
    const entries = queue.getChildren(directory);
    const treeItem = queue.getTreeItem(entries[0]!);

    expect(vscodeState.createTreeView).toHaveBeenCalledWith(
      'vscodeToolboxNamewta.gitReview.queue',
      expect.objectContaining({ treeDataProvider: queue, showCollapseAll: true }),
    );
    expect(roots.map((entry) => queue.getTreeItem(entry).label)).toEqual([
      'Staged',
      'Unstaged',
    ]);
    expect(queue.getTreeItem(stagedFile).label).toBe('README.md');
    expect(queue.getTreeItem(directory).label).toBe('src/feature');
    expect(treeItem.label).toBe('\\u000acurrent.ts');
    expect(treeItem.description).toBe('Current - Unreviewed');
    expect(treeItem.contextValue).toBe('gitReview.unstaged');
    expect(treeItem.accessibilityInformation).toEqual({
      label: 'Current, src/feature/\\u000acurrent.ts, Unreviewed',
    });
    expect(queue.getTreeItem(entries[1]!).description).toBe('Skipped');
    expect(queue.getParent(entries[0]!)).toBe(directory);
    expect(queue.getParent(directory)).toBe(unstagedRoot);
  });

  it('只在活动会话中将文件叶节点转为导航请求，并在释放时清理资源', async () => {
    const onSelect = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const queue = new VscodeGitReviewQueueTree(onSelect);
    const current = item('unstaged', 'src/current.ts', 'unreviewed');
    const target = item('unstaged', 'src/target.ts', 'reviewed');
    queue.render(activeSnapshot(current.itemId, [current, target]));
    const layer = queue.getChildren()[0]!;
    const directory = queue.getChildren(layer)[0]!;
    const entries = queue.getChildren(directory);
    const command = vscodeState.registerCommand.mock.calls[0]?.[1] as
      | ((item: unknown) => void)
      | undefined;

    expect(queue.getTreeItem(directory).command).toBeUndefined();
    expect(queue.getTreeItem(entries[1]!).command).toEqual(
      expect.objectContaining({
        command: 'vscodeToolboxNamewta.gitReview.openQueueItemDiff',
        arguments: [target],
      }),
    );
    command?.(directory);
    command?.(target);
    await Promise.resolve();
    queue.render({
      state: 'stale',
      session: activeSnapshot(current.itemId, [current, target]).session,
    });
    command?.(target);
    await Promise.resolve();
    queue.dispose();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(target);
    expect(vscodeState.commandDisposable.dispose).toHaveBeenCalledTimes(1);
    expect(vscodeState.treeView.dispose).toHaveBeenCalledTimes(1);
  });
});

function activeSnapshot(
  currentItemId: string,
  items: readonly GitReviewItem[],
): ActiveGitReviewSessionSnapshot {
  return {
    state: 'active',
    session: {
      repositoryRoot: '/private/repository',
      currentItemId,
      currentItemPath:
        items.find((candidate) => candidate.itemId === currentItemId)?.path ?? '',
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

function item(
  layer: GitReviewItem['layer'],
  path: string,
  reviewState: GitReviewItem['reviewState'],
): GitReviewItem {
  return {
    itemId: `${layer}:${path}`,
    layer,
    path,
    contentIdentity: `${path.length}`.padStart(64, '0'),
    change: 'modified',
    presentation: 'text',
    reviewState,
  };
}
