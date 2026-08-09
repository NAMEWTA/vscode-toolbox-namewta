import * as vscode from 'vscode';
import type {
  GitReviewItem,
  GitReviewItemContent,
  GitReviewSessionSnapshot,
} from '../../core/domains/git-review/public-api';
import { DisposableStore } from '../../core/kernel/disposable';
import type { GitReviewPresentation } from './git-review-session-controller';
import { displayGitReviewText } from './git-review-display-text';
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

type GitReviewPresentationResources = {
  readonly disposables: DisposableStore;
  readonly documentProvider: VscodeGitReviewDocumentProvider;
  readonly queueTree: VscodeGitReviewQueueTree;
  readonly statusBar: VscodeGitReviewStatusBar;
};

export class VscodeGitReviewPresentation implements GitReviewPresentation {
  #resources: GitReviewPresentationResources | undefined;
  #isDisposed = false;

  public constructor(private readonly onSelect: GitReviewQueueSelectionHandler) {}

  public render(snapshot: GitReviewSessionSnapshot): void {
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
  }

  public async openItem(
    item: GitReviewItem,
    content: GitReviewItemContent,
  ): Promise<void> {
    const resources = this.ensureResources();
    if (content.kind === 'text') {
      const documents = resources.documentProvider.createTextUris(
        content.before,
        content.after,
      );
      await vscode.commands.executeCommand(
        'vscode.diff',
        documents.before,
        documents.after,
        vscode.l10n.t('Git Review: {0}', displayGitReviewText(item.path)),
        { preview: true },
      );
      return;
    }
    const summaryUri = resources.documentProvider.createSummaryUri(
      createSummary(item, content.reason),
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
      const resources = { disposables, documentProvider, queueTree, statusBar };
      this.#resources = resources;
      return resources;
    } catch (error: unknown) {
      disposables.dispose();
      throw error;
    }
  }

  private releaseResources(): void {
    const resources = this.#resources;
    this.#resources = undefined;
    resources?.disposables.dispose();
  }
}

function createSummary(
  item: GitReviewItem,
  reason: Extract<GitReviewItemContent, { readonly kind: 'summary' }>['reason'],
): string {
  return [
    vscode.l10n.t('Git Review item'),
    vscode.l10n.t('Path: {0}', displayGitReviewText(item.path)),
    vscode.l10n.t('Change: {0}', changeLabel(item.change)),
    summaryReason(reason),
  ].join('\n');
}

function changeLabel(change: GitReviewItem['change']): string {
  switch (change) {
    case 'added':
      return vscode.l10n.t('Added');
    case 'modified':
      return vscode.l10n.t('Modified');
    case 'deleted':
      return vscode.l10n.t('Deleted');
    case 'renamed':
      return vscode.l10n.t('Renamed');
    case 'untracked':
      return vscode.l10n.t('Untracked');
  }
}

function summaryReason(
  reason: Extract<GitReviewItemContent, { readonly kind: 'summary' }>['reason'],
): string {
  switch (reason) {
    case 'binary':
      return vscode.l10n.t('This item is binary and cannot be shown as a text diff.');
    case 'submodule':
      return vscode.l10n.t(
        'This item is a submodule and cannot be shown as a text diff.',
      );
    case 'unavailable':
      return vscode.l10n.t(
        'This item is unavailable as a text diff. Retry or skip it.',
      );
  }
}
