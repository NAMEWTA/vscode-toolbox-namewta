import * as vscode from 'vscode';
import type { GitBlameLine } from '../../core/domains/git-blame/public-api';
import type {
  GitBlameAnnotationRenderer,
  GitBlameConfiguration,
  GitBlameDocumentSnapshot,
} from './git-blame-annotation-controller';

type DocumentDecorationResources = {
  readonly highlight: vscode.TextEditorDecorationType;
  editors: Set<vscode.TextEditor>;
};

export class GitBlameDecorationRenderer implements GitBlameAnnotationRenderer {
  readonly #resources = new Map<string, DocumentDecorationResources>();

  public render(
    document: GitBlameDocumentSnapshot,
    lines: readonly GitBlameLine[],
    config: GitBlameConfiguration,
    highlightedLine: number | undefined,
  ): void {
    const editors = vscode.window.visibleTextEditors.filter(
      (editor) => editor.document.uri.toString(true) === document.key,
    );
    const resources = this.#resources.get(document.key) ?? createResources();
    this.clearRemovedEditors(resources, editors);
    resources.editors = new Set(editors);
    this.#resources.set(document.key, resources);
    const highlight = createHighlightRanges(lines, highlightedLine, config);
    for (const editor of editors) {
      editor.setDecorations(resources.highlight, highlight);
    }
  }

  public clear(documentKey: string): void {
    const resources = this.#resources.get(documentKey);
    if (resources === undefined) {
      return;
    }
    for (const editor of resources.editors) {
      editor.setDecorations(resources.highlight, []);
    }
    resources.highlight.dispose();
    this.#resources.delete(documentKey);
  }

  public dispose(): void {
    for (const key of [...this.#resources.keys()]) {
      this.clear(key);
    }
  }

  private clearRemovedEditors(
    resources: DocumentDecorationResources,
    currentEditors: readonly vscode.TextEditor[],
  ): void {
    const current = new Set(currentEditors);
    for (const editor of resources.editors) {
      if (!current.has(editor)) {
        editor.setDecorations(resources.highlight, []);
      }
    }
  }
}

function createResources(): DocumentDecorationResources {
  return {
    highlight: vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: new vscode.ThemeColor('editor.wordHighlightBackground'),
    }),
    editors: new Set(),
  };
}

function createHighlightRanges(
  lines: readonly GitBlameLine[],
  highlightedLine: number | undefined,
  config: GitBlameConfiguration,
): readonly vscode.Range[] {
  if (!config.highlightCurrentCommit || highlightedLine === undefined) {
    return [];
  }
  const commit = lines.find(({ line }) => line === highlightedLine)?.commit;
  if (commit === undefined || /^0+$/u.test(commit)) {
    return [];
  }
  return lines
    .filter((line) => line.commit === commit)
    .map((line) => new vscode.Range(line.line - 1, 0, line.line - 1, 0));
}
