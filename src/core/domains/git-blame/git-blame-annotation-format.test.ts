import { describe, expect, it } from 'vitest';
import {
  formatGitBlameAnnotations,
  measureDisplayWidth,
} from './git-blame-annotation-format';
import type { GitBlameLine } from './git-blame-model';

describe('formatGitBlameAnnotations', () => {
  it('按本地时区输出零填充的日期、小时和分钟并截断作者显示宽度', () => {
    const annotations = formatGitBlameAnnotations(
      [line(1, 'Alice Zhang', localEpoch(2023, 10, 14, 7, 8, 45))],
      {
        dateFormatStyle: 'YYYY-MM-DD HH:mm',
        authorNameStyle: 'first',
        mergeCommitLines: false,
        nowEpochSeconds: 1_800_000_000,
        maxAuthorWidth: 8,
      },
    );

    expect(annotations[0]?.text).toBe('2023-11-14 07:08 Alice');
  });

  it('merges only the primary text of consecutive commit lines', () => {
    const commit = 'a'.repeat(40);
    const annotations = formatGitBlameAnnotations(
      [line(1, '张三', 1_700_000_000, commit), line(2, '张三', 1_700_000_000, commit)],
      {
        dateFormatStyle: 'Y/M/D',
        authorNameStyle: 'full',
        mergeCommitLines: true,
        nowEpochSeconds: 1_800_000_000,
        maxAuthorWidth: 8,
      },
    );

    expect(annotations[0]?.text).not.toBe('');
    expect(annotations[1]?.text).toBe('');
    expect(annotations[1]?.commit).toBe(commit);
  });

  it('为单提交和多提交行生成稳定的前景与淡背景配色', () => {
    const first = line(1, 'A', 1_700_000_000, 'a'.repeat(40));
    const second = line(2, 'B', 1_750_000_000, 'b'.repeat(40));
    const config = {
      dateFormatStyle: 'relative' as const,
      authorNameStyle: 'full' as const,
      mergeCommitLines: false,
      nowEpochSeconds: 1_800_000_000,
      maxAuthorWidth: 8,
    };

    const single = formatGitBlameAnnotations([first], config)[0];
    expect(single?.heatColor).toMatch(/^hsl\(/u);
    expect(single?.heatBackgroundColor).toMatch(/\/ 14%\)$/u);
    const annotations = formatGitBlameAnnotations([first, second], config);
    expect(annotations[0]?.heatColor).toMatch(/^hsl\(/u);
    expect(annotations[0]?.heatColor).not.toBe(annotations[1]?.heatColor);
    expect(annotations[0]?.heatBackgroundColor).not.toBe(
      annotations[1]?.heatBackgroundColor,
    );
    const uncommitted = formatGitBlameAnnotations(
      [line(1, 'Not Committed Yet', 1_800_000_000, '0'.repeat(40))],
      config,
    )[0];
    expect(uncommitted?.heatColor).toBeUndefined();
    expect(uncommitted?.heatBackgroundColor).toBeUndefined();
  });

  it('measures CJK and combining graphemes by display width', () => {
    expect(measureDisplayWidth('张三')).toBe(4);
    expect(measureDisplayWidth('e\u0301')).toBe(1);
  });
});

function line(
  lineNumber: number,
  author: string,
  authoredAt: number,
  commit = 'a'.repeat(40),
): GitBlameLine {
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
