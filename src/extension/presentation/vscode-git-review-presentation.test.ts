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
      onDidChangeSelection: vi.fn(() => ({ dispose: vi.fn() })),
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
    executeCommand: vi.fn(),
    showTextDocument: vi.fn(),
  };
});

vi.mock('vscode', () => {
  vscodeState.createTreeView.mockReturnValue(vscodeState.treeView);
  vscodeState.createStatusBarItem.mockReturnValue(vscodeState.statusBarItem);
  vscodeState.registerProvider.mockReturnValue(vscodeState.providerDisposable);
  vscodeState.executeCommand.mockResolvedValue(undefined);
  vscodeState.showTextDocument.mockResolvedValue(undefined);
  return {
    EventEmitter: vscodeState.EventEmitter,
    ThemeIcon: vscodeState.ThemeIcon,
    TreeItem: vscodeState.TreeItem,
    TreeItemCollapsibleState: { None: 0 },
    StatusBarAlignment: { Left: 1 },
    Uri: {
      parse: (value: string) => ({ toString: (): string => value }),
    },
    commands: { executeCommand: vscodeState.executeCommand },
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
      showTextDocument: vscodeState.showTextDocument,
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
  vscodeState.showTextDocument.mockResolvedValue(undefined);
});

describe('VS Code Git Review 投影', () => {
  it('仅在活动会话后创建投影，并通过公开 diff 命令打开文本项', async () => {
    const presentation = new VscodeGitReviewPresentation(
      vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    );
    const reviewItem = item('src/main.ts');

    presentation.render(activeSnapshot(reviewItem));
    await presentation.openItem(reviewItem, {
      kind: 'text',
      before: 'before',
      after: 'after',
    });

    expect(vscodeState.registerProvider).toHaveBeenCalledWith(
      'vscode-toolbox-namewta-git-review',
      expect.anything(),
    );
    expect(vscodeState.createTreeView).toHaveBeenCalledTimes(1);
    expect(vscodeState.createStatusBarItem).toHaveBeenCalledTimes(1);
    expect(vscodeState.executeCommand).toHaveBeenCalledTimes(1);
  });

  it('为特殊项打开只读摘要，并在 inactive 时清理全部 UI 资源', async () => {
    const presentation = new VscodeGitReviewPresentation(
      vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    );
    const reviewItem = item('binary.dat');

    presentation.render(activeSnapshot(reviewItem));
    await presentation.openItem(reviewItem, { kind: 'summary', reason: 'binary' });
    presentation.render({ state: 'inactive' });

    expect(vscodeState.showTextDocument).toHaveBeenCalledTimes(1);
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
      currentItemPath: item.path,
      items: [item],
      progress: { total: 1, reviewed: 0, skipped: 0, remaining: 1 },
    },
  };
}

function item(path: string): GitReviewItem {
  return {
    path,
    contentIdentity: 'a'.repeat(64),
    change: 'modified',
    presentation: 'text',
    reviewState: 'unreviewed',
  };
}
