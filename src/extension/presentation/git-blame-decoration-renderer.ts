import * as vscode from 'vscode';
import {
  formatGitBlameAnnotations,
  measureDisplayWidth,
  type GitBlameLine,
} from '../../core/domains/git-blame/public-api';
import type {
  GitBlameAnnotationRenderer,
  GitBlameConfiguration,
  GitBlameDocumentSnapshot,
} from './git-blame-annotation-controller';

type DocumentDecorationResources = {
  readonly highlight: vscode.TextEditorDecorationType;
  readonly annotation: vscode.TextEditorDecorationType;
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
    const annotations = createAnnotationDecorations(document, lines, config);
    const highlight = createHighlightRanges(lines, highlightedLine, config);
    for (const editor of editors) {
      editor.setDecorations(resources.highlight, highlight);
      editor.setDecorations(resources.annotation, annotations);
    }
  }

  public clear(documentKey: string): void {
    const resources = this.#resources.get(documentKey);
    if (resources === undefined) {
      return;
    }
    for (const editor of resources.editors) {
      editor.setDecorations(resources.highlight, []);
      editor.setDecorations(resources.annotation, []);
    }
    resources.highlight.dispose();
    resources.annotation.dispose();
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
        editor.setDecorations(resources.annotation, []);
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
    annotation: vscode.window.createTextEditorDecorationType({
      before: {
        color: new vscode.ThemeColor('list.deemphasizedForeground'),
        height: '100%',
        margin: '0',
        fontWeight: 'normal',
        fontStyle: 'normal',
      },
      rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
    }),
    editors: new Set(),
  };
}

function createAnnotationDecorations(
  document: GitBlameDocumentSnapshot,
  lines: readonly GitBlameLine[],
  config: GitBlameConfiguration,
): readonly vscode.DecorationOptions[] {
  const formatted = formatGitBlameAnnotations(lines, {
    ...config,
    nowEpochSeconds: Math.floor(Date.now() / 1_000),
    maxAuthorWidth: 18,
  });
  const width =
    Math.max(0, ...formatted.map(({ text }) => measureDisplayWidth(text))) + 4;
  const byLine = new Map(formatted.map((item) => [item.line, item]));
  return Array.from({ length: document.lineCount }, (_, index) => {
    const item = byLine.get(index + 1);
    return {
      range: lineStartRange(index + 1),
      renderOptions: {
        before: {
          contentText:
            item?.heatColor === undefined
              ? `\u2007${item?.text ?? ''}\u2007\u2007\u2007`
              : `\u2007${item.text}\u2007\u258c\u2007`,
          width: `${width}ch`,
          ...(item?.heatColor === undefined ? {} : { color: item.heatColor }),
          ...(item?.heatBackgroundColor === undefined
            ? {}
            : { backgroundColor: item.heatBackgroundColor }),
        },
      },
    };
  });
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

function lineStartRange(line: number): vscode.Range {
  return new vscode.Range(line - 1, 0, line - 1, 0);
}
