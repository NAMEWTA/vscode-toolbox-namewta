import * as vscode from 'vscode';
import type { ToolErrorCode } from '../../core/contracts/tool-error-contract';
import {
  isFullCommitHash,
  isRepositoryRelativePath,
  type GitCompareCommit,
  type GitCompareFileChange,
  type GitCompareHistoryPage,
} from '../../core/domains/git-compare/public-api';
import type { ToolboxGateway } from '../../core/orchestration/public-api';
import { DisposableStore } from '../../core/kernel/disposable';
import { ApplicationError } from '../../core/kernel/application-error';
import { GitCommandRunner } from '../adapters/git/git-command-runner';
import { VscodeGitCompareRepositoryAdapter } from '../adapters/vscode-git-compare-repository-adapter';
import { VscodeGitCompareDocumentProvider } from './vscode-git-compare-document-provider';
import {
  VscodeGitCompareChangesTree,
  VscodeGitCompareHistoryTree,
  type GitCompareChangeNode,
  type GitCompareCommitNode,
} from './vscode-git-compare-tree';

const PAGE_SIZE = 100;

export class GitCompareController implements vscode.Disposable {
  readonly #disposables = new DisposableStore();
  readonly #repositoryResolver = new VscodeGitCompareRepositoryAdapter(
    new GitCommandRunner(),
  );
  readonly #historyTree: VscodeGitCompareHistoryTree;
  readonly #changesTree: VscodeGitCompareChangesTree;
  readonly #documentProvider: VscodeGitCompareDocumentProvider;
  #repositoryRoot: string | undefined;
  #commits: readonly GitCompareCommit[] = [];
  #cursor: string | undefined;
  #hasMore = false;
  #reference: GitCompareCommit | undefined;
  #target: GitCompareCommit | undefined;
  #request: AbortController | undefined;
  #isDisposed = false;

  public get documentProvider(): VscodeGitCompareDocumentProvider {
    return this.#documentProvider;
  }

  public constructor(private readonly gateway: ToolboxGateway) {
    this.#documentProvider = this.#disposables.add(
      new VscodeGitCompareDocumentProvider(gateway),
    );
    this.#historyTree = this.#disposables.add(
      new VscodeGitCompareHistoryTree(
        (node) => this.selectTarget(node),
        () => void this.loadMore(),
      ),
    );
    this.#changesTree = this.#disposables.add(
      new VscodeGitCompareChangesTree((node) => void this.openFileDiff(node)),
    );
  }

  public async openHistory(): Promise<void> {
    this.assertAvailable();
    this.cancelRequest();
    const controller = new AbortController();
    this.#request = controller;
    try {
      const repositoryRoot = await this.#repositoryResolver.resolve(controller.signal);
      if (this.#repositoryRoot !== repositoryRoot) {
        this.#reference = undefined;
        this.#changesTree.render(undefined);
      }
      this.#repositoryRoot = repositoryRoot;
      this.#commits = [];
      this.#cursor = undefined;
      this.#hasMore = false;
      await this.loadPage(controller.signal);
      void vscode.commands.executeCommand(
        'setContext',
        'vscodeToolboxNamewta.gitCompare.hasReference',
        this.#reference !== undefined,
      );
    } finally {
      if (this.#request === controller) this.#request = undefined;
    }
  }

  public async refresh(): Promise<void> {
    return this.openHistory();
  }

  public setReference(node: unknown): void {
    const commit = this.toCommit(node);
    if (commit === undefined) return;
    this.#reference = commit;
    this.#historyTree.render(this.#commits, this.#hasMore, commit.sha);
    void vscode.commands.executeCommand(
      'setContext',
      'vscodeToolboxNamewta.gitCompare.hasReference',
      true,
    );
    void vscode.window.showInformationMessage(
      vscode.l10n.t('Comparison reference set: {0}', commit.sha.slice(0, 8)),
    );
  }

  public async compareWithReference(node: unknown): Promise<void> {
    const target = this.toCommit(node) ?? this.#target;
    if (
      target === undefined ||
      this.#reference === undefined ||
      this.#repositoryRoot === undefined
    ) {
      void vscode.window.showInformationMessage(
        vscode.l10n.t('Select a reference commit first.'),
      );
      return;
    }
    this.#target = target;
    this.cancelRequest();
    const controller = new AbortController();
    this.#request = controller;
    try {
      const result = await this.gateway.execute(
        'gitCompare.compareCommits',
        {
          repositoryRoot: this.#repositoryRoot,
          base: this.#reference.sha,
          target: target.sha,
        },
        { signal: controller.signal, source: 'extension-command' },
      );
      if (!result.ok) throw toApplicationError(result.error);
      this.#changesTree.render(result.data);
      void vscode.commands.executeCommand(
        'setContext',
        'vscodeToolboxNamewta.gitCompare.hasComparison',
        true,
      );
    } finally {
      if (this.#request === controller) this.#request = undefined;
    }
  }

  public clearReference(): void {
    this.#reference = undefined;
    this.#changesTree.render(undefined);
    this.#historyTree.render(this.#commits, this.#hasMore);
    void vscode.commands.executeCommand(
      'setContext',
      'vscodeToolboxNamewta.gitCompare.hasReference',
      false,
    );
    void vscode.commands.executeCommand(
      'setContext',
      'vscodeToolboxNamewta.gitCompare.hasComparison',
      false,
    );
  }

  public async loadMore(): Promise<void> {
    if (!this.#hasMore || this.#repositoryRoot === undefined) return;
    this.cancelRequest();
    const controller = new AbortController();
    this.#request = controller;
    try {
      await this.loadPage(controller.signal);
    } finally {
      if (this.#request === controller) this.#request = undefined;
    }
  }

  public async openFileDiff(node: unknown): Promise<void> {
    const change = this.toChange(node);
    if (
      change === undefined ||
      this.#repositoryRoot === undefined ||
      this.#reference === undefined ||
      this.#target === undefined
    )
      return;
    await this.#documentProvider.openChangeDiff(
      this.#repositoryRoot,
      this.#reference.sha,
      this.#target.sha,
      change,
    );
  }

  public dispose(): void {
    if (this.#isDisposed) return;
    this.#isDisposed = true;
    this.cancelRequest();
    this.#disposables.dispose();
  }

  private async loadPage(signal: AbortSignal): Promise<void> {
    if (this.#repositoryRoot === undefined) return;
    const result = await this.gateway.execute(
      'gitCompare.listCommits',
      {
        repositoryRoot: this.#repositoryRoot,
        limit: PAGE_SIZE,
        ...(this.#cursor === undefined ? {} : { cursor: this.#cursor }),
      },
      { signal, source: 'extension-command' },
    );
    if (!result.ok) throw toApplicationError(result.error);
    const page: GitCompareHistoryPage = result.data;
    this.#commits = [...this.#commits, ...page.commits];
    this.#cursor = page.nextCursor;
    this.#hasMore = !page.complete;
    this.#historyTree.render(this.#commits, this.#hasMore, this.#reference?.sha);
  }

  private selectTarget(node: GitCompareCommitNode): void {
    this.#target = node.commit;
  }

  private toCommit(value: unknown): GitCompareCommit | undefined {
    return isCommitNode(value) ? value.commit : undefined;
  }

  private toChange(value: unknown): GitCompareFileChange | undefined {
    return isChangeNode(value) ? value.change : undefined;
  }

  private cancelRequest(): void {
    this.#request?.abort();
    this.#request = undefined;
  }

  private assertAvailable(): void {
    if (this.#isDisposed)
      throw new Error(vscode.l10n.t('Git comparison is no longer active.'));
  }
}

// TreeView 命令参数在注册边界视为外部输入，执行前必须再次验证。
// eslint-disable-next-line complexity
function isCommitNode(value: unknown): value is GitCompareCommitNode {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('kind' in value) ||
    value.kind !== 'commit' ||
    !('commit' in value) ||
    typeof value.commit !== 'object' ||
    value.commit === null
  )
    return false;
  const commit = value.commit as Record<string, unknown>;
  return (
    isFullCommitHash(commit.sha) &&
    Array.isArray(commit.parents) &&
    commit.parents.every(isFullCommitHash) &&
    typeof commit.author === 'string' &&
    typeof commit.authoredAt === 'number' &&
    Number.isFinite(commit.authoredAt) &&
    typeof commit.subject === 'string'
  );
}

// eslint-disable-next-line complexity
function isChangeNode(value: unknown): value is GitCompareChangeNode {
  if (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    value.kind === 'change' &&
    'change' in value
  ) {
    const change = value.change;
    if (typeof change !== 'object' || change === null) return false;
    const candidate = change as Record<string, unknown>;
    return (
      typeof candidate.path === 'string' &&
      isRepositoryRelativePath(candidate.path) &&
      (candidate.previousPath === undefined ||
        isRepositoryRelativePath(candidate.previousPath)) &&
      isGitCompareFileStatus(candidate.status) &&
      isGitCompareContentKind(candidate.contentKind)
    );
  }
  return false;
}

function isGitCompareFileStatus(
  value: unknown,
): value is GitCompareFileChange['status'] {
  return (
    value === 'added' ||
    value === 'copied' ||
    value === 'deleted' ||
    value === 'modified' ||
    value === 'renamed' ||
    value === 'type-changed' ||
    value === 'unmerged' ||
    value === 'unknown'
  );
}

function isGitCompareContentKind(
  value: unknown,
): value is GitCompareFileChange['contentKind'] {
  return (
    value === 'text' ||
    value === 'binary' ||
    value === 'submodule' ||
    value === 'unavailable'
  );
}

function toApplicationError(error: {
  readonly code: ToolErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}): ApplicationError {
  return createError(error.code, error.message, error.retryable, error.details);
}

function createError(
  code: ToolErrorCode,
  message: string,
  retryable: boolean,
  details?: Readonly<Record<string, unknown>>,
): ApplicationError {
  return new ApplicationError(message, {
    code,
    retryable,
    ...(details === undefined ? {} : { details }),
  });
}
