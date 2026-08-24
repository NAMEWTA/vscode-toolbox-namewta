import { describe, expect, it } from 'vitest';
import type { GitBlameReaderBlock } from '../../core/domains/git-blame/public-api';
import { createReaderCommitColorMap } from './reader-commit-color';

describe('Reader commit color map', () => {
  it('为首次相邻出现的提交分配高间隔色槽，并让重复提交复用原色', () => {
    const commits = ['a'.repeat(40), 'b'.repeat(40), 'c'.repeat(40), 'd'.repeat(40)];
    const colors = createReaderCommitColorMap([
      ...commits.map((commit, index) => block(commit, index + 1)),
      block(commits[0]!, 5),
    ]);

    expect(commits.map((commit) => colors.get(commit))).toEqual([0, 4, 2, 6]);
    expect(colors.get(commits[0]!)).toBe(0);
  });
});

function block(commit: string, line: number): GitBlameReaderBlock {
  return {
    blockId: `block-${line}-${commit.slice(0, 12)}`,
    startLine: line,
    endLine: line,
    commit,
    kind: 'committed',
    author: 'Alice',
    email: 'alice@example.com',
    authoredAt: 1_700_000_000,
    summary: 'Commit',
    lines: [],
  };
}
