import { describe, expect, it, vi } from 'vitest';
import type {
  GitCompareCommit,
  GitCompareHistoryPage,
} from '../../core/domains/git-compare/public-api';
import {
  GitCompareRevisionQuickPick,
  type GitCompareCommitSearcher,
  type GitCompareHistoryPageLoader,
  type GitCompareRevisionQuickPickItem,
  type GitCompareRevisionQuickPickView,
  type GitCompareRevisionResolver,
} from './git-compare-revision-quick-pick';

const head = commit('a', 'HEAD commit');
const older = commit('b', 'Older commit');
const resolved = commit('c', 'Resolved commit');

describe('GitCompareRevisionQuickPick', () => {
  it('selects an explicit base and defaults the target to HEAD', async () => {
    const view = new FakeQuickPickView();
    const quickPick = createQuickPick(
      view,
      vi.fn<GitCompareHistoryPageLoader>().mockResolvedValue(page([head, older])),
    );

    const selection = quickPick.show('/repo');
    await vi.waitFor(() => expect(view.items).toHaveLength(2));
    view.selectedItems = [requiredItem(view.items[1])];
    view.accept();

    expect(view.step).toBe(2);
    expect(view.activeItems[0]?.commit).toEqual(head);
    view.selectedItems = [];
    view.accept();

    await expect(selection).resolves.toEqual({ base: older, target: head });
    expect(view.isDisposed).toBe(true);
  });

  it('resolves a typed object id prefix and keeps the target step open for equal endpoints', async () => {
    const view = new FakeQuickPickView();
    const resolver = vi
      .fn<GitCompareRevisionResolver>()
      .mockResolvedValueOnce(resolved)
      .mockResolvedValueOnce(resolved);
    const reportError = vi.fn();
    const quickPick = createQuickPick(
      view,
      vi.fn<GitCompareHistoryPageLoader>().mockResolvedValue(page([head])),
      resolver,
      reportError,
    );

    const selection = quickPick.show('/repo');
    await vi.waitFor(() => expect(view.items).toHaveLength(1));
    view.changeValue('abc');
    view.accept();
    expect(resolver).not.toHaveBeenCalled();
    view.changeValue('cafe');
    view.selectedItems = [requiredItem(view.items[0])];
    view.accept();
    await vi.waitFor(() => expect(view.step).toBe(2));

    view.changeValue('cafe');
    view.selectedItems = [requiredItem(view.items[1])];
    view.accept();
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledWith('same'));
    expect(view.step).toBe(2);
    expect(view.isHidden).toBe(false);

    view.selectedItems = [
      requiredItem(view.items.find((item) => item.commit === head)),
    ];
    view.accept();
    await expect(selection).resolves.toEqual({ base: resolved, target: head });
    expect(resolver).toHaveBeenCalledWith(
      { repositoryRoot: '/repo', revision: 'cafe' },
      expect.any(AbortSignal),
    );
  });

  it('appends pages, returns to base selection and aborts a hidden session', async () => {
    const view = new FakeQuickPickView();
    let observedSignal: AbortSignal | undefined;
    const loader = vi
      .fn<GitCompareHistoryPageLoader>()
      .mockImplementationOnce((_, signal) => {
        observedSignal = signal;
        return Promise.resolve(page([head], 'next'));
      })
      .mockResolvedValueOnce(page([older]));
    const quickPick = createQuickPick(view, loader);

    const selection = quickPick.show('/repo');
    await vi.waitFor(() =>
      expect(view.items.map((item) => item.itemType)).toEqual(['commit', 'load-more']),
    );
    view.selectedItems = [requiredItem(view.items[1])];
    view.accept();
    await vi.waitFor(() => expect(view.items).toHaveLength(2));

    view.selectedItems = [requiredItem(view.items[1])];
    view.accept();
    expect(view.step).toBe(2);
    view.selectedItems = [requiredItem(view.items[0])];
    view.accept();
    expect(view.step).toBe(1);

    view.hide();
    await expect(selection).resolves.toBeUndefined();
    expect(observedSignal?.aborted).toBe(true);
  });
});

describe('GitCompareRevisionQuickPick 全 refs 搜索', () => {
  it('取消旧代请求且拒绝迟到结果覆盖', async () => {
    const view = new FakeQuickPickView();
    const first = deferred<{ matches: readonly [] }>();
    let firstSignal: AbortSignal | undefined;
    const branch = commit('d', 'Branch head');
    const searcher = vi
      .fn<GitCompareCommitSearcher>()
      .mockImplementationOnce((_, signal) => {
        firstSignal = signal;
        return first.promise;
      })
      .mockResolvedValueOnce({
        matches: [{ commit: branch, refs: ['origin/feature/search-node'] }],
      });
    const quickPick = createQuickPick(
      view,
      vi.fn<GitCompareHistoryPageLoader>().mockResolvedValue(page([head])),
      vi.fn(),
      vi.fn(),
      searcher,
    );

    const selection = quickPick.show('/repo');
    await vi.waitFor(() => expect(view.items).toHaveLength(1));
    view.changeValue('first query');
    await vi.waitFor(() => expect(searcher).toHaveBeenCalledTimes(1));
    view.changeValue('search-node');
    await vi.waitFor(() => expect(searcher).toHaveBeenCalledTimes(2));
    expect(firstSignal?.aborted).toBe(true);
    await vi.waitFor(() => expect(view.items[0]?.commit).toBe(branch));
    expect(view.items[0]?.itemType).toBe('commit');
    expect(view.items[0]?.alwaysShow).toBe(true);
    expect(view.items[0]?.description).toContain('origin/feature/search-node');

    first.resolve({ matches: [] });
    await Promise.resolve();
    expect(view.items[0]?.commit).toBe(branch);
    view.hide();
    await expect(selection).resolves.toBeUndefined();
  });
});

function createQuickPick(
  view: FakeQuickPickView,
  loader: GitCompareHistoryPageLoader,
  resolver: GitCompareRevisionResolver = vi.fn(),
  reportError: (message: unknown) => void = vi.fn(),
  searcher: GitCompareCommitSearcher = vi
    .fn<GitCompareCommitSearcher>()
    .mockResolvedValue({ matches: [] }),
): GitCompareRevisionQuickPick {
  return new GitCompareRevisionQuickPick(
    () => view,
    loader,
    resolver,
    searcher,
    {
      baseTitle: 'base',
      targetTitle: (base) => `target ${base.sha.slice(0, 8)}`,
      basePlaceholder: 'base placeholder',
      targetPlaceholder: 'target placeholder',
      loadMore: 'load more',
      back: 'back',
      useRevision: (revision) => `use ${revision}`,
      sameRevision: 'same',
    },
    reportError,
    1,
    0,
  );
}

function page(
  commits: readonly GitCompareCommit[],
  cursor?: string,
): GitCompareHistoryPage {
  return cursor === undefined
    ? { commits, complete: true }
    : { commits, complete: false, nextCursor: cursor };
}

function commit(character: string, subject: string): GitCompareCommit {
  return {
    sha: character.repeat(40),
    parents: [],
    author: 'Alice',
    authoredAt: Date.parse('2026-08-23T10:00:00+08:00'),
    subject,
  };
}

function requiredItem(
  item: GitCompareRevisionQuickPickItem | undefined,
): GitCompareRevisionQuickPickItem {
  if (item === undefined) throw new Error('测试预期 QuickPick item 存在。');
  return item;
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolve = (value: T): void => {
    void value;
  };
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

class FakeQuickPickView implements GitCompareRevisionQuickPickView {
  public title = '';
  public placeholder = '';
  public value = '';
  public step: number | undefined;
  public totalSteps: number | undefined;
  public items: readonly GitCompareRevisionQuickPickItem[] = [];
  public selectedItems: readonly GitCompareRevisionQuickPickItem[] = [];
  public activeItems: readonly GitCompareRevisionQuickPickItem[] = [];
  public busy = false;
  public matchOnDescription = false;
  public matchOnDetail = false;
  public isHidden = false;
  public isShown = false;
  public isDisposed = false;
  readonly #acceptListeners: (() => void)[] = [];
  readonly #hideListeners: (() => void)[] = [];
  readonly #valueListeners: ((value: string) => void)[] = [];

  public onDidAccept(listener: () => void): { dispose(): void } {
    this.#acceptListeners.push(listener);
    return disposable(this.#acceptListeners, listener);
  }

  public onDidHide(listener: () => void): { dispose(): void } {
    this.#hideListeners.push(listener);
    return disposable(this.#hideListeners, listener);
  }

  public onDidChangeValue(listener: (value: string) => void): { dispose(): void } {
    this.#valueListeners.push(listener);
    return disposable(this.#valueListeners, listener);
  }

  public changeValue(value: string): void {
    this.value = value;
    for (const listener of [...this.#valueListeners]) listener(value);
  }

  public accept(): void {
    for (const listener of [...this.#acceptListeners]) listener();
  }

  public show(): void {
    this.isShown = true;
  }

  public hide(): void {
    this.isHidden = true;
    for (const listener of [...this.#hideListeners]) listener();
  }

  public dispose(): void {
    this.isDisposed = true;
  }
}

function disposable<T>(listeners: T[], listener: T): { dispose(): void } {
  return {
    dispose: () => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
}
