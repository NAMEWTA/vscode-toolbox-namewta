import { describe, expect, it } from 'vitest';
import { parseGitReviewBinaryNumstat } from './git-review-numstat-parser';

describe('Git Review numstat 解析器', () => {
  it('以 NUL 分隔格式保留普通和重命名二进制路径', () => {
    const output = [
      '-\t-\tbinary file.bin',
      '-\t-\t',
      'before binary.bin',
      'after binary.bin',
      '3\t1\ttext.ts',
      '',
    ].join('\0');

    expect(parseGitReviewBinaryNumstat(output)).toEqual(
      new Set(['binary file.bin', 'before binary.bin', 'after binary.bin']),
    );
  });

  it('拒绝畸形、截断和越界路径', () => {
    expect(() => parseGitReviewBinaryNumstat('-\t-\t../secret.bin\0')).toThrowError(
      /invalid/i,
    );
    expect(() => parseGitReviewBinaryNumstat('-\t-\t.git/config\0')).toThrowError(
      /invalid/i,
    );
    expect(() => parseGitReviewBinaryNumstat('-\t-\t\0only-before.bin\0')).toThrowError(
      /invalid/i,
    );
    expect(() => parseGitReviewBinaryNumstat('not-a-row\0')).toThrowError(/invalid/i);
    expect(() => parseGitReviewBinaryNumstat('-\t1\tbroken.bin\0')).toThrowError(
      /invalid/i,
    );
    expect(() => parseGitReviewBinaryNumstat('-\t-\tbinary.bin')).toThrowError(
      /invalid/i,
    );
  });
});
