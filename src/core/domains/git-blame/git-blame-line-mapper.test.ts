import { describe, expect, it } from 'vitest';
import { mapGitBlameLines, type GitBlameLineChange } from './git-blame-line-mapper';
import type { GitBlameLine } from './git-blame-model';

describe('mapGitBlameLines', () => {
  it('inserts complete new lines while preserving the shifted original line', () => {
    const result = mapGitBlameLines(
      lines(3),
      [
        change({
          startLine: 1,
          endLine: 1,
          startCharacter: 0,
          endCharacter: 0,
          insertedLineBreakCount: 2,
          insertedTextLength: 8,
          insertedTextEndsWithLineBreak: true,
        }),
      ],
      5,
    );

    expect(result.map(({ commit }) => commit[0])).toEqual(['a', '0', '0', 'b', 'c']);
    expect(result.map(({ line }) => line)).toEqual([1, 2, 3, 4, 5]);
  });

  it('deletes complete lines without invalidating the following original line', () => {
    const result = mapGitBlameLines(
      lines(4),
      [
        change({
          startLine: 1,
          endLine: 3,
          startCharacter: 0,
          endCharacter: 0,
          insertedTextLength: 0,
        }),
      ],
      2,
    );

    expect(result.map(({ commit }) => commit[0])).toEqual(['a', 'd']);
  });

  it('marks an edited line uncommitted without changing unaffected ownership', () => {
    const result = mapGitBlameLines(
      lines(3),
      [
        change({
          startLine: 1,
          endLine: 1,
          startCharacter: 2,
          endCharacter: 4,
          insertedTextLength: 3,
        }),
      ],
      3,
    );

    expect(result.map(({ commit }) => commit[0])).toEqual(['a', '0', 'c']);
  });

  it('fails closed when change snapshots cannot produce the current line count', () => {
    const result = mapGitBlameLines(lines(3), [], 5);

    expect(result).toHaveLength(5);
    expect(result.every(({ commit }) => /^0+$/u.test(commit))).toBe(true);
  });
});

function lines(count: number): readonly GitBlameLine[] {
  return Array.from({ length: count }, (_, index) => ({
    line: index + 1,
    commit: String.fromCharCode(97 + index).repeat(40),
    author: `Author ${index}`,
    email: `author-${index}@example.com`,
    authoredAt: 1_700_000_000 + index,
    summary: `commit ${index}`,
  }));
}

function change(overrides: Partial<GitBlameLineChange>): GitBlameLineChange {
  return {
    startLine: 0,
    endLine: 0,
    startCharacter: 0,
    endCharacter: 0,
    insertedLineBreakCount: 0,
    insertedTextLength: 0,
    insertedTextEndsWithLineBreak: false,
    ...overrides,
  };
}
