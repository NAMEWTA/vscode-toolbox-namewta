import { describe, expect, it } from 'vitest';
import {
  parseCommitLog,
  parseNumstat,
  parseRawChanges,
} from './git-compare-port-adapter';

describe('Git compare output parsers', () => {
  it('parses NUL-delimited commit metadata', () => {
    const sha = 'a'.repeat(40);
    const parent = 'b'.repeat(40);
    expect(
      parseCommitLog(
        [sha, parent, 'Alice', '2026-08-13T10:00:00+08:00', 'subject', ''].join('\0'),
      ),
    ).toEqual([
      {
        sha,
        parents: [parent],
        author: 'Alice',
        authoredAt: Date.parse('2026-08-13T10:00:00+08:00'),
        subject: 'subject',
      },
    ]);
  });

  it('parses rename records from raw diff output', () => {
    expect(
      parseRawChanges(
        ':100644 100644 aaaaaaa bbbbbbb R087\0old name.ts\0new name.ts\0',
      ),
    ).toEqual([
      {
        status: 'renamed',
        path: 'new name.ts',
        previousPath: 'old name.ts',
        oldMode: '100644',
        newMode: '100644',
      },
    ]);
  });

  it('parses binary numstat and preserves special paths', () => {
    expect(parseNumstat('-\t-\tassets/logo.png\0')).toEqual([
      { path: 'assets/logo.png', isBinary: true },
    ]);
    expect(parseNumstat('2\t1\tpath\twith-tab.ts\0')).toEqual([
      { path: 'path\twith-tab.ts', additions: 2, deletions: 1, isBinary: false },
    ]);
  });
});
