import type {
  GitLineHistoryEntry,
  GitLineHistoryInput,
  GitLineHistoryPage,
} from '../../core/domains/git-blame/public-api';

export type GitLineHistoryStartInput = Omit<GitLineHistoryInput, 'limit' | 'cursor'>;

export type GitLineHistoryQuickPickItem = {
  readonly itemType: 'entry' | 'load-more';
  readonly label: string;
  readonly description?: string;
  readonly detail?: string;
  readonly alwaysShow?: boolean;
  readonly entry?: GitLineHistoryEntry;
};

export type GitLineHistoryQuickPickView = {
  items: readonly GitLineHistoryQuickPickItem[];
  selectedItems: readonly GitLineHistoryQuickPickItem[];
  activeItems: readonly GitLineHistoryQuickPickItem[];
  busy: boolean;
  matchOnDescription: boolean;
  matchOnDetail: boolean;
  onDidAccept(listener: () => void): { dispose(): void };
  onDidHide(listener: () => void): { dispose(): void };
  show(): void;
  hide(): void;
  dispose(): void;
};

export type GitLineHistoryPageLoader = (
  input: GitLineHistoryInput,
  signal: AbortSignal,
) => Promise<GitLineHistoryPage>;

export type GitLineHistoryEntryOpener = (
  entry: GitLineHistoryEntry,
  input: GitLineHistoryStartInput,
) => Promise<void>;

type GitLineHistoryLabels = {
  readonly emptyLine: string;
  readonly loadMore: string;
};

type QuickPickSession = {
  readonly view: GitLineHistoryQuickPickView;
  readonly controller: AbortController;
  readonly input: GitLineHistoryStartInput;
  readonly entries: GitLineHistoryEntry[];
  readonly subscriptions: { dispose(): void }[];
  cursor: string | undefined;
  complete: boolean;
  isLoading: boolean;
  isDisposed: boolean;
};

export class GitLineHistoryQuickPick {
  #active: QuickPickSession | undefined;

  public constructor(
    private readonly createView: () => GitLineHistoryQuickPickView,
    private readonly loadPage: GitLineHistoryPageLoader,
    private readonly openEntry: GitLineHistoryEntryOpener,
    private readonly labels: GitLineHistoryLabels,
    private readonly reportError: (error: unknown) => void,
    private readonly pageSize = 20,
  ) {}

  public async show(input: GitLineHistoryStartInput): Promise<void> {
    this.closeActive();
    const view = this.createView();
    const session: QuickPickSession = {
      view,
      controller: new AbortController(),
      input,
      entries: [],
      subscriptions: [],
      cursor: undefined,
      complete: false,
      isLoading: false,
      isDisposed: false,
    };
    this.#active = session;
    session.subscriptions.push(
      view.onDidAccept(() => this.handleAccept(session)),
      view.onDidHide(() => this.release(session)),
    );
    view.matchOnDescription = true;
    view.matchOnDetail = true;
    view.show();
    await this.loadNextPage(session);
  }

  public dispose(): void {
    this.closeActive();
  }

  private handleAccept(session: QuickPickSession): void {
    const selected = session.view.selectedItems[0];
    if (selected?.itemType === 'load-more') {
      void this.loadNextPage(session);
      return;
    }
    if (selected?.entry !== undefined) {
      session.view.hide();
      void this.openEntry(selected.entry, session.input).catch((error: unknown) =>
        this.reportError(error),
      );
    }
  }

  private async loadNextPage(session: QuickPickSession): Promise<void> {
    if (!canLoad(session)) {
      return;
    }
    session.isLoading = true;
    session.view.busy = true;
    const previousCount = session.entries.length;
    try {
      const page = await this.loadPage(
        {
          ...session.input,
          limit: this.pageSize,
          ...(session.cursor === undefined ? {} : { cursor: session.cursor }),
        },
        session.controller.signal,
      );
      if (!this.isActive(session)) {
        return;
      }
      this.applyPage(session, page, previousCount);
    } catch (error: unknown) {
      if (shouldReportError(session, this.isActive(session))) {
        this.reportError(error);
      }
    } finally {
      session.isLoading = false;
      if (this.isActive(session)) {
        session.view.busy = false;
      }
    }
  }

  private applyPage(
    session: QuickPickSession,
    page: GitLineHistoryPage,
    previousCount: number,
  ): void {
    session.entries.push(...page.entries);
    session.complete = page.complete || page.nextCursor === undefined;
    session.cursor = page.nextCursor;
    session.view.items = this.createItems(session);
    const firstNewItem = session.view.items[previousCount];
    if (previousCount > 0 && firstNewItem?.itemType === 'entry') {
      session.view.activeItems = [firstNewItem];
    }
  }

  private createItems(
    session: QuickPickSession,
  ): readonly GitLineHistoryQuickPickItem[] {
    const items = session.entries.map((entry) => this.createEntryItem(entry));
    return session.complete
      ? items
      : [
          ...items,
          {
            itemType: 'load-more',
            label: `$(sync) ${this.labels.loadMore}`,
            alwaysShow: true,
          },
        ];
  }

  private createEntryItem(entry: GitLineHistoryEntry): GitLineHistoryQuickPickItem {
    const date = new Date(entry.authoredAt * 1_000).toLocaleDateString();
    const lineText =
      entry.lineText.length === 0 ? this.labels.emptyLine : entry.lineText;
    return {
      itemType: 'entry',
      label: `$(git-commit) ${entry.summary || entry.commit.slice(0, 8)}`,
      description: `${date}  ${entry.author}  ${entry.commit.slice(0, 8)}`,
      detail: `${changeIcon(entry.changeType)} ${entry.path}:${String(entry.line)}  ${lineText}`,
      entry,
    };
  }

  private isActive(session: QuickPickSession): boolean {
    return this.#active === session && !session.isDisposed;
  }

  private closeActive(): void {
    const session = this.#active;
    if (session === undefined) {
      return;
    }
    session.view.hide();
    this.release(session);
  }

  private release(session: QuickPickSession): void {
    if (session.isDisposed) {
      return;
    }
    session.isDisposed = true;
    session.controller.abort();
    for (const subscription of session.subscriptions.splice(0)) {
      subscription.dispose();
    }
    session.view.dispose();
    if (this.#active === session) {
      this.#active = undefined;
    }
  }
}

function canLoad(session: QuickPickSession): boolean {
  return !session.isDisposed && !session.isLoading && !session.complete;
}

function shouldReportError(session: QuickPickSession, isActive: boolean): boolean {
  return !session.controller.signal.aborted && isActive;
}

function changeIcon(changeType: GitLineHistoryEntry['changeType']): string {
  switch (changeType) {
    case 'added':
      return '$(diff-added)';
    case 'modified':
      return '$(diff-modified)';
    case 'renamed':
      return '$(diff-renamed)';
  }
}
