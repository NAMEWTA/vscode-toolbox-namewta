import * as vscode from 'vscode';
import type {
  GitReviewWebviewAction,
  ToolCommandId,
  ToolResult,
} from '../../core/contracts';
import {
  isGitReviewSessionSnapshot,
  type GitReviewSessionSnapshot,
} from '../../core/domains/git-review/public-api';
import type { ToolboxGateway, ToolLogger } from '../../core/orchestration/public-api';
import { createVscodeGitReviewWebviewBootstrap } from '../adapters/vscode-webview-bootstrap-adapter';
import { VscodeWebviewMessageAdapter } from '../adapters/vscode-webview-message-adapter';
import { createGitReviewPanelHtml } from './git-review-panel-html';

const GIT_REVIEW_VIEW_TYPE = 'vscodeToolboxNamewta.gitReview.aggregate';

export type GitReviewPanelActionHandler = (
  message: GitReviewWebviewAction,
) => Promise<void>;

export class GitReviewPanelController implements vscode.Disposable {
  #panel: vscode.WebviewPanel | undefined;
  #messages: VscodeWebviewMessageAdapter | undefined;
  #disposeListener: vscode.Disposable | undefined;
  #snapshot: GitReviewSessionSnapshot = { state: 'inactive' };

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly gateway: ToolboxGateway,
    private readonly logger: ToolLogger,
    private readonly onSnapshot: (snapshot: GitReviewSessionSnapshot) => void,
    private readonly onAction: GitReviewPanelActionHandler,
  ) {}

  public render(snapshot: GitReviewSessionSnapshot): void {
    this.#snapshot = snapshot;
    if (snapshot.state === 'inactive' || snapshot.state === 'completed') {
      this.disposePanel();
      return;
    }
    this.open();
    void this.#panel?.webview.postMessage({
      type: 'gitReview.snapshot',
      snapshot,
    });
  }

  public focusItem(itemId: string): void {
    this.#panel?.reveal(vscode.ViewColumn.Active, true);
    void this.#panel?.webview.postMessage({ type: 'gitReview.focus', itemId });
  }

  public dispose(): void {
    this.disposePanel();
  }

  private open(): void {
    if (this.#panel !== undefined) {
      this.#panel.reveal(vscode.ViewColumn.Active, true);
      return;
    }
    const root = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview');
    const panel = vscode.window.createWebviewPanel(
      GIT_REVIEW_VIEW_TYPE,
      vscode.l10n.t('toolbox-Git Review'),
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [root],
      },
    );
    const timeout = vscode.workspace
      .getConfiguration('vscodeToolboxNamewta')
      .get<number>('webview.requestTimeoutMs', 10_000);
    panel.webview.html = createGitReviewPanelHtml(panel.webview, {
      scriptUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(root, 'git-review.js')),
      styleUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(root, 'git-review.css')),
      bootstrap: createVscodeGitReviewWebviewBootstrap(timeout, this.#snapshot),
    });
    this.#messages = new VscodeWebviewMessageAdapter(
      panel.webview,
      this.gateway,
      this.logger,
      {
        authorize: (command, input) => this.authorize(command, input),
        onGitReviewAction: (message) => this.onAction(message),
        onToolResult: (command, result) => this.handleToolResult(command, result),
      },
    );
    this.#panel = panel;
    this.#disposeListener = panel.onDidDispose(() => this.handlePanelDisposed());
  }

  private async authorize(
    command: ToolCommandId,
    input: unknown,
  ): Promise<ToolResult<never> | undefined> {
    if (command !== 'gitReview.discardItem') {
      return undefined;
    }
    const itemId = readItemId(input);
    const item =
      this.#snapshot.state === 'active' ||
      this.#snapshot.state === 'stale' ||
      this.#snapshot.state === 'refreshing'
        ? this.#snapshot.session.items.find((candidate) => candidate.itemId === itemId)
        : undefined;
    const discard = vscode.l10n.t('Discard Changes');
    const selected = await vscode.window.showWarningMessage(
      vscode.l10n.t(
        'Discard all working tree changes in {0}? This cannot be undone.',
        item?.path ?? '',
      ),
      { modal: true },
      discard,
    );
    return selected === discard
      ? undefined
      : {
          ok: false,
          error: {
            code: 'cancelled',
            message: vscode.l10n.t('Discard changes was cancelled.'),
            retryable: false,
          },
        };
  }

  private handleToolResult(command: ToolCommandId, result: ToolResult<unknown>): void {
    if (
      result.ok &&
      isSnapshotCommand(command) &&
      isGitReviewSessionSnapshot(result.data)
    ) {
      this.#snapshot = result.data;
      this.onSnapshot(result.data);
    }
  }

  private disposePanel(): void {
    this.#disposeListener?.dispose();
    this.#disposeListener = undefined;
    this.#messages?.dispose();
    this.#messages = undefined;
    this.#panel?.dispose();
    this.#panel = undefined;
  }

  private handlePanelDisposed(): void {
    this.#disposeListener?.dispose();
    this.#disposeListener = undefined;
    this.#messages?.dispose();
    this.#messages = undefined;
    this.#panel = undefined;
  }
}

function readItemId(input: unknown): string | undefined {
  return typeof input === 'object' && input !== null && 'itemId' in input
    ? String(input.itemId)
    : undefined;
}

function isSnapshotCommand(command: ToolCommandId): boolean {
  return (
    command === 'gitReview.stageItem' ||
    command === 'gitReview.unstageItem' ||
    command === 'gitReview.discardItem' ||
    command === 'gitReview.markReviewedAndNext' ||
    command === 'gitReview.refresh'
  );
}
