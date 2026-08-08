import { describe, expect, it } from 'vitest';
import {
  formatGitBlameAnnotations,
  measureDisplayWidth,
} from './git-blame-annotation-format';
import type { GitBlameLine } from './git-blame-model';

describe('formatGitBlameAnnotations', () => {
  it('formats date and author styles with display-width truncation', () => {
    const annotations = formatGitBlameAnnotations(
      [line(1, 'Alice Zhang', 1_700_000_000)],
      {
        dateFormatStyle: 'YYYY-MM-DD',
        authorNameStyle: 'first',
        mergeCommitLines: false,
        nowEpochSeconds: 1_800_000_000,
        maxAuthorWidth: 8,
      },
    );

    expect(annotations[0]?.text).toBe('2023-11-14 Alice');
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

  it('omits heat for a single commit and assigns stable heat for multiple commits', () => {
    const first = line(1, 'A', 1_700_000_000, 'a'.repeat(40));
    const second = line(2, 'B', 1_750_000_000, 'b'.repeat(40));
    const config = {
      dateFormatStyle: 'relative' as const,
      authorNameStyle: 'full' as const,
      mergeCommitLines: false,
      nowEpochSeconds: 1_800_000_000,
      maxAuthorWidth: 8,
    };

    expect(formatGitBlameAnnotations([first], config)[0]?.heatColor).toBeUndefined();
    const annotations = formatGitBlameAnnotations([first, second], config);
    expect(annotations[0]?.heatColor).toMatch(/^hsl\(/u);
    expect(annotations[0]?.heatColor).not.toBe(annotations[1]?.heatColor);
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
