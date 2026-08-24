import * as vscode from 'vscode';
import type {
  GitReviewItem,
  GitReviewSession,
  GitReviewSessionSnapshot,
} from '../../core/domains/git-review/public-api';
import { DisposableStore } from '../../core/kernel/disposable';
import type { ToolboxGateway, ToolLogger } from '../../core/orchestration/public-api';
import type { GitReviewPresentation } from './git-review-session-controller-contract';
import {
  createGitReviewNativeChanges,
  gitReviewInventoryIdentity,
} from './git-review-native-changes';
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
import {
  VscodeNativeChangesPresenter,
  type VscodeNativeChangeResource,
} from './vscode-native-changes-presenter';

type GitReviewPresentationResources = {
  readonly disposables: DisposableStore;
  readonly documentProvider: VscodeGitReviewDocumentProvider;
  readonly queueTree: VscodeGitReviewQueueTree;
  readonly statusBar: VscodeGitReviewStatusBar;
};

export type VscodeGitReviewPresentationDependencies = {
  readonly gateway: ToolboxGateway;
  readonly logger: ToolLogger;
};

export class VscodeGitReviewPresentation implements GitReviewPresentation {
  #resources: GitReviewPresentationResources | undefined;
  #snapshot: GitReviewSessionSnapshot = { state: 'inactive' };
  #inventoryIdentity: string | undefined;
  #isDisposed = false;

  public constructor(
    private readonly onSelect: GitReviewQueueSelectionHandler,
    private readonly dependencies?: VscodeGitReviewPresentationDependencies,
    private readonly nativeChanges = new VscodeNativeChangesPresenter(),
  ) {}

  public render(snapshot: GitReviewSessionSnapshot): void {
    this.#snapshot = snapshot;
    if (this.#isDisposed) return;
    const session = getGitReviewSession(snapshot);
    if (session === undefined) {
      this.releaseResources();
      return;
    }
    const resources = this.ensureResources();
    resources.queueTree.render(snapshot);
    resources.statusBar.render(snapshot);
    const identity = gitReviewInventoryIdentity(session);
    if (identity !== this.#inventoryIdentity) {
      this.#inventoryIdentity = identity;
      this.openNativeReview(resources.documentProvider, session);
    }
  }

  public focusItem(item: GitReviewItem): boolean {
    const session = getGitReviewSession(this.#snapshot);
    return (
      session?.items.some(
        (candidate) =>
          candidate.itemId === item.itemId &&
          candidate.contentIdentity === item.contentIdentity,
      ) === true
    );
  }

  public dispose(): void {
    if (this.#isDisposed) return;
    this.#isDisposed = true;
    this.releaseResources();
  }

  private openNativeReview(
    documentProvider: VscodeGitReviewDocumentProvider,
    session: GitReviewSession,
  ): void {
    documentProvider.clear();
    const resources: VscodeNativeChangeResource[] = createGitReviewNativeChanges(
      session,
    ).map((change) => [
      vscode.Uri.joinPath(
        vscode.Uri.file(session.repositoryRoot),
        ...change.labelPath.split('/'),
      ),
      change.original === undefined
        ? undefined
        : documentProvider.createItemUri(
            change.original.item,
            change.original.side,
            change.labelPath,
          ),
      change.modified === undefined
        ? undefined
        : documentProvider.createItemUri(
            change.modified.item,
            change.modified.side,
            change.labelPath,
          ),
    ]);
    void this.nativeChanges
      .open(createReviewTitle(session), resources)
      .catch((error: unknown) => {
        this.dependencies?.logger.error('Git Review native Changes failed.', error);
        void vscode.window.showErrorMessage(
          vscode.l10n.t('Git Review could not open the native Changes view.'),
        );
      });
  }

  private ensureResources(): GitReviewPresentationResources {
    if (this.#isDisposed) {
      throw new Error(vscode.l10n.t('Git Review is no longer active.'));
    }
    if (this.#resources !== undefined) return this.#resources;
    const disposables = new DisposableStore();
    try {
      const documentProvider = disposables.add(
        new VscodeGitReviewDocumentProvider(this.dependencies?.gateway),
      );
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
    this.#inventoryIdentity = undefined;
    resources?.disposables.dispose();
  }
}

function createReviewTitle(session: GitReviewSession): string {
  const staged = session.items.filter((item) => item.layer === 'staged').length;
  const unstaged = session.items.filter((item) => item.layer === 'unstaged').length;
  const conflicts = session.items.filter((item) => item.layer === 'conflict').length;
  return vscode.l10n.t(
    'Git Review · {0} items · staged {1} · unstaged {2} · conflicts {3}',
    session.items.length,
    staged,
    unstaged,
    conflicts,
  );
}
