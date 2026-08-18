import * as vscode from 'vscode';
import type {
  GitCompareCommit,
  GitCompareFileChange,
  GitCompareResult,
} from '../../core/domains/git-compare/public-api';
import { DisposableStore } from '../../core/kernel/disposable';

const GIT_COMPARE_HISTORY_VIEW_ID = 'vscodeToolboxNamewta.gitCompare.history';
const GIT_COMPARE_CHANGES_VIEW_ID = 'vscodeToolboxNamewta.gitCompare.changes';

export type GitCompareCommitNode = {
  readonly kind: 'commit';
  readonly commit: GitCompareCommit;
};
export type GitCompareLoadMoreNode = { readonly kind: 'load-more' };
export type GitCompareHistoryNode = GitCompareCommitNode | GitCompareLoadMoreNode;

export type GitCompareChangeGroupNode = {
  readonly kind: 'group';
  readonly status: GitCompareFileChange['status'] | 'summary';
  readonly label: string;
  readonly changes: readonly GitCompareFileChange[];
};
export type GitCompareChangeNode = {
  readonly kind: 'change';
  readonly change: GitCompareFileChange;
};
export type GitCompareChangesNode = GitCompareChangeGroupNode | GitCompareChangeNode;

export class VscodeGitCompareHistoryTree
  implements vscode.TreeDataProvider<GitCompareHistoryNode>, vscode.Disposable
{
  readonly #disposables = new DisposableStore();
  readonly #onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly #view: vscode.TreeView<GitCompareHistoryNode>;
  #commits: readonly GitCompareCommit[] = [];
  #hasMore = false;
  #reference: string | undefined;
  #selected: GitCompareCommitNode | undefined;
  public readonly onDidChangeTreeData = this.#onDidChangeTreeData.event;

  public constructor(
    private readonly onSelect: (node: GitCompareCommitNode) => void,
    private readonly onLoadMore: () => void,
  ) {
    this.#view = this.#disposables.add(
      vscode.window.createTreeView(GIT_COMPARE_HISTORY_VIEW_ID, {
        treeDataProvider: this,
        showCollapseAll: false,
      }),
    );
    this.#disposables.add(
      this.#view.onDidChangeSelection((event) => {
        const selected = event.selection[0];
        if (selected?.kind === 'commit') {
          this.#selected = selected;
          this.onSelect(selected);
        }
      }),
    );
    this.#disposables.add(this.#onDidChangeTreeData);
  }

  public render(
    commits: readonly GitCompareCommit[],
    hasMore: boolean,
    reference?: string,
  ): void {
    this.#commits = commits;
    this.#hasMore = hasMore;
    this.#reference = reference;
    this.#onDidChangeTreeData.fire();
  }

  public getSelected(): GitCompareCommitNode | undefined {
    return this.#selected;
  }

  public getTreeItem(node: GitCompareHistoryNode): vscode.TreeItem {
    if (node.kind === 'load-more') {
      const item = new vscode.TreeItem(
        vscode.l10n.t('Load more commits'),
        vscode.TreeItemCollapsibleState.None,
      );
      item.command = {
        command: 'vscodeToolboxNamewta.gitCompare.loadMore',
        title: item.label as string,
        arguments: [node],
      };
      item.iconPath = new vscode.ThemeIcon('ellipsis');
      item.contextValue = 'gitCompare.loadMore';
      return item;
    }
    const { commit } = node;
    const isReference = commit.sha === this.#reference;
    const item = new vscode.TreeItem(
      commit.subject,
      vscode.TreeItemCollapsibleState.None,
    );
    item.id = commit.sha;
    item.description = `${commit.sha.slice(0, 8)} · ${commit.author}`;
    item.tooltip = `${commit.sha}\n${commit.author}\n${new Date(commit.authoredAt).toLocaleString()}\n${commit.subject}`;
    item.iconPath = new vscode.ThemeIcon(isReference ? 'bookmark' : 'git-commit');
    item.contextValue = isReference
      ? 'gitCompare.commit.reference'
      : 'gitCompare.commit';
    item.accessibilityInformation = {
      label: `${commit.subject}, ${commit.sha.slice(0, 8)}${isReference ? `, ${vscode.l10n.t('Comparison reference')}` : ''}`,
    };
    return item;
  }

  public getChildren(node?: GitCompareHistoryNode): GitCompareHistoryNode[] {
    if (node !== undefined) return [];
    return [
      ...this.#commits.map((commit) => ({ kind: 'commit' as const, commit })),
      ...(this.#hasMore ? [{ kind: 'load-more' as const }] : []),
    ];
  }

  public dispose(): void {
    this.#disposables.dispose();
  }
}

export class VscodeGitCompareChangesTree
  implements vscode.TreeDataProvider<GitCompareChangesNode>, vscode.Disposable
{
  readonly #disposables = new DisposableStore();
  readonly #onDidChangeTreeData = new vscode.EventEmitter<void>();
  #result: GitCompareResult | undefined;
  public readonly onDidChangeTreeData = this.#onDidChangeTreeData.event;

  public constructor(
    private readonly onOpenChange: (change: GitCompareFileChange) => void,
  ) {
    this.#disposables.add(
      vscode.window.createTreeView(GIT_COMPARE_CHANGES_VIEW_ID, {
        treeDataProvider: this,
        showCollapseAll: true,
      }),
    );
    this.#disposables.add(this.#onDidChangeTreeData);
  }

  public render(result: GitCompareResult | undefined): void {
    this.#result = result;
    this.#onDidChangeTreeData.fire();
  }

  public getTreeItem(node: GitCompareChangesNode): vscode.TreeItem {
    if (node.kind === 'group') {
      const item = new vscode.TreeItem(
        node.label,
        node.status === 'summary'
          ? vscode.TreeItemCollapsibleState.None
          : vscode.TreeItemCollapsibleState.Expanded,
      );
      item.contextValue = `gitCompare.group.${node.status}`;
      item.iconPath = new vscode.ThemeIcon(
        node.status === 'summary' ? 'info' : 'folder',
      );
      return item;
    }
    const change = node.change;
    const item = new vscode.TreeItem(change.path, vscode.TreeItemCollapsibleState.None);
    item.description = `${statusLabel(change.status)}${change.contentKind === 'text' ? '' : ` · ${contentKindLabel(change.contentKind)}`}`;
    item.tooltip =
      change.previousPath === undefined
        ? change.path
        : `${change.previousPath} → ${change.path}`;
    item.iconPath = new vscode.ThemeIcon(iconForStatus(change.status));
    item.contextValue = `gitCompare.change.${change.status}`;
    item.command = {
      command: 'vscodeToolboxNamewta.gitCompare.openFileDiff',
      title: vscode.l10n.t('Open comparison'),
      arguments: [node],
    };
    return item;
  }

  public getChildren(node?: GitCompareChangesNode): GitCompareChangesNode[] {
    if (node?.kind === 'change') return [];
    if (node?.kind === 'group')
      return node.changes.map((change) => ({ kind: 'change' as const, change }));
    if (this.#result === undefined) return [];
    const result = this.#result;
    const groups: GitCompareChangeGroupNode[] = [
      {
        kind: 'group',
        status: 'summary',
        label: vscode.l10n.t(
          '{0} files · +{1} -{2}',
          result.stats.files,
          result.stats.additions,
          result.stats.deletions,
        ),
        changes: [],
      },
    ];
    for (const status of [
      'added',
      'copied',
      'modified',
      'renamed',
      'deleted',
      'type-changed',
      'unmerged',
      'unknown',
    ] as const) {
      const changes = result.changes.filter((change) => change.status === status);
      if (changes.length > 0)
        groups.push({
          kind: 'group',
          status,
          label: `${statusLabel(status)} (${changes.length})`,
          changes,
        });
    }
    return groups;
  }

  public dispose(): void {
    this.#disposables.dispose();
  }
}

function iconForStatus(status: GitCompareFileChange['status']): string {
  switch (status) {
    case 'added':
      return 'diff-added';
    case 'copied':
      return 'diff-added';
    case 'modified':
      return 'diff-modified';
    case 'deleted':
      return 'diff-removed';
    case 'renamed':
      return 'diff-renamed';
    case 'type-changed':
      return 'diff-modified';
    case 'unmerged':
      return 'warning';
    case 'unknown':
      return 'question';
  }
}

function statusLabel(status: GitCompareFileChange['status']): string {
  switch (status) {
    case 'added':
      return vscode.l10n.t('Added');
    case 'copied':
      return vscode.l10n.t('Copied');
    case 'modified':
      return vscode.l10n.t('Modified');
    case 'deleted':
      return vscode.l10n.t('Deleted');
    case 'renamed':
      return vscode.l10n.t('Renamed');
    case 'type-changed':
      return vscode.l10n.t('Type changed');
    case 'unmerged':
      return vscode.l10n.t('Unmerged');
    case 'unknown':
      return vscode.l10n.t('Other');
  }
}

function contentKindLabel(contentKind: GitCompareFileChange['contentKind']): string {
  switch (contentKind) {
    case 'text':
      return vscode.l10n.t('Text');
    case 'binary':
      return vscode.l10n.t('Binary');
    case 'submodule':
      return vscode.l10n.t('Submodule');
    case 'unavailable':
      return vscode.l10n.t('Unavailable');
  }
}
