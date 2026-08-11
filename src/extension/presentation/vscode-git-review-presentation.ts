import * as vscode from 'vscode';
import type { GitReviewWebviewAction } from '../../core/contracts';
import type {
  GitReviewItem,
  GitReviewItemContent,
  GitReviewSessionSnapshot,
} from '../../core/domains/git-review/public-api';
import type { ToolboxGateway, ToolLogger } from '../../core/orchestration/public-api';
import { DisposableStore } from '../../core/kernel/disposable';
import type { GitReviewPresentation } from './git-review-session-controller-contract';
import { displayGitReviewText } from './git-review-display-text';
import { createGitReviewSummaryText } from './git-review-summary-text';
import { getGitReviewSession } from './git-review-session-snapshot';
import {
  GIT_REVIEW_DOCUMENT_SCHEME,
  VscodeGitReviewDocumentProvider,
} from './vscode-git-review-document-provider';
import {
  VscodeGitReviewQueueTree,
  type GitReviewQueueSelectionHandler,
} from './vscode-git-review-queue-tree';
import { VscodeGitReviewStatusBar } from './vscode-git-review-status-bar';
import { GitReviewPanelController } from './git-review-panel-controller';

type GitReviewPresentationResources = {
  readonly disposables: DisposableStore;
  readonly documentProvider: VscodeGitReviewDocumentProvider;
  readonly queueTree: VscodeGitReviewQueueTree;
  readonly statusBar: VscodeGitReviewStatusBar;
  readonly panel: GitReviewPanelController | undefined;
};

export type VscodeGitReviewPresentationDependencies = {
  readonly extensionUri: vscode.Uri;
  readonly gateway: ToolboxGateway;
  readonly logger: ToolLogger;
  readonly onSnapshot: (snapshot: GitReviewSessionSnapshot) => void;
};

export class VscodeGitReviewPresentation implements GitReviewPresentation {
  #resources: GitReviewPresentationResources | undefined;
  #snapshot: GitReviewSessionSnapshot = { state: 'inactive' };
  #isDisposed = false;

  public constructor(
    private readonly onSelect: GitReviewQueueSelectionHandler,
    private readonly dependencies?: VscodeGitReviewPresentationDependencies,
  ) {}

  public render(snapshot: GitReviewSessionSnapshot): void {
    this.#snapshot = snapshot;
    if (this.#isDisposed) {
      return;
    }
    if (getGitReviewSession(snapshot) === undefined) {
      this.releaseResources();
      return;
    }
    const resources = this.ensureResources();
    resources.queueTree.render(snapshot);
    resources.statusBar.render(snapshot);
    resources.panel?.render(snapshot);
  }

  public async openItem(
    item: GitReviewItem,
    content: GitReviewItemContent,
  ): Promise<void> {
    const resources = this.ensureResources();
    await this.openNativeDiff(resources.documentProvider, item, content);
  }

  public focusItem(item: GitReviewItem): boolean {
    const panel = this.ensureResources().panel;
    if (panel === undefined) {
      return false;
    }
    panel.focusItem(item.itemId);
    return true;
  }

  private async openNativeDiff(
    documentProvider: VscodeGitReviewDocumentProvider,
    item: GitReviewItem,
    content: GitReviewItemContent,
  ): Promise<void> {
    if (content.kind === 'text') {
      const documents = documentProvider.createTextUris(content.before, content.after);
      await vscode.commands.executeCommand(
        'vscode.diff',
        documents.before,
        documents.after,
        vscode.l10n.t('Git Review: {0}', displayGitReviewText(item.path)),
        { preview: true },
      );
      return;
    }
    const summaryUri = documentProvider.createSummaryUri(
      createGitReviewSummaryText(item, content.reason),
    );
    await vscode.window.showTextDocument(summaryUri, { preview: true });
  }

  public dispose(): void {
    if (this.#isDisposed) {
      return;
    }
    this.#isDisposed = true;
    this.releaseResources();
  }

  private ensureResources(): GitReviewPresentationResources {
    if (this.#isDisposed) {
      throw new Error(vscode.l10n.t('Git Review is no longer active.'));
    }
    if (this.#resources !== undefined) {
      return this.#resources;
    }
    const disposables = new DisposableStore();
    try {
      const documentProvider = disposables.add(new VscodeGitReviewDocumentProvider());
      disposables.add(
        vscode.workspace.registerTextDocumentContentProvider(
          GIT_REVIEW_DOCUMENT_SCHEME,
          documentProvider,
        ),
      );
      const queueTree = disposables.add(new VscodeGitReviewQueueTree(this.onSelect));
      const statusBar = disposables.add(new VscodeGitReviewStatusBar());
      const panel =
        this.dependencies === undefined
          ? undefined
          : disposables.add(
              new GitReviewPanelController(
                this.dependencies.extensionUri,
                this.dependencies.gateway,
                this.dependencies.logger,
                this.dependencies.onSnapshot,
                (message) => this.handlePanelAction(documentProvider, message),
              ),
            );
      const resources = { disposables, documentProvider, queueTree, statusBar, panel };
      this.#resources = resources;
      panel?.render(this.#snapshot);
      return resources;
    } catch (error: unknown) {
      disposables.dispose();
      throw error;
    }
  }

  private async handlePanelAction(
    documentProvider: VscodeGitReviewDocumentProvider,
    message: GitReviewWebviewAction,
  ): Promise<void> {
    const session = getGitReviewSession(this.#snapshot);
    const item = session?.items.find(
      (candidate) =>
        candidate.itemId === message.itemId &&
        candidate.contentIdentity === message.contentIdentity,
    );
    if (
      session === undefined ||
      item === undefined ||
      this.dependencies === undefined
    ) {
      return;
    }
    try {
      await this.performPanelAction(
        documentProvider,
        session.repositoryRoot,
        item,
        message,
      );
    } catch (error: unknown) {
      this.dependencies.logger.error('Git Review presentation action failed.', error);
      await vscode.window.showErrorMessage(
        vscode.l10n.t('Git Review action failed. See the output log for details.'),
      );
    }
  }

  private async performPanelAction(
    documentProvider: VscodeGitReviewDocumentProvider,
    repositoryRoot: string,
    item: GitReviewItem,
    message: GitReviewWebviewAction,
  ): Promise<void> {
    switch (message.action) {
      case 'open-file':
      case 'merge-changes':
        await vscode.commands.executeCommand(
          'vscode.open',
          vscode.Uri.joinPath(vscode.Uri.file(repositoryRoot), item.path),
        );
        return;
      case 'copy-reference':
        await this.copyReference(repositoryRoot, item, message.line);
        return;
      case 'mark-reviewed':
        await this.reviewItem(item, 'gitReview.markReviewedAndNext');
        return;
      case 'skip':
        await this.reviewItem(item, 'gitReview.skip');
        return;
      case 'open-diff':
        await this.openPanelDiff(documentProvider, item);
        return;
    }
  }

  private async reviewItem(
    item: GitReviewItem,
    command: 'gitReview.markReviewedAndNext' | 'gitReview.skip',
  ): Promise<void> {
    if (this.dependencies === undefined) {
      return;
    }
    await this.onSelect(item);
    const currentSession = getGitReviewSession(this.#snapshot);
    const currentItem = currentSession?.items.find(
      (candidate) => candidate.itemId === currentSession.currentItemId,
    );
    if (
      currentItem === undefined ||
      currentItem.itemId !== item.itemId ||
      currentItem.contentIdentity !== item.contentIdentity
    ) {
      return;
    }
    const result = await this.dependencies.gateway.execute(
      command,
      {},
      { source: 'webview' },
    );
    if (result.ok) {
      this.dependencies.onSnapshot(result.data);
    }
  }

  private async openPanelDiff(
    documentProvider: VscodeGitReviewDocumentProvider,
    item: GitReviewItem,
  ): Promise<void> {
    if (this.dependencies === undefined) {
      return;
    }
    const result = await this.dependencies.gateway.execute(
      'gitReview.getItemContent',
      { path: item.path, contentIdentity: item.contentIdentity },
      { source: 'webview' },
    );
    if (result.ok) {
      await this.openNativeDiff(documentProvider, item, result.data);
    }
  }

  private async copyReference(
    repositoryRoot: string,
    item: GitReviewItem,
    line: number | undefined,
  ): Promise<void> {
    if (this.dependencies === undefined) {
      return;
    }
    const root = vscode.Uri.file(repositoryRoot);
    const resource = vscode.Uri.joinPath(root, item.path);
    const position = { line: Math.max((line ?? 1) - 1, 0), character: 0 };
    const result = await this.dependencies.gateway.execute(
      'copyReference.copy',
      {
        mode: 'relative',
        source: {
          kind: 'editor',
          resource: toResourceSnapshot(resource),
          selection: { anchor: position, active: position },
        },
        workspaceFolders: [toResourceSnapshot(root)],
      },
      { source: 'webview' },
    );
    if (result.ok) {
      vscode.window.setStatusBarMessage(
        vscode.l10n.t('Copied reference: {0}', result.data),
        2_000,
      );
    }
  }

  private releaseResources(): void {
    const resources = this.#resources;
    this.#resources = undefined;
    resources?.disposables.dispose();
  }
}

function toResourceSnapshot(uri: vscode.Uri): {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly absolute: string;
} {
  return {
    scheme: uri.scheme,
    authority: uri.authority,
    path: uri.path,
    absolute: uri.fsPath,
  };
}
