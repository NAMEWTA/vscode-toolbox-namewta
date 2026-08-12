import { describe, expect, it } from 'vitest';
import type { GitBlameReaderBlock } from '../../core/domains/git-blame/public-api';
import { formatGitBlameReaderCommitDetail } from './git-blame-reader-commit-detail';

describe('formatGitBlameReaderCommitDetail', () => {
  it('includes the full hash, author identity, authored date and summary', () => {
    expect(formatGitBlameReaderCommitDetail(block())).toBe(
      `${'a'.repeat(40)}\nAlice <alice@example.com>\n2023-11-14T22:13:20.000Z\nInitial import`,
    );
  });
});

function block(): GitBlameReaderBlock {
  return {
    blockId: 'block-1-aaaaaaaaaaaa',
    startLine: 1,
    endLine: 1,
    commit: 'a'.repeat(40),
    kind: 'committed',
    author: 'Alice',
    email: 'alice@example.com',
    authoredAt: 1_700_000_000,
    summary: 'Initial import',
    lines: [],
  };
}
