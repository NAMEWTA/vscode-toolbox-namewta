import * as vscode from 'vscode';
import type { GitBlameLineChange } from '../../core/domains/git-blame/public-api';
import type { VscodeGitBlameConfigurationAdapter } from '../adapters/vscode-git-blame-configuration-adapter';
import type {
  GitBlameAnnotationController,
  GitBlameDocumentSnapshot,
} from '../presentation/git-blame-annotation-controller';

export type GitBlameVisibilityMode = 'toggle' | 'show' | 'hide' | 'refresh';

const COMMAND_IDS: Readonly<Record<GitBlameVisibilityMode, string>> = {
  toggle: 'vscodeToolboxNamewta.gitBlame.toggle',
  show: 'vscodeToolboxNamewta.gitBlame.show',
  hide: 'vscodeToolboxNamewta.gitBlame.hide',
  refresh: 'vscodeToolboxNamewta.gitBlame.refresh',
};

export class GitBlameVisibilityHost implements vscode.Disposable {
  readonly #disposables: vscode.Disposable[];

  public constructor(
    private readonly controller: GitBlameAnnotationController,
    private readonly configuration: VscodeGitBlameConfigurationAdapter,
  ) {
    this.#disposables = [
      vscode.workspace.onDidCloseTextDocument((document) =>
        this.controller.hide(document.uri.toString(true)),
      ),
      vscode.workspace.onDidSaveTextDocument(
        (document) => void this.refreshDocument(document),
      ),
      vscode.workspace.onDidChangeTextDocument((event) =>
        this.controller.applyContentChanges(
          event.document.uri.toString(true),
          event.contentChanges.map(snapshotChange),
          event.document.version,
          event.document.lineCount,
        ),
      ),
      vscode.workspace.onDidChangeConfiguration((event) =>
        this.handleConfiguration(event),
      ),
      vscode.window.onDidChangeVisibleTextEditors(() => this.rerenderTracked()),
      vscode.window.onDidChangeTextEditorSelection((event) =>
        this.controller.rerender(
          event.textEditor.document.uri.toString(true),
          event.selections[0]?.active.line === undefined
            ? undefined
            : event.selections[0].active.line + 1,
        ),
      ),
    ];
  }

  public async execute(mode: GitBlameVisibilityMode): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
      void vscode.window.showInformationMessage(
        vscode.l10n.t('Open a file before using Git Blame.'),
      );
      return;
    }
    const key = editor.document.uri.toString(true);
    if (
      mode === 'hide' ||
      (mode === 'toggle' && this.controller.getState(key) !== 'disabled')
    ) {
      this.controller.hide(key);
      return;
    }
    await this.controller.show(snapshot(editor.document), this.configuration.read());
    this.rerenderAtActiveCursor(key);
  }

  public dispose(): void {
    for (const disposable of this.#disposables.splice(0)) {
      disposable.dispose();
    }
    this.controller.dispose();
  }

  private async refreshDocument(document: vscode.TextDocument): Promise<void> {
    if (this.controller.getState(document.uri.toString(true)) !== 'disabled') {
      await this.controller.show(snapshot(document), this.configuration.read());
      this.rerenderAtActiveCursor(document.uri.toString(true));
    }
  }

  private handleConfiguration(event: vscode.ConfigurationChangeEvent): void {
    if (!event.affectsConfiguration('vscodeToolboxNamewta.gitBlame')) {
      return;
    }
    for (const key of this.controller.getTrackedDocumentKeys()) {
      const document = vscode.workspace.textDocuments.find(
        (candidate) => candidate.uri.toString(true) === key,
      );
      if (document !== undefined) {
        void this.refreshDocument(document);
      }
    }
  }

  private rerenderTracked(): void {
    for (const key of this.controller.getTrackedDocumentKeys()) {
      this.rerenderAtActiveCursor(key);
    }
  }

  private rerenderAtActiveCursor(documentKey: string): void {
    const editor = vscode.window.activeTextEditor;
    const highlightedLine =
      editor?.document.uri.toString(true) === documentKey
        ? editor.selection.active.line + 1
        : undefined;
    this.controller.rerender(documentKey, highlightedLine);
  }
}

export class GitBlameVisibilityCommand {
  public readonly id: string;

  public constructor(
    private readonly mode: GitBlameVisibilityMode,
    private readonly host: GitBlameVisibilityHost,
  ) {
    this.id = COMMAND_IDS[mode];
  }

  public execute(): Promise<void> {
    return this.host.execute(this.mode);
  }
}

function snapshot(document: vscode.TextDocument): GitBlameDocumentSnapshot {
  return {
    key: document.uri.toString(true),
    version: document.version,
    lineCount: document.lineCount,
  };
}

function snapshotChange(
  change: vscode.TextDocumentContentChangeEvent,
): GitBlameLineChange {
  return {
    startLine: change.range.start.line,
    endLine: change.range.end.line,
    startCharacter: change.range.start.character,
    endCharacter: change.range.end.character,
    insertedLineBreakCount: change.text.match(/\n/gu)?.length ?? 0,
    insertedTextLength: change.text.length,
    insertedTextEndsWithLineBreak: change.text.endsWith('\n'),
  };
}
