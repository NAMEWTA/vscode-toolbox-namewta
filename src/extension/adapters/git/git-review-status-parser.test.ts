import { describe, expect, it } from 'vitest';
import { sep } from 'node:path';
import { parseGitReviewStatus } from './git-review-status-parser';

const head = 'a'.repeat(40);
const index = 'b'.repeat(40);

describe('Git Review 状态解析器', () => {
  it('以 NUL 分隔格式保留特殊路径并合并 staged 与 unstaged 状态', () => {
    const output = [
      `1 MM N... 100644 100644 100644 ${head} ${index} src/space name.ts`,
      `2 R. N... 100644 100644 100644 ${head} ${index} R100 renamed name.ts`,
      'before rename.ts',
      `1 .M S... 160000 160000 160000 ${head} ${index} vendor/module`,
      '? draft\nname.ts',
      '? unicode/éclair.ts',
      '! ignored.txt',
      '',
    ].join('\0');

    const entries = parseGitReviewStatus(output);

    expect(entries).toMatchObject([
      {
        path: 'src/space name.ts',
        change: 'modified',
        presentation: 'text',
      },
      {
        path: 'renamed name.ts',
        previousPath: 'before rename.ts',
        change: 'renamed',
        presentation: 'text',
      },
      {
        path: 'vendor/module',
        change: 'modified',
        presentation: 'submodule',
      },
      {
        path: 'draft\nname.ts',
        change: 'untracked',
        presentation: 'text',
      },
      {
        path: 'unicode/éclair.ts',
        change: 'untracked',
        presentation: 'text',
      },
    ]);
    expect(entries.every((entry) => entry.identityMaterial.length > 0)).toBe(true);
  });

  it('拒绝冲突、畸形记录和越界路径，避免静默遗漏审核项', () => {
    expect(() =>
      parseGitReviewStatus(
        'u UU N... 100644 100644 100644 100644 100644 100644 path\0',
      ),
    ).toThrowError(/invalid/i);
    expect(() => parseGitReviewStatus(`? ../secret.txt\0`)).toThrowError(/invalid/i);
    expect(() => parseGitReviewStatus(`? .git/config\0`)).toThrowError(/invalid/i);
    expect(() => parseGitReviewStatus(`! ../ignored.txt\0`)).toThrowError(/invalid/i);
    expect(() => parseGitReviewStatus(`1 M. N... 100644\0`)).toThrowError(/invalid/i);
    expect(() => parseGitReviewStatus(`? missing-terminator`)).toThrowError(/invalid/i);
  });

  it('在宿主文件系统允许时保留字面反斜杠路径', () => {
    const output = '? literal\\backslash.ts\0';

    if (sep === '\\') {
      expect(() => parseGitReviewStatus(output)).toThrowError(/invalid/i);
      return;
    }

    expect(parseGitReviewStatus(output)).toMatchObject([
      { path: 'literal\\backslash.ts', change: 'untracked' },
    ]);
  });

  it('完整保留大列表中的每个 NUL 分隔变更', () => {
    const paths = Array.from(
      { length: 1_024 },
      (_, index) => `generated/${String(index).padStart(4, '0')}.ts`,
    );
    const output = `${paths.map((path) => `? ${path}`).join('\0')}\0`;

    const entries = parseGitReviewStatus(output);

    expect(entries).toHaveLength(paths.length);
    expect(entries.map((entry) => entry.path)).toEqual(paths);
  });
});
