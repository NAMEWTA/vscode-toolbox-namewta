import { describe, expect, it, vi } from 'vitest';
import type {
  GitLineHistoryEntry,
  GitLineHistoryInput,
  GitLineHistoryPage,
} from '../../core/domains/git-blame/public-api';
import {
  GitLineHistoryQuickPick,
  type GitLineHistoryPageLoader,
  type GitLineHistoryQuickPickItem,
  type GitLineHistoryQuickPickView,
} from './git-line-history-quick-pick';

const firstCommit = 'a'.repeat(40);
const secondCommit = 'b'.repeat(40);
const input: Omit<GitLineHistoryInput, 'limit' | 'cursor'> = {
  resource: { repositoryRoot: '/repo', relativePath: 'main.ts' },
  ref: 'HEAD',
  path: 'main.ts',
  line: 7,
};

describe('GitLineHistoryQuickPick', () => {
  it('appends an explicitly requested page without replacing prior entries', async () => {
    const view = new FakeQuickPickView();
    const loader = vi
      .fn<GitLineHistoryPageLoader>()
      .mockResolvedValueOnce(page([entry(secondCommit)], 'next'))
      .mockResolvedValueOnce(page([entry(firstCommit)], undefined));
    const quickPick = createQuickPick(view, loader);

    await quickPick.show(input);
    expect(view.items.map((item) => item.itemType)).toEqual(['entry', 'load-more']);

    view.selectedItems = [requiredItem(view.items[1])];
    view.accept();
    await vi.waitFor(() => {
      expect(view.items.map((item) => item.itemType)).toEqual(['entry', 'entry']);
    });
    expect(view.items[0]?.entry?.commit).toBe(secondCommit);
    expect(view.items[1]?.entry?.commit).toBe(firstCommit);
  });

  it('aborts loading and ignores a delayed page after the view is hidden', async () => {
    const view = new FakeQuickPickView();
    let resolvePage: ((value: GitLineHistoryPage) => void) | undefined;
    let observedSignal: AbortSignal | undefined;
    const loader = vi.fn<GitLineHistoryPageLoader>((_input, signal) => {
      observedSignal = signal;
      return new Promise((resolve) => {
        resolvePage = resolve;
      });
    });
    const quickPick = createQuickPick(view, loader);

    const loading = quickPick.show(input);
    view.hide();
    resolvePage?.(page([entry(secondCommit)], undefined));
    await loading;

    expect(observedSignal?.aborted).toBe(true);
    expect(view.items).toEqual([]);
    expect(view.isDisposed).toBe(true);
  });

  it('opens the selected entry and closes the picker', async () => {
    const view = new FakeQuickPickView();
    const selected = entry(secondCommit);
    const openEntry = vi
      .fn<(entry: GitLineHistoryEntry) => Promise<void>>()
      .mockResolvedValue(undefined);
    const quickPick = createQuickPick(
      view,
      vi.fn<GitLineHistoryPageLoader>().mockResolvedValue(page([selected], undefined)),
      openEntry,
    );
    await quickPick.show(input);

    view.selectedItems = [requiredItem(view.items[0])];
    view.accept();
    await vi.waitFor(() => expect(openEntry).toHaveBeenCalledWith(selected, input));

    expect(view.isHidden).toBe(true);
  });
});

function createQuickPick(
  view: FakeQuickPickView,
  loader: GitLineHistoryPageLoader,
  openEntry: (
    entry: GitLineHistoryEntry,
    input: Omit<GitLineHistoryInput, 'limit' | 'cursor'>,
  ) => Promise<void> = vi.fn(),
): GitLineHistoryQuickPick {
  return new GitLineHistoryQuickPick(
    () => view,
    loader,
    openEntry,
    { emptyLine: '(empty line)', loadMore: 'Load more...' },
    vi.fn(),
    1,
  );
}

function page(
  entries: readonly GitLineHistoryEntry[],
  cursor: string | undefined,
): GitLineHistoryPage {
  return cursor === undefined
    ? { entries, complete: true }
    : { entries, complete: false, nextCursor: cursor };
}

function entry(commit: string): GitLineHistoryEntry {
  return {
    changeType: commit === firstCommit ? 'added' : 'modified',
    path: 'main.ts',
    line: 7,
    commit,
    parentCommit: commit === firstCommit ? '0'.repeat(40) : firstCommit,
    author: 'Alice',
    authoredAt: 1_700_000_000,
    summary: 'change line',
    lineText: 'const value = 1;',
  };
}

function requiredItem(
  item: GitLineHistoryQuickPickItem | undefined,
): GitLineHistoryQuickPickItem {
  if (item === undefined) {
    throw new Error('测试预期 QuickPick item 存在。');
  }
  return item;
}

class FakeQuickPickView implements GitLineHistoryQuickPickView {
  public items: readonly GitLineHistoryQuickPickItem[] = [];
  public selectedItems: readonly GitLineHistoryQuickPickItem[] = [];
  public activeItems: readonly GitLineHistoryQuickPickItem[] = [];
  public busy = false;
  public matchOnDescription = false;
  public matchOnDetail = false;
  public isHidden = false;
  public isShown = false;
  public isDisposed = false;
  readonly #acceptListeners: (() => void)[] = [];
  readonly #hideListeners: (() => void)[] = [];

  public onDidAccept(listener: () => void): { dispose(): void } {
    this.#acceptListeners.push(listener);
    return disposable(this.#acceptListeners, listener);
  }

  public onDidHide(listener: () => void): { dispose(): void } {
    this.#hideListeners.push(listener);
    return disposable(this.#hideListeners, listener);
  }

  public accept(): void {
    for (const listener of [...this.#acceptListeners]) {
      listener();
    }
  }

  public show(): void {
    this.isShown = true;
  }

  public hide(): void {
    this.isHidden = true;
    for (const listener of [...this.#hideListeners]) {
      listener();
    }
  }

  public dispose(): void {
    this.isDisposed = true;
  }
}

function disposable(
  listeners: (() => void)[],
  listener: () => void,
): {
  dispose(): void;
} {
  return {
    dispose: () => {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    },
  };
}
