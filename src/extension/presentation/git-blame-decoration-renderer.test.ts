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
  it('渲染固定宽度的日期作者列、窄 heat 色条和独立提交高亮', () => {
    const renderer = new GitBlameDecorationRenderer();

    renderer.render(
      { key: 'file:///repo/main.ts', version: 1, lineCount: 2 },
      [line(1, 'A', 'a'), line(2, '张三', 'b')],
      config(),
      undefined,
    );

    expect(vscodeState.createdTypes).toHaveLength(2);
    expect(decorationOptions(0).isWholeLine).toBe(true);
    const annotationOptions = decorationOptions(1);
    expect(annotationOptions.rangeBehavior).toBe(0);
    expect((annotationOptions.before as Record<string, unknown>).color).toBeInstanceOf(
      vscodeState.ThemeColor,
    );
    const decorations = renderedAnnotations();
    expect(decorations).toHaveLength(2);
    expect(decorations[0]!.renderOptions.before.contentText).toContain('A');
    expect(decorations[1]!.renderOptions.before.contentText).toContain('张三');
    expect(decorations[0]!.renderOptions.before.width).toBe(
      decorations[1]!.renderOptions.before.width,
    );
    expect(decorations[0]!.renderOptions.before.contentText).toContain('\u258c');
    expect(decorations[0]!.renderOptions.before.color).toMatch(/^hsl\(/u);
    expect(decorations[0]!.renderOptions.before.backgroundColor).toMatch(/^hsl\(/u);
  });

  it('合并连续提交文字，并让未提交行继续占用同一注解列宽', () => {
    const renderer = new GitBlameDecorationRenderer();

    renderer.render(
      { key: 'file:///repo/main.ts', version: 2, lineCount: 3 },
      [line(1, 'wta', 'a'), line(2, 'wta', 'a'), line(3, '', '0')],
      config({ mergeCommitLines: true }),
      undefined,
    );

    const decorations = renderedAnnotations();
    expect(decorations[0]!.renderOptions.before.contentText.trim()).not.toBe('');
    expect(decorations[1]!.renderOptions.before.contentText.trim()).toBe('\u258c');
    expect(decorations[2]!.renderOptions.before.contentText.trim()).toBe('');
    expect(new Set(decorations.map((item) => item.renderOptions.before.width))).toEqual(
      new Set([decorations[0]!.renderOptions.before.width]),
    );
    expect(decorations[2]!.renderOptions.before.contentText).not.toContain('\u258c');
    expect(decorations[2]!.renderOptions.before.backgroundColor).toBeUndefined();
  });
});

function config(
  overrides: Partial<{
    readonly mergeCommitLines: boolean;
  }> = {},
): {
  readonly highlightCurrentCommit: boolean;
  readonly ignoreWhitespace: boolean;
  readonly maxLines: number;
  readonly dateFormatStyle: 'Y/M/D';
  readonly authorNameStyle: 'full';
  readonly showCommitNumber: boolean;
  readonly mergeCommitLines: boolean;
} {
  return {
    highlightCurrentCommit: false,
    ignoreWhitespace: false,
    maxLines: 20_000,
    dateFormatStyle: 'Y/M/D',
    authorNameStyle: 'full',
    showCommitNumber: false,
    mergeCommitLines: false,
    ...overrides,
  };
}

type DecorationLike = {
  readonly renderOptions: {
    readonly before: {
      readonly contentText: string;
      readonly width: string;
      readonly color?: string;
      readonly backgroundColor?: string;
    };
  };
};

function decorationOptions(index: number): Record<string, unknown> {
  const resource = vscodeState.createdTypes[index];
  if (resource === undefined) throw new Error('测试缺少装饰器资源。');
  return resource.options;
}

function renderedAnnotations(): readonly DecorationLike[] {
  const annotationType = vscodeState.createdTypes[1];
  if (annotationType === undefined) throw new Error('测试缺少注解装饰器。');
  const call = vscodeState.setDecorations.mock.calls.find(
    ([type]) => type === annotationType,
  );
  if (call === undefined) throw new Error('测试没有渲染注解。');
  return call[1] as readonly DecorationLike[];
}

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
