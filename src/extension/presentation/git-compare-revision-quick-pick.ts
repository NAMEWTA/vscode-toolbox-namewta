import type {
  GitCompareCommit,
  GitCompareSearchMatch,
} from '../../core/domains/git-compare/public-api';
import type {
  GitCompareHistoryPageLoader,
  GitCompareCommitSearcher,
  GitCompareRevisionQuickPickLabels,
  GitCompareRevisionQuickPickView,
  GitCompareRevisionResolver,
  GitCompareRevisionSelection,
} from './git-compare-revision-quick-pick-contract';
import {
  activateGitCompareTypedRevision,
  createGitCompareRevisionItems,
} from './git-compare-revision-quick-pick-items';
import {
  cancelGitCompareRevisionSearch,
  scheduleGitCompareRevisionSearch,
} from './git-compare-revision-search';

export type {
  GitCompareCommitSearcher,
  GitCompareHistoryPageLoader,
  GitCompareRevisionQuickPickItem,
  GitCompareRevisionQuickPickLabels,
  GitCompareRevisionQuickPickView,
  GitCompareRevisionResolver,
  GitCompareRevisionSelection,
} from './git-compare-revision-quick-pick-contract';

type QuickPickSession = {
  readonly view: GitCompareRevisionQuickPickView;
  readonly repositoryRoot: string;
  readonly controller: AbortController;
  readonly commits: GitCompareCommit[];
  searchMatches: readonly GitCompareSearchMatch[];
  readonly subscriptions: { dispose(): void }[];
  readonly resolve: (selection: GitCompareRevisionSelection | undefined) => void;
  step: 'base' | 'target';
  base: GitCompareCommit | undefined;
  cursor: string | undefined;
  complete: boolean;
  isPageLoading: boolean;
  isResolveLoading: boolean;
  isSearching: boolean;
  searchGeneration: number;
  searchController: AbortController | undefined;
  searchTimer: ReturnType<typeof setTimeout> | undefined;
  isDisposed: boolean;
  isSettled: boolean;
};

export class GitCompareRevisionQuickPick {
  #active: QuickPickSession | undefined;

  public constructor(
    private readonly createView: () => GitCompareRevisionQuickPickView,
    private readonly loadPage: GitCompareHistoryPageLoader,
    private readonly resolveRevision: GitCompareRevisionResolver,
    private readonly searchCommits: GitCompareCommitSearcher,
    private readonly labels: GitCompareRevisionQuickPickLabels,
    private readonly reportError: (error: unknown) => void,
    private readonly pageSize = 50,
    private readonly searchDelayMs = 180,
  ) {}

  public show(
    repositoryRoot: string,
  ): Promise<GitCompareRevisionSelection | undefined> {
    this.closeActive();
    const view = this.createView();
    let settle: (selection: GitCompareRevisionSelection | undefined) => void = () =>
      undefined;
    const completion = new Promise<GitCompareRevisionSelection | undefined>(
      (resolve) => {
        settle = resolve;
      },
    );
    const session: QuickPickSession = {
      view,
      repositoryRoot,
      controller: new AbortController(),
      commits: [],
      searchMatches: [],
      subscriptions: [],
      resolve: settle,
      step: 'base',
      base: undefined,
      cursor: undefined,
      complete: false,
      isPageLoading: false,
      isResolveLoading: false,
      isSearching: false,
      searchGeneration: 0,
      searchController: undefined,
      searchTimer: undefined,
      isDisposed: false,
      isSettled: false,
    };
    this.#active = session;
    session.subscriptions.push(
      view.onDidAccept(() => this.handleAccept(session)),
      view.onDidHide(() => this.release(session)),
      view.onDidChangeValue((value) =>
        scheduleGitCompareRevisionSearch(
          session,
          value,
          this.searchCommits,
          this.pageSize,
          this.searchDelayMs,
          this.createSearchCallbacks(session),
        ),
      ),
    );
    view.matchOnDescription = true;
    view.matchOnDetail = true;
    this.render(session);
    view.show();
    void this.loadNextPage(session);
    return completion;
  }

  public dispose(): void {
    this.closeActive();
  }

  public cancel(): void {
    this.closeActive();
  }

  private handleAccept(session: QuickPickSession): void {
    const selected = session.view.selectedItems[0] ?? session.view.activeItems[0];
    if (selected === undefined) return;
    switch (selected.itemType) {
      case 'load-more':
        void this.loadNextPage(session);
        return;
      case 'back':
        this.returnToBase(session);
        return;
      case 'resolve':
        if (selected.revision !== undefined) {
          void this.resolveSelectedRevision(session, selected.revision);
        }
        return;
      case 'commit':
        if (selected.commit !== undefined) this.selectCommit(session, selected.commit);
    }
  }

  private selectCommit(session: QuickPickSession, commit: GitCompareCommit): void {
    if (session.step === 'base') {
      this.cancelSearch(session);
      session.searchMatches = [];
      session.base = commit;
      session.step = 'target';
      session.view.value = '';
      session.view.selectedItems = [];
      this.render(session);
      const head = session.commits[0];
      const headItem = session.view.items.find(
        (item) => item.commit?.sha === head?.sha,
      );
      session.view.activeItems = headItem === undefined ? [] : [headItem];
      return;
    }
    const base = session.base;
    if (base === undefined) {
      this.returnToBase(session);
      return;
    }
    if (base.sha.toLowerCase() === commit.sha.toLowerCase()) {
      this.reportError(this.labels.sameRevision);
      this.cancelSearch(session);
      session.searchMatches = [];
      session.view.value = '';
      session.view.selectedItems = [];
      this.render(session);
      return;
    }
    this.finish(session, { base, target: commit });
  }

  private async resolveSelectedRevision(
    session: QuickPickSession,
    revision: string,
  ): Promise<void> {
    if (session.isResolveLoading || !this.isActive(session)) return;
    session.isResolveLoading = true;
    this.updateBusy(session);
    try {
      const commit = await this.resolveRevision(
        { repositoryRoot: session.repositoryRoot, revision },
        session.controller.signal,
      );
      if (this.isActive(session)) this.selectCommit(session, commit);
    } catch (error: unknown) {
      if (shouldReportError(session, this.isActive(session))) this.reportError(error);
    } finally {
      session.isResolveLoading = false;
      this.updateBusy(session);
    }
  }

  private async loadNextPage(session: QuickPickSession): Promise<void> {
    if (!canLoad(session)) return;
    session.isPageLoading = true;
    this.updateBusy(session);
    try {
      const page = await this.loadPage(
        {
          repositoryRoot: session.repositoryRoot,
          limit: this.pageSize,
          ...(session.cursor === undefined ? {} : { cursor: session.cursor }),
        },
        session.controller.signal,
      );
      if (!this.isActive(session)) return;
      session.commits.push(...page.commits);
      session.cursor = page.nextCursor;
      session.complete = page.complete || page.nextCursor === undefined;
      this.render(session);
    } catch (error: unknown) {
      if (shouldReportError(session, this.isActive(session))) this.reportError(error);
    } finally {
      session.isPageLoading = false;
      this.updateBusy(session);
    }
  }

  private render(session: QuickPickSession): void {
    if (!this.isActive(session)) return;
    const view = session.view;
    this.configureStep(session);
    const revision = view.value.trim();
    const items = createGitCompareRevisionItems({
      step: session.step,
      revision,
      commits: session.commits,
      searchMatches: session.searchMatches,
      complete: session.complete,
      labels: this.labels,
    });
    view.items = items;
    if (revision.length > 0) activateGitCompareTypedRevision(view, items);
  }

  private configureStep(session: QuickPickSession): void {
    const { base, step, view } = session;
    view.step = step === 'base' ? 1 : 2;
    view.totalSteps = 2;
    view.title =
      step === 'base' || base === undefined
        ? this.labels.baseTitle
        : this.labels.targetTitle(base);
    view.placeholder =
      step === 'base' ? this.labels.basePlaceholder : this.labels.targetPlaceholder;
  }

  private returnToBase(session: QuickPickSession): void {
    this.cancelSearch(session);
    session.searchMatches = [];
    session.step = 'base';
    session.base = undefined;
    session.view.value = '';
    session.view.selectedItems = [];
    session.view.activeItems = [];
    this.render(session);
  }

  private finish(
    session: QuickPickSession,
    selection: GitCompareRevisionSelection,
  ): void {
    if (session.isSettled) return;
    session.isSettled = true;
    session.resolve(selection);
    session.view.hide();
    this.release(session);
  }

  private isActive(session: QuickPickSession): boolean {
    return this.#active === session && !session.isDisposed;
  }

  private closeActive(): void {
    const session = this.#active;
    if (session === undefined) return;
    session.view.hide();
    this.release(session);
  }

  private release(session: QuickPickSession): void {
    if (session.isDisposed) return;
    session.isDisposed = true;
    session.controller.abort();
    this.cancelSearch(session);
    for (const subscription of session.subscriptions.splice(0)) {
      subscription.dispose();
    }
    session.view.dispose();
    if (!session.isSettled) {
      session.isSettled = true;
      session.resolve(undefined);
    }
    if (this.#active === session) this.#active = undefined;
  }

  private cancelSearch(session: QuickPickSession): void {
    cancelGitCompareRevisionSearch(session, () => this.updateBusy(session));
  }

  private createSearchCallbacks(session: QuickPickSession): {
    readonly isActive: () => boolean;
    readonly render: () => void;
    readonly updateBusy: () => void;
    readonly reportError: (error: unknown) => void;
  } {
    return {
      isActive: () => this.isActive(session),
      render: () => this.render(session),
      updateBusy: () => this.updateBusy(session),
      reportError: (error) => this.reportError(error),
    };
  }

  private updateBusy(session: QuickPickSession): void {
    if (!this.isActive(session)) return;
    session.view.busy =
      session.isPageLoading || session.isResolveLoading || session.isSearching;
  }
}

function canLoad(session: QuickPickSession): boolean {
  return !session.isDisposed && !session.isPageLoading && !session.complete;
}

function shouldReportError(session: QuickPickSession, isActive: boolean): boolean {
  return !session.controller.signal.aborted && isActive;
}
