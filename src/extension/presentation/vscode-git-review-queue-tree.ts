import * as vscode from 'vscode';
import type {
  GitReviewItem,
  GitReviewSessionSnapshot,
} from '../../core/domains/git-review/public-api';
import { DisposableStore } from '../../core/kernel/disposable';
import { displayGitReviewText } from './git-review-display-text';
import {
  createGitReviewQueueTree,
  type GitReviewQueueItemNode,
  type GitReviewQueueLayerNode,
  type GitReviewQueueTreeNode,
} from './git-review-queue-tree-model';
import { getGitReviewSession } from './git-review-session-snapshot';

const GIT_REVIEW_QUEUE_VIEW_ID = 'vscodeToolboxNamewta.gitReview.queue';
const OPEN_GIT_REVIEW_ITEM_COMMAND = 'vscodeToolboxNamewta.gitReview.openQueueItemDiff';

export type GitReviewQueueSelectionHandler = (item: GitReviewItem) => Promise<void>;

export class VscodeGitReviewQueueTree
  implements vscode.TreeDataProvider<GitReviewQueueTreeNode>, vscode.Disposable
{
  readonly #disposables = new DisposableStore();
  readonly #onDidChangeTreeData = new vscode.EventEmitter<void>();
  #snapshot: GitReviewSessionSnapshot = { state: 'inactive' };
  #roots: GitReviewQueueLayerNode[] = [];

  public readonly onDidChangeTreeData = this.#onDidChangeTreeData.event;

  public constructor(private readonly onSelect: GitReviewQueueSelectionHandler) {
    this.#disposables.add(
      vscode.window.createTreeView(GIT_REVIEW_QUEUE_VIEW_ID, {
        treeDataProvider: this,
        showCollapseAll: true,
      }),
    );
    this.#disposables.add(
      vscode.commands.registerCommand(OPEN_GIT_REVIEW_ITEM_COMMAND, (item) =>
        this.handleOpenItem(item),
      ),
    );
    this.#disposables.add(this.#onDidChangeTreeData);
  }

  public render(snapshot: GitReviewSessionSnapshot): void {
    this.#snapshot = snapshot;
    const session = getGitReviewSession(snapshot);
    this.#roots = session === undefined ? [] : createGitReviewQueueTree(session);
    this.#onDidChangeTreeData.fire();
  }

  public getTreeItem(entry: GitReviewQueueTreeNode): vscode.TreeItem {
    switch (entry.kind) {
      case 'layer':
        return createLayerTreeItem(entry);
      case 'directory': {
        const treeItem = new vscode.TreeItem(
          displayGitReviewText(entry.name),
          vscode.TreeItemCollapsibleState.Collapsed,
        );
        treeItem.id = `directory:${entry.layer}:${entry.path}`;
        treeItem.tooltip = displayGitReviewText(entry.path);
        treeItem.iconPath = new vscode.ThemeIcon('folder');
        treeItem.contextValue = 'gitReview.directory';
        return treeItem;
      }
      case 'item':
        return createItemTreeItem(entry, OPEN_GIT_REVIEW_ITEM_COMMAND);
    }
  }

  public getChildren(entry?: GitReviewQueueTreeNode): GitReviewQueueTreeNode[] {
    if (entry === undefined) return this.#roots;
    return entry.kind === 'item' ? [] : entry.children;
  }

  public getParent(entry: GitReviewQueueTreeNode): GitReviewQueueTreeNode | undefined {
    return entry.kind === 'layer' ? undefined : entry.parent;
  }

  public dispose(): void {
    this.#disposables.dispose();
  }

  private handleOpenItem(candidate: unknown): void {
    if (this.#snapshot.state !== 'active') return;
    const identity = readItemIdentity(candidate);
    if (identity === undefined) return;
    const item = this.#snapshot.session.items.find(
      (entry) =>
        entry.itemId === identity.itemId &&
        entry.contentIdentity === identity.contentIdentity,
    );
    if (item !== undefined) void this.onSelect(item);
  }
}

function createLayerTreeItem(entry: GitReviewQueueLayerNode): vscode.TreeItem {
  const treeItem = new vscode.TreeItem(
    layerLabel(entry.layer),
    vscode.TreeItemCollapsibleState.Expanded,
  );
  treeItem.id = `layer:${entry.layer}`;
  treeItem.description = String(entry.itemCount);
  treeItem.iconPath = new vscode.ThemeIcon(layerIcon(entry.layer));
  treeItem.contextValue = 'gitReview.layer';
  return treeItem;
}

function createItemTreeItem(
  entry: GitReviewQueueItemNode,
  command: string,
): vscode.TreeItem {
  const item = entry.item;
  const state = reviewStateLabel(item.reviewState);
  const treeItem = new vscode.TreeItem(
    displayGitReviewText(fileName(item.path)),
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
  treeItem.command = {
    command,
    title: vscode.l10n.t('Git Review: {0}', displayGitReviewText(item.path)),
    arguments: [item],
  };
  return treeItem;
}

function readItemIdentity(
  candidate: unknown,
): Pick<GitReviewItem, 'itemId' | 'contentIdentity'> | undefined {
  if (typeof candidate !== 'object' || candidate === null) return undefined;
  const values = candidate as {
    readonly itemId?: unknown;
    readonly contentIdentity?: unknown;
  };
  const { itemId, contentIdentity } = values;
  return typeof itemId === 'string' && typeof contentIdentity === 'string'
    ? { itemId, contentIdentity }
    : undefined;
}

function layerLabel(layer: GitReviewItem['layer']): string {
  switch (layer) {
    case 'conflict':
      return vscode.l10n.t('Conflicts');
    case 'staged':
      return vscode.l10n.t('Staged');
    case 'unstaged':
      return vscode.l10n.t('Unstaged');
  }
}

function layerIcon(layer: GitReviewItem['layer']): string {
  switch (layer) {
    case 'conflict':
      return 'warning';
    case 'staged':
      return 'checklist';
    case 'unstaged':
      return 'edit';
  }
}

function fileName(path: string): string {
  return path.split('/').at(-1) ?? path;
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
