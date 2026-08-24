import * as vscode from 'vscode';
import type {
  GitReviewItem,
  GitReviewSessionSnapshot,
} from '../../core/domains/git-review/public-api';
import { DisposableStore } from '../../core/kernel/disposable';
import { displayGitReviewText } from './git-review-display-text';
import { getGitReviewSession } from './git-review-session-snapshot';

const GIT_REVIEW_QUEUE_VIEW_ID = 'vscodeToolboxNamewta.gitReview.queue';

export type GitReviewQueueEntry = {
  readonly item: GitReviewItem;
  readonly isCurrent: boolean;
};

export type GitReviewQueueSelectionHandler = (item: GitReviewItem) => Promise<void>;

export class VscodeGitReviewQueueTree
  implements vscode.TreeDataProvider<GitReviewQueueEntry>, vscode.Disposable
{
  readonly #disposables = new DisposableStore();
  readonly #onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly #view: vscode.TreeView<GitReviewQueueEntry>;
  #snapshot: GitReviewSessionSnapshot = { state: 'inactive' };

  public readonly onDidChangeTreeData = this.#onDidChangeTreeData.event;

  public constructor(private readonly onSelect: GitReviewQueueSelectionHandler) {
    this.#view = this.#disposables.add(
      vscode.window.createTreeView(GIT_REVIEW_QUEUE_VIEW_ID, {
        treeDataProvider: this,
        showCollapseAll: false,
      }),
    );
    this.#disposables.add(
      this.#view.onDidChangeSelection((event) => this.handleSelection(event)),
    );
    this.#disposables.add(this.#onDidChangeTreeData);
  }

  public render(snapshot: GitReviewSessionSnapshot): void {
    this.#snapshot = snapshot;
    this.#onDidChangeTreeData.fire();
  }

  public getTreeItem(entry: GitReviewQueueEntry): vscode.TreeItem {
    const item = entry.item;
    const state = reviewStateLabel(item.reviewState);
    const treeItem = new vscode.TreeItem(
      displayGitReviewText(item.path),
      vscode.TreeItemCollapsibleState.None,
    );
    treeItem.id = `${item.itemId}:${item.contentIdentity}`;
    treeItem.description = entry.isCurrent
      ? `${vscode.l10n.t('Current')} - ${state}`
      : state;
    treeItem.tooltip = createTooltip(item, entry.isCurrent, state);
    treeItem.iconPath = new vscode.ThemeIcon(iconName(item, entry.isCurrent));
    treeItem.contextValue = createContextValue(item);
    treeItem.accessibilityInformation = {
      label: createAccessibilityLabel(item, entry.isCurrent, state),
    };
    return treeItem;
  }

  public getChildren(entry?: GitReviewQueueEntry): GitReviewQueueEntry[] {
    if (entry !== undefined) {
      return [];
    }
    const session = getGitReviewSession(this.#snapshot);
    if (session === undefined) {
      return [];
    }
    return session.items.map((item) => ({
      item,
      isCurrent: item.itemId === session.currentItemId,
    }));
  }

  public dispose(): void {
    this.#disposables.dispose();
  }

  private handleSelection(
    event: vscode.TreeViewSelectionChangeEvent<GitReviewQueueEntry>,
  ): void {
    if (this.#snapshot.state !== 'active') {
      return;
    }
    const [selected] = event.selection;
    if (selected !== undefined) {
      void this.onSelect(selected.item);
    }
  }
}

function reviewStateLabel(state: GitReviewItem['reviewState']): string {
  switch (state) {
    case 'unreviewed':
      return vscode.l10n.t('Unreviewed');
    case 'reviewed':
      return vscode.l10n.t('Reviewed');
    case 'skipped':
      return vscode.l10n.t('Skipped');
  }
}

function iconName(item: GitReviewItem, isCurrent: boolean): string {
  if (isCurrent) {
    return 'arrow-right';
  }
  switch (item.reviewState) {
    case 'reviewed':
      return 'check';
    case 'skipped':
      return 'debug-step-over';
    case 'unreviewed':
      return 'circle-outline';
  }
}

function createContextValue(item: GitReviewItem): string {
  return `gitReview.${item.layer}`;
}

function createTooltip(item: GitReviewItem, isCurrent: boolean, state: string): string {
  const lines = [
    vscode.l10n.t('Git Review: {0}', displayGitReviewText(item.path)),
    vscode.l10n.t('Status: {0}', state),
  ];
  if (isCurrent) {
    lines.push(vscode.l10n.t('Current review item'));
  }
  if (item.previousPath !== undefined) {
    lines.push(
      vscode.l10n.t('Renamed from: {0}', displayGitReviewText(item.previousPath)),
    );
  }
  return lines.join('\n');
}

function createAccessibilityLabel(
  item: GitReviewItem,
  isCurrent: boolean,
  state: string,
): string {
  const current = isCurrent ? `${vscode.l10n.t('Current')}, ` : '';
  return vscode.l10n.t('{0}{1}, {2}', current, displayGitReviewText(item.path), state);
}
