import * as vscode from 'vscode';
import {
  formatGitBlameAnnotations,
  measureDisplayWidth,
} from '../../core/domains/git-blame/git-blame-annotation-format';
import type { GitBlameLine } from '../../core/domains/git-blame/public-api';
import type {
  GitBlameAnnotationRenderer,
  GitBlameConfiguration,
  GitBlameDocumentSnapshot,
} from './git-blame-annotation-controller';

type DocumentDecorationResources = {
  readonly annotation: vscode.TextEditorDecorationType;
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
    const formatted = formatGitBlameAnnotations(lines, {
      ...config,
      nowEpochSeconds: Math.floor(Date.now() / 1_000),
      maxAuthorWidth: 18,
    });
    const annotationWidth =
      Math.max(0, ...formatted.map(({ text }) => measureDisplayWidth(text))) + 1;
    const formattedByLine = new Map(formatted.map((item) => [item.line, item]));
    const annotations = Array.from({ length: document.lineCount }, (_, index) => {
      const item = formattedByLine.get(index + 1);
      return decoration(
        index + 1,
        item?.text ?? '',
        annotationWidth,
        item?.heatBackgroundColor,
        item?.heatColor,
      );
    });
    const highlight = createHighlightRanges(lines, highlightedLine, config);
    for (const editor of editors) {
      editor.setDecorations(resources.annotation, annotations);
      editor.setDecorations(resources.highlight, highlight);
    }
  }

  public clear(documentKey: string): void {
    const resources = this.#resources.get(documentKey);
    if (resources === undefined) {
      return;
    }
    for (const editor of resources.editors) {
      editor.setDecorations(resources.annotation, []);
      editor.setDecorations(resources.highlight, []);
    }
    resources.annotation.dispose();
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
        editor.setDecorations(resources.annotation, []);
        editor.setDecorations(resources.highlight, []);
      }
    }
  }
}

function createResources(): DocumentDecorationResources {
  const annotation = vscode.window.createTextEditorDecorationType({
    before: {
      color: new vscode.ThemeColor('git.blame.editorDecorationForeground'),
      height: '100%',
      margin: '0',
    },
    // 同一零宽 range 上统一渲染文本和色条，避免多个 decoration type 的排序竞争。
    after: {
      height: '100%',
      margin: '0 0.75em 0 0',
      width: '0.35em',
    },
    rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
  });
  return {
    annotation,
    highlight: vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: new vscode.ThemeColor('editor.wordHighlightBackground'),
    }),
    editors: new Set(),
  };
}

function decoration(
  line: number,
  text: string,
  width: number,
  backgroundColor: string | undefined,
  heatColor: string | undefined,
): vscode.DecorationOptions {
  return {
    range: lineStartRange(line),
    renderOptions: {
      before: {
        contentText: text,
        width: `${width}ch`,
        ...(backgroundColor === undefined ? {} : { backgroundColor }),
      },
      after: {
        contentText: ' ',
        ...(heatColor === undefined ? {} : { backgroundColor: heatColor }),
      },
    },
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

function lineStartRange(line: number): vscode.Range {
  return new vscode.Range(line - 1, 0, line - 1, 0);
}
