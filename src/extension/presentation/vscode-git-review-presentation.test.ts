import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GitReviewItem,
  GitReviewSessionSnapshot,
} from '../../core/domains/git-review/public-api';
import { VscodeGitReviewPresentation } from './vscode-git-review-presentation';

const vscodeState = vi.hoisted(() => {
  class EventEmitter {
    public readonly event = vi.fn(() => ({ dispose: vi.fn() }));
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
    providerDisposable: { dispose: vi.fn() },
    treeView: {
      dispose: vi.fn(),
    },
    statusBarItem: {
      name: undefined as string | undefined,
      text: '',
      tooltip: undefined as string | undefined,
      accessibilityInformation: undefined as unknown,
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
    },
    createTreeView: vi.fn(),
    createStatusBarItem: vi.fn(),
    registerProvider: vi.fn(),
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
    executeCommand:
      vi.fn<(command: string, ...args: readonly unknown[]) => Promise<unknown>>(),
    showErrorMessage: vi.fn(),
  };
});

vi.mock('vscode', () => {
  vscodeState.createTreeView.mockReturnValue(vscodeState.treeView);
  vscodeState.createStatusBarItem.mockReturnValue(vscodeState.statusBarItem);
  vscodeState.registerProvider.mockReturnValue(vscodeState.providerDisposable);
  vscodeState.executeCommand.mockResolvedValue(undefined);
  return {
    EventEmitter: vscodeState.EventEmitter,
    ThemeIcon: vscodeState.ThemeIcon,
    TreeItem: vscodeState.TreeItem,
    TreeItemCollapsibleState: { None: 0 },
    StatusBarAlignment: { Left: 1 },
    Uri: {
      parse: (value: string) => ({ value, toString: (): string => value }),
      file: (value: string) => ({ value, toString: (): string => `file://${value}` }),
      joinPath: (base: { readonly value: string }, ...parts: readonly string[]) => ({
        value: [base.value, ...parts].join('/'),
        toString: (): string => `file://${[base.value, ...parts].join('/')}`,
      }),
    },
    commands: {
      executeCommand: vscodeState.executeCommand,
      registerCommand: vscodeState.registerCommand,
    },
    l10n: {
      t: (message: string, ...values: readonly unknown[]): string =>
        values.reduce<string>(
          (text, value, index) => text.replace(`{${String(index)}}`, String(value)),
          message,
        ),
    },
    window: {
      createStatusBarItem: vscodeState.createStatusBarItem,
      createTreeView: vscodeState.createTreeView,
      showErrorMessage: vscodeState.showErrorMessage,
    },
    workspace: {
      registerTextDocumentContentProvider: vscodeState.registerProvider,
    },
  };
});

beforeEach(() => {
  vscodeState.createTreeView.mockReturnValue(vscodeState.treeView);
  vscodeState.createStatusBarItem.mockReturnValue(vscodeState.statusBarItem);
  vscodeState.registerProvider.mockReturnValue(vscodeState.providerDisposable);
  vscodeState.executeCommand.mockResolvedValue(undefined);
});

describe('VS Code Git Review 投影', () => {
  it('仅在活动会话后创建投影，并通过公共 Changes 命令打开全部条目', () => {
    const presentation = new VscodeGitReviewPresentation(
      vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    );
    const reviewItem = item('src/main.ts');

    presentation.render(activeSnapshot(reviewItem));

    expect(vscodeState.registerProvider).toHaveBeenCalledWith(
      'vscode-toolbox-namewta-git-review',
      expect.anything(),
    );
    expect(vscodeState.createTreeView).toHaveBeenCalledTimes(1);
    expect(vscodeState.createStatusBarItem).toHaveBeenCalledTimes(1);
    expect(vscodeState.executeCommand).toHaveBeenCalledTimes(1);
    expect(vscodeState.executeCommand).toHaveBeenNthCalledWith(
      1,
      'vscode.changes',
      expect.stringContaining('Git Review'),
      expect.arrayContaining([
        expect.arrayContaining([
          expect.objectContaining({
            value: '/private/repository/unstaged/src/main.ts',
          }),
        ]),
      ]),
    );
  });

  it.each(['added', 'deleted'] as const)(
    '从队列打开 %s 文件时复用双侧受控文档 URI 调用公共单文件 Diff',
    async (change) => {
      const presentation = new VscodeGitReviewPresentation(
        vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      );
      const reviewItem = item('src/main.ts', change);

      presentation.render(activeSnapshot(reviewItem));
      await expect(presentation.openItemDiff(reviewItem)).resolves.toBe(true);

      const diffCall = vscodeState.executeCommand.mock.calls[1];
      const original = diffCall?.[1] as { readonly value: string };
      const modified = diffCall?.[2] as { readonly value: string };

      expect(diffCall?.[0]).toBe('vscode.diff');
      expect(original.value).toContain('/unstaged/src/main.ts');
      expect(modified.value).toContain('/unstaged/src/main.ts');
      expect(diffCall?.[3]).toEqual(expect.stringContaining('src/main.ts'));
    },
  );

  it('inactive 时清理全部原生 Review UI 资源', () => {
    const presentation = new VscodeGitReviewPresentation(
      vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    );
    presentation.render(activeSnapshot(item('binary.dat')));
    presentation.render({ state: 'inactive' });

    expect(vscodeState.providerDisposable.dispose).toHaveBeenCalledTimes(1);
    expect(vscodeState.treeView.dispose).toHaveBeenCalledTimes(1);
    expect(vscodeState.statusBarItem.dispose).toHaveBeenCalledTimes(1);
  });
});

function activeSnapshot(item: GitReviewItem): GitReviewSessionSnapshot {
  return {
    state: 'active',
    session: {
      repositoryRoot: '/private/repository',
      currentItemId: item.itemId,
      currentItemPath: item.path,
      items: [item],
      progress: { total: 1, reviewed: 0, skipped: 0, remaining: 1 },
    },
  };
}

function item(
  path: string,
  change: GitReviewItem['change'] = 'modified',
): GitReviewItem {
  return {
    itemId: `unstaged:${path}`,
    layer: 'unstaged',
    path,
    contentIdentity: 'a'.repeat(64),
    change,
    presentation: 'text',
    reviewState: 'unreviewed',
  };
}
