import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitBlameLine } from '../../core/domains/git-blame/public-api';
import { GitBlameDecorationRenderer } from './git-blame-decoration-renderer';

const vscodeState = vi.hoisted(() => {
  class Range {
    public constructor(
      public readonly startLine: number,
      public readonly startCharacter: number,
      public readonly endLine: number,
      public readonly endCharacter: number,
    ) {}
  }

  class ThemeColor {
    public constructor(public readonly id: string) {}
  }

  return {
    Range,
    ThemeColor,
    createdTypes: [] as {
      readonly options: Record<string, unknown>;
      readonly dispose: ReturnType<typeof vi.fn>;
    }[],
    createTextEditorDecorationType: vi.fn(),
    setDecorations:
      vi.fn<(decorationType: unknown, decorations: readonly unknown[]) => void>(),
    visibleTextEditors: [] as unknown[],
  };
});

vi.mock('vscode', () => ({
  DecorationRangeBehavior: { OpenOpen: 0 },
  Range: vscodeState.Range,
  ThemeColor: vscodeState.ThemeColor,
  window: {
    createTextEditorDecorationType: vscodeState.createTextEditorDecorationType,
    get visibleTextEditors(): readonly unknown[] {
      return vscodeState.visibleTextEditors;
    },
  },
}));

beforeEach(() => {
  vscodeState.createdTypes.splice(0);
  vscodeState.setDecorations.mockReset();
  vscodeState.createTextEditorDecorationType.mockImplementation(
    (options: Record<string, unknown>) => {
      const type = { options, dispose: vi.fn() };
      vscodeState.createdTypes.push(type);
      return type;
    },
  );
  vscodeState.visibleTextEditors = [
    {
      document: { uri: { toString: (): string => 'file:///repo/main.ts' } },
      setDecorations: vscodeState.setDecorations,
    },
  ];
});

describe('Git Blame 装饰渲染器', () => {
  it('只渲染整行背景高亮，不向源码插入 Blame 文字', () => {
    const renderer = new GitBlameDecorationRenderer();

    renderer.render(
      { key: 'file:///repo/main.ts', version: 1, lineCount: 2 },
      [line(1, 'A', 'a'), line(2, '张三', 'b')],
      {
        highlightCurrentCommit: false,
        ignoreWhitespace: false,
        maxLines: 20_000,
      },
      undefined,
    );

    expect(vscodeState.createdTypes).toHaveLength(1);
    expect(vscodeState.createdTypes[0]?.options).toEqual(
      expect.objectContaining({ isWholeLine: true }),
    );
    expect(Object.keys(vscodeState.createdTypes[0]?.options ?? {})).toEqual([
      'isWholeLine',
      'backgroundColor',
    ]);
  });

  it('未提交行不产生任何 fake gutter decoration', () => {
    const renderer = new GitBlameDecorationRenderer();

    renderer.render(
      { key: 'file:///repo/main.ts', version: 2, lineCount: 2 },
      [line(1, 'wta', 'a'), line(2, '', '0')],
      {
        highlightCurrentCommit: false,
        ignoreWhitespace: false,
        maxLines: 20_000,
      },
      undefined,
    );

    expect(vscodeState.createdTypes).toHaveLength(1);
    expect(vscodeState.setDecorations).toHaveBeenCalledWith(expect.anything(), []);
  });
});

function line(lineNumber: number, author: string, hash: string): GitBlameLine {
  return {
    line: lineNumber,
    commit: hash.repeat(40),
    author,
    email: `${author}@example.com`,
    authoredAt: 1_700_000_000,
    summary: 'summary',
  };
}
