import { describe, expect, it } from 'vitest';
import { parseGitBlamePorcelain } from './git-blame-parser';

const firstHash = 'a'.repeat(40);
const secondHash = 'b'.repeat(40);

describe('parseGitBlamePorcelain', () => {
  it('parses ordered line metadata including parent and original path', () => {
    const output = [
      `${firstHash} 3 1 1`,
      'author 张三',
      'author-mail <zhang@example.com>',
      'author-time 1700000000',
      'summary 初始提交',
      'filename src/old.ts',
      '\texport const first = 1;',
      `${secondHash} 8 2 1`,
      'author Alice',
      'author-mail <alice@example.com>',
      'author-time 1700000100',
      'summary rename file',
      `previous ${firstHash} src/old.ts`,
      'filename src/main.ts',
      '\texport const second = 2;',
      '',
    ].join('\n');

    expect(parseGitBlamePorcelain(output)).toEqual([
      {
        line: 1,
        commit: firstHash,
        author: '张三',
        email: 'zhang@example.com',
        authoredAt: 1_700_000_000,
        summary: '初始提交',
        originalPath: 'src/old.ts',
        originalLine: 3,
      },
      {
        line: 2,
        commit: secondHash,
        author: 'Alice',
        email: 'alice@example.com',
        authoredAt: 1_700_000_100,
        summary: 'rename file',
        originalPath: 'src/main.ts',
        originalLine: 8,
        parentCommit: firstHash,
      },
    ]);
  });

  it.each([
    [`${firstHash} 1 2 1\nauthor A\n\tline\n`, 'non-contiguous line'],
    [`${firstHash} 1 1 1\nauthor A\n\tline\n`, 'missing metadata'],
    [`short 1 1 1\nauthor A\n\tline\n`, 'invalid hash'],
  ])('fails closed for %s', (output) => {
    expect(() => parseGitBlamePorcelain(output)).toThrowError();
  });
});
