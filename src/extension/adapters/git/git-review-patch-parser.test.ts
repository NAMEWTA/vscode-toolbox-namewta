import { describe, expect, it } from 'vitest';
import {
  createUntrackedGitReviewPatch,
  parseGitReviewPatch,
} from './git-review-patch-parser';

describe('Git Review patch 解析器', () => {
  it('将 Git unified patch 转为带双侧行号的可序列化 hunk', () => {
    const patch = parseGitReviewPatch(
      [
        'diff --git a/main.ts b/main.ts',
        'index 1111111..2222222 100644',
        '--- a/main.ts',
        '+++ b/main.ts',
        '@@ -1,2 +1,2 @@',
        ' const value = 1;',
        '-old();',
        '+next();',
        '',
      ].join('\n'),
    );

    expect(patch).toEqual({
      kind: 'patch',
      additions: 1,
      deletions: 1,
      hunks: [
        {
          header: '@@ -1,2 +1,2 @@',
          oldStart: 1,
          oldLines: 2,
          newStart: 1,
          newLines: 2,
          lines: [
            { kind: 'context', oldLine: 1, newLine: 1, text: 'const value = 1;' },
            { kind: 'deletion', oldLine: 2, text: 'old();' },
            { kind: 'addition', newLine: 2, text: 'next();' },
          ],
        },
      ],
    });
  });

  it('将 untracked 文本构造成全新增 patch 并保留空行', () => {
    expect(createUntrackedGitReviewPatch('first\n\n')).toMatchObject({
      kind: 'patch',
      additions: 2,
      deletions: 0,
      hunks: [
        {
          oldStart: 0,
          newStart: 1,
          lines: [
            { kind: 'addition', newLine: 1, text: 'first' },
            { kind: 'addition', newLine: 2, text: '' },
          ],
        },
      ],
    });
  });
});
