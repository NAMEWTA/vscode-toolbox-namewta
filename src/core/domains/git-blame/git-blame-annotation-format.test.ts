import { describe, expect, it } from 'vitest';
import type { GitBlameLine } from './git-blame-model';
import {
  formatGitBlameAnnotations,
  measureDisplayWidth,
} from './git-blame-annotation-format';

describe('formatGitBlameAnnotations', () => {
  it('按本地时间格式化固定日期与作者列，并按显示宽度截断 CJK 名称', () => {
    const annotations = formatGitBlameAnnotations(
      [
        line(1, 'Alice Zhang', localEpoch(2023, 10, 14, 7, 8, 45)),
        line(2, '非常非常长的作者名', localEpoch(2023, 10, 15, 8, 9, 0), 'b'),
      ],
      config({ dateFormatStyle: 'YYYY-MM-DD HH:mm', authorNameStyle: 'first' }),
    );

    expect(annotations[0]?.text.trim()).toBe('2023-11-14 07:08 Alice');
    expect(measureDisplayWidth(annotations[0]?.text ?? '')).toBe(
      measureDisplayWidth(annotations[1]?.text ?? ''),
    );
    expect(annotations[1]?.text).toContain('非…');
  });

  it('只清空连续同提交块的后续文本，同时保留稳定 heat 色条', () => {
    const commit = 'a'.repeat(40);
    const annotations = formatGitBlameAnnotations(
      [line(1, '张三', 1_700_000_000, commit), line(2, '张三', 1_700_000_000, commit)],
      config({ mergeCommitLines: true }),
    );

    expect(annotations[0]?.text).not.toBe('');
    expect(annotations[1]?.text).toBe('');
    expect(annotations[0]?.heatColor).toMatch(/^hsl\(/u);
    expect(annotations[1]?.heatColor).toBe(annotations[0]?.heatColor);
  });

  it('按文件 revision number 宽度右对齐，并让未提交行保持空文本', () => {
    const annotations = formatGitBlameAnnotations(
      [
        { ...line(1, 'Alice', 1_700_000_000, 'a'), revisionNumber: 2 },
        { ...line(2, 'Bob', 1_700_000_000, 'b'), revisionNumber: 14 },
        line(3, 'Not Committed Yet', 1_700_000_000, '0'),
      ],
      config({ showCommitNumber: true }),
    );

    expect(annotations[0]?.text).toMatch(/\u20072$/u);
    expect(annotations[1]?.text).toMatch(/14$/u);
    expect(annotations[2]).toMatchObject({ text: '' });
    expect(annotations[2]?.heatColor).toBeUndefined();
  });

  it('按终端显示宽度识别 CJK 和组合字符', () => {
    expect(measureDisplayWidth('张三')).toBe(4);
    expect(measureDisplayWidth('e\u0301')).toBe(1);
  });
});

function config(
  overrides: Partial<Parameters<typeof formatGitBlameAnnotations>[1]> = {},
): Parameters<typeof formatGitBlameAnnotations>[1] {
  return {
    dateFormatStyle: 'Y/M/D',
    authorNameStyle: 'full',
    showCommitNumber: false,
    mergeCommitLines: false,
    nowEpochSeconds: 1_800_000_000,
    maxAuthorWidth: 8,
    ...overrides,
  };
}

function line(
  lineNumber: number,
  author: string,
  authoredAt: number,
  commitCharacter = 'a',
): GitBlameLine {
  const commit =
    commitCharacter.length === 1 ? commitCharacter.repeat(40) : commitCharacter;
  return {
    line: lineNumber,
    commit,
    author,
    email: 'author@example.com',
    authoredAt,
    summary: 'summary',
  };
}

function localEpoch(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): number {
  return Math.floor(new Date(year, month, day, hour, minute, second).getTime() / 1_000);
}
