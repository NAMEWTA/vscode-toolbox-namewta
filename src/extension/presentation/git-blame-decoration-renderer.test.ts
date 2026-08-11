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
  it('按最长显示文本设置紧凑列宽并覆盖完整提交色单元', () => {
    const renderer = new GitBlameDecorationRenderer();

    renderer.render(
      { key: 'file:///repo/main.ts', version: 1, lineCount: 2 },
      [line(1, 'A', 'a'), line(2, '张三', 'b')],
      {
        dateFormatStyle: 'Y/M/D',
        authorNameStyle: 'full',
        mergeCommitLines: false,
        highlightCurrentCommit: false,
        ignoreWhitespace: false,
        maxLines: 20_000,
      },
      undefined,
    );

    const typeBeforeOptions = vscodeState.createdTypes.flatMap(({ options }) =>
      isRecord(options.before) ? [options.before] : [],
    );
    expect(vscodeState.createdTypes).toHaveLength(2);
    expect(typeBeforeOptions.some(({ width }) => width === '22em')).toBe(false);
    const annotationType = vscodeState.createdTypes.find(
      ({ options }) => isRecord(options.before) && isRecord(options.after),
    );
    expect(annotationType?.options.before).toEqual(
      expect.objectContaining({ height: '100%', margin: '0' }),
    );
    expect(annotationType?.options.after).toEqual(
      expect.objectContaining({ width: '0.35em', height: '100%' }),
    );
    const decorationBeforeOptions = vscodeState.setDecorations.mock.calls.flatMap(
      ([, decorations]) =>
        decorations.flatMap((option) => {
          if (!isRecord(option) || !isRecord(option.renderOptions)) {
            return [];
          }
          const before = option.renderOptions.before;
          return isRecord(before) ? [before] : [];
        }),
    );
    expect(
      decorationBeforeOptions.some(
        ({ width, backgroundColor }) =>
          width === '16ch' &&
          typeof backgroundColor === 'string' &&
          backgroundColor.endsWith('/ 14%)'),
      ),
    ).toBe(true);
    const decorationAfterOptions = vscodeState.setDecorations.mock.calls.flatMap(
      ([, decorations]) =>
        decorations.flatMap((option) => {
          if (!isRecord(option) || !isRecord(option.renderOptions)) {
            return [];
          }
          const after = option.renderOptions.after;
          return isRecord(after) ? [after] : [];
        }),
    );
    expect(
      decorationAfterOptions.some(
        ({ backgroundColor, contentText }) =>
          contentText === ' ' && typeof backgroundColor === 'string',
      ),
    ).toBe(true);
  });

  it('为继续输入产生的未提交行保留同宽左侧列且不显示伪造日期', () => {
    const renderer = new GitBlameDecorationRenderer();

    renderer.render(
      { key: 'file:///repo/main.ts', version: 2, lineCount: 2 },
      [line(1, 'wta', 'a'), line(2, '', '0')],
      {
        dateFormatStyle: 'Y/M/D',
        authorNameStyle: 'full',
        mergeCommitLines: false,
        highlightCurrentCommit: false,
        ignoreWhitespace: false,
        maxLines: 20_000,
      },
      undefined,
    );

    const decorationCalls = vscodeState.setDecorations.mock
      .calls as unknown as readonly (readonly [unknown, readonly unknown[]])[];
    const annotationOptions = decorationCalls
      .map(([, decorations]) => decorations)
      .find((decorations) => decorations.length === 2);
    const committed = readBeforeDecoration(annotationOptions?.[0]);
    const uncommitted = readBeforeDecoration(annotationOptions?.[1]);
    expect(typeof committed?.contentText).toBe('string');
    expect(committed?.width).toBe('15ch');
    expect(uncommitted?.contentText).toBe('');
    expect(uncommitted?.width).toBe('15ch');
    expect(
      readAfterDecoration(annotationOptions?.[1])?.backgroundColor,
    ).toBeUndefined();
    const annotationCall = decorationCalls.find(([, decorations]) =>
      decorations.some((option) => {
        const value = readBeforeDecoration(option);
        return value?.contentText === '';
      }),
    );
    expect(
      annotationCall?.[1].every((option) => {
        const value = readAfterDecoration(option);
        return value?.contentText === ' ';
      }),
    ).toBe(true);
    expect(
      vscodeState.createdTypes.every(
        ({ options }) =>
          options.rangeBehavior === undefined || options.rangeBehavior === 0,
      ),
    ).toBe(true);
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBeforeDecoration(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value) || !isRecord(value.renderOptions)) {
    return undefined;
  }
  const before = value.renderOptions.before;
  return isRecord(before) ? before : undefined;
}

function readAfterDecoration(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value) || !isRecord(value.renderOptions)) {
    return undefined;
  }
  const after = value.renderOptions.after;
  return isRecord(after) ? after : undefined;
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
