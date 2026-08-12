/* eslint-disable max-lines */
import * as vscode from 'vscode';
import {
  createGitRemoteCommitUrl,
  GIT_EMPTY_TREE_HASH,
  type GitBlameReaderCopyFormat,
  type GitBlameReaderModel,
} from '../../core/domains/git-blame/public-api';
import type { GitBlameReaderWebviewAction } from '../../core/contracts';
import { ApplicationError } from '../../core/kernel/application-error';
import type { ToolboxGateway, ToolLogger } from '../../core/orchestration/public-api';
import { VscodeGitResourceAdapter } from '../adapters/vscode-git-resource-adapter';
import { GitCommandRunner } from '../adapters/git/git-command-runner';
import { VscodeWebviewMessageAdapter } from '../adapters/vscode-webview-message-adapter';
import {
  createGitBlameReaderPanelHtml,
  type GitBlameReaderWebviewStrings,
} from './git-blame-reader-panel-html';
import type { GitBlameReaderSessionModelStore } from './git-blame-reader-session-model-store';
import type { GitHistoricalDocumentProvider } from './git-historical-document-provider';
import { formatGitBlameReaderCommitDetail } from './git-blame-reader-commit-detail';

const VIEW_TYPE = 'vscodeToolboxNamewta.gitBlameReader';

export class GitBlameReaderController implements vscode.Disposable {
  #panel: vscode.WebviewPanel | undefined;
  #messages: VscodeWebviewMessageAdapter | undefined;
  #disposeListener: vscode.Disposable | undefined;
  readonly #sourceChangeListener: vscode.Disposable;
  readonly #sourceSaveListener: vscode.Disposable;
  #model: GitBlameReaderModel | undefined;
  #sourceUri: vscode.Uri | undefined;
  #generation = 0;
  #abort: AbortController | undefined;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly gateway: ToolboxGateway,
    private readonly logger: ToolLogger,
    private readonly models: GitBlameReaderSessionModelStore,
    private readonly historicalProvider: GitHistoricalDocumentProvider,
    private readonly resourceAdapter = new VscodeGitResourceAdapter(
      new GitCommandRunner(),
    ),
  ) {
    this.#sourceChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (
        this.#panel !== undefined &&
        this.#sourceUri?.toString(true) === event.document.uri.toString(true)
      ) {
        void this.postState(
          'stale',
          vscode.l10n.t('Source changed. Refresh to update blame.'),
        );
      }
    });
    this.#sourceSaveListener = vscode.workspace.onDidSaveTextDocument((document) => {
      if (
        this.#panel !== undefined &&
        this.#sourceUri?.toString(true) === document.uri.toString(true)
      )
        void this.load(document);
    });
  }

  public async open(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined || editor.document.uri.scheme !== 'file') {
      void vscode.window.showInformationMessage(
        vscode.l10n.t('Open a file before using Git Blame Reader.'),
      );
      return;
    }
    await this.load(editor.document, editor.selection.active.line + 1);
  }

  public dispose(): void {
    this.#sourceChangeListener.dispose();
    this.#sourceSaveListener.dispose();
    this.#abort?.abort();
    this.#messages?.dispose();
    this.#disposeListener?.dispose();
    this.#panel?.dispose();
    this.#messages = undefined;
    this.#disposeListener = undefined;
    this.#panel = undefined;
    this.#model = undefined;
    this.models.clear();
  }

  // eslint-disable-next-line complexity
  private async load(
    document: vscode.TextDocument,
    initialLine?: number,
  ): Promise<void> {
    this.#abort?.abort();
    const controller = new AbortController();
    this.#abort = controller;
    const generation = ++this.#generation;
    this.#sourceUri = document.uri;
    await this.postState('loading', vscode.l10n.t('Loading Git Blame Reader…'));
    const maxLines = vscode.workspace
      .getConfiguration('vscodeToolboxNamewta')
      .get<number>('gitBlame.maxLines', 20_000);
    try {
      const resource = await this.resourceAdapter.resolve(
        document.uri,
        controller.signal,
      );
      const result = await this.gateway.execute(
        'gitBlame.getReaderModel',
        {
          resource,
          sourceUri: document.uri.toString(true),
          revision: 'HEAD',
          documentVersion: document.version,
          lineCount: document.lineCount,
          ignoreWhitespace: vscode.workspace
            .getConfiguration('vscodeToolboxNamewta')
            .get<boolean>('gitBlame.ignoreWhitespace', false),
          maxLines,
          sourceText: document.getText(),
          generation,
          sourceLine: Math.min(
            document.lineCount,
            Math.max(1, initialLine ?? this.#model?.sourceLine ?? 1),
          ),
        },
        { signal: controller.signal, source: 'extension-command' },
      );
      if (controller.signal.aborted || generation !== this.#generation) return;
      if (!result.ok) {
        this.presentLoadError(result.error.code);
        return;
      }
      this.#model = result.data;
      this.models.set(result.data);
      this.openPanel();
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      this.logger.error('Git Blame Reader load failed.', error, { source: 'reader' });
      this.presentLoadError(
        error instanceof ApplicationError ? error.code : 'internal-error',
      );
    }
  }

  private openPanel(): void {
    const model = this.#model;
    if (model === undefined) return;
    if (this.#panel !== undefined) {
      this.#panel.title = createReaderTitle(model.resource.relativePath);
      this.#panel.reveal(vscode.ViewColumn.Active, true);
      void this.#panel.webview.postMessage({ type: 'gitBlameReader.model', model });
      return;
    }
    const root = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview');
    const readerTitle = createReaderTitle(model.resource.relativePath);
    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      readerTitle,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [root],
      },
    );
    panel.webview.html = createGitBlameReaderPanelHtml(panel.webview, {
      scriptUri: panel.webview.asWebviewUri(
        vscode.Uri.joinPath(root, 'git-blame-reader.js'),
      ),
      styleUri: panel.webview.asWebviewUri(
        vscode.Uri.joinPath(root, 'git-blame-reader.css'),
      ),
      model,
      language: vscode.env.language,
      title: readerTitle,
      strings: createReaderStrings(readerTitle),
    });
    this.#messages = new VscodeWebviewMessageAdapter(
      panel.webview,
      this.gateway,
      this.logger,
      {
        authorize: () =>
          Promise.resolve({
            ok: false,
            error: {
              code: 'permission-denied',
              message: 'Reader actions must use the typed Reader protocol.',
              retryable: false,
            },
          }),
        onGitBlameReaderAction: (message) => this.handleAction(message),
      },
    );
    this.#panel = panel;
    this.#disposeListener = panel.onDidDispose(() => {
      this.#disposeListener?.dispose();
      this.#messages?.dispose();
      this.#messages = undefined;
      this.#disposeListener = undefined;
      this.#panel = undefined;
      this.#abort?.abort();
      this.models.clear();
      this.#model = undefined;
      this.#sourceUri = undefined;
    });
  }

  // eslint-disable-next-line complexity, max-lines-per-function
  private async handleAction(message: GitBlameReaderWebviewAction): Promise<void> {
    const model = this.#model;
    if (model === undefined || message.generation !== model.generation) return;
    switch (message.type) {
      case 'gitBlameReader.openSource':
        await this.openSource(model, message.line);
        return;
      case 'gitBlameReader.refresh': {
        const document = vscode.workspace.textDocuments.find(
          (candidate) => candidate.uri.toString(true) === model.sourceUri,
        );
        if (document !== undefined) await this.load(document);
        return;
      }
      case 'gitBlameReader.copy':
        await this.copy(
          model,
          message.format as GitBlameReaderCopyFormat,
          message.line,
          message.blockId,
        );
        return;
      case 'gitBlameReader.commitDetail': {
        const block = model.blocks.find(
          (candidate) => candidate.blockId === message.blockId,
        );
        if (block !== undefined && block.kind === 'committed') {
          const action = await vscode.window.showInformationMessage(
            formatGitBlameReaderCommitDetail(block),
            vscode.l10n.t('Copy Commit SHA'),
            vscode.l10n.t('Copy Commit Info'),
            vscode.l10n.t('Open Commit'),
            vscode.l10n.t('Open Previous Revision'),
          );
          if (action === vscode.l10n.t('Copy Commit SHA')) {
            await this.copy(model, 'commit-sha', undefined, block.blockId);
          }
          if (action === vscode.l10n.t('Copy Commit Info')) {
            await this.copy(model, 'commit-info', undefined, block.blockId);
          }
          if (action === vscode.l10n.t('Open Commit')) {
            const remoteUrl = model.remoteUrl;
            const url =
              remoteUrl === undefined
                ? undefined
                : createGitRemoteCommitUrl(remoteUrl, block.commit);
            if (url !== undefined)
              await vscode.env.openExternal(vscode.Uri.parse(url, true));
          }
          if (action === vscode.l10n.t('Open Previous Revision')) {
            const first = block.lines[0]?.blame;
            if (first !== undefined) {
              await this.historicalProvider.openDiff(
                {
                  resource: model.resource,
                  ref: first.parentCommit ?? GIT_EMPTY_TREE_HASH,
                  path: first.originalPath ?? model.resource.relativePath,
                },
                {
                  resource: model.resource,
                  ref: first.commit,
                  path: first.originalPath ?? model.resource.relativePath,
                },
                `${first.commit.slice(0, 12)} · ${model.resource.relativePath}`,
              );
            }
          }
        }
        return;
      }
    }
  }

  private async openSource(model: GitBlameReaderModel, line: number): Promise<void> {
    if (line < 1 || line > model.lineCount) return;
    const document = await vscode.workspace.openTextDocument(
      vscode.Uri.parse(model.sourceUri, true),
    );
    const editor = await vscode.window.showTextDocument(
      document,
      vscode.ViewColumn.Active,
      false,
    );
    const position = new vscode.Position(line - 1, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(
      new vscode.Range(position, position),
      vscode.TextEditorRevealType.InCenter,
    );
  }

  private async copy(
    model: GitBlameReaderModel,
    format: GitBlameReaderCopyFormat,
    line?: number,
    blockId?: string,
  ): Promise<void> {
    const result = await this.gateway.execute(
      'gitBlame.copyReader',
      {
        generation: model.generation,
        format,
        ...(line === undefined ? {} : { line }),
        ...(blockId === undefined ? {} : { blockId }),
      },
      { source: 'webview' },
    );
    if (result.ok) {
      void this.#panel?.webview.postMessage({
        type: 'gitBlameReader.state',
        state: 'ready',
        generation: model.generation,
        message: vscode.l10n.t('Copied to clipboard.'),
      });
      return;
    }
    void this.#panel?.webview.postMessage({
      type: 'gitBlameReader.state',
      state: 'failed',
      generation: model.generation,
      message: result.error.message,
    });
  }

  private async postState(
    state: 'loading' | 'stale' | 'ready',
    message: string,
  ): Promise<void> {
    if (this.#panel !== undefined && this.#model !== undefined)
      await this.#panel.webview.postMessage({
        type: 'gitBlameReader.state',
        state,
        generation: this.#model.generation,
        message,
      });
  }

  private presentLoadError(
    code:
      | 'invalid-input'
      | 'capability-unavailable'
      | 'not-found'
      | 'permission-denied'
      | 'cancelled'
      | 'timeout'
      | 'internal-error',
  ): void {
    const permissionDenied = code === 'permission-denied';
    const unavailable = code === 'capability-unavailable' || code === 'not-found';
    const message = permissionDenied
      ? vscode.l10n.t('Git Blame Reader requires a trusted workspace.')
      : unavailable
        ? vscode.l10n.t('Git Blame Reader is unavailable for this file.')
        : vscode.l10n.t('Git Blame Reader could not be loaded.');
    void vscode.window.showErrorMessage(message);
    void this.#panel?.webview.postMessage({
      type: 'gitBlameReader.state',
      state: unavailable ? 'unavailable' : 'failed',
      generation: this.#model?.generation ?? this.#generation,
      message,
    });
  }
}

function createReaderStrings(title: string): GitBlameReaderWebviewStrings {
  return {
    title,
    search: vscode.l10n.t('Search source'),
    logicalLines: vscode.l10n.t('Git blame logical lines'),
    refresh: vscode.l10n.t('Refresh'),
    copyActions: vscode.l10n.t('Copy actions'),
    copyCode: vscode.l10n.t('Copy Code'),
    copyLineWithBlame: vscode.l10n.t('Copy Line With Blame'),
    copyCommitSha: vscode.l10n.t('Copy Commit SHA'),
    copyCommitInfo: vscode.l10n.t('Copy Commit Info'),
    copyBlockCode: vscode.l10n.t('Copy Block Code'),
    copyBlockWithBlame: vscode.l10n.t('Copy Block With Blame'),
    copyAllCode: vscode.l10n.t('Copy All Code'),
    copyAllWithBlame: vscode.l10n.t('Copy All With Blame'),
    lines: vscode.l10n.t('{0} lines'),
    matches: vscode.l10n.t('{0} match(es)'),
    noMatches: vscode.l10n.t('No matches'),
    workingTree: vscode.l10n.t('Working Tree'),
    uncommitted: vscode.l10n.t('Uncommitted'),
  };
}

function createReaderTitle(relativePath: string): string {
  return vscode.l10n.t('Git Blame Reader: {0}', relativePath);
}
