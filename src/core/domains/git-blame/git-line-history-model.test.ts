import { describe, expect, it } from 'vitest';
import {
  decodeGitLineHistoryCursor,
  encodeGitLineHistoryCursor,
  type GitLineHistoryCursorState,
} from './git-line-history-model';

const state: GitLineHistoryCursorState = {
  resourceHash: 'deadbeef',
  origin: { ref: 'HEAD', path: 'src/历史.ts', line: 7 },
  current: { ref: 'a'.repeat(40), path: 'src/旧文件.ts', line: 5 },
  visited: ['1234abcd', '90abcdef'],
};

describe('Git line history cursor', () => {
  it('round-trips Unicode paths as an opaque validated value', () => {
    const cursor = encodeGitLineHistoryCursor(state);

    expect(cursor).toMatch(/^[A-Za-z\d_-]+\.[a-f\d]{8}$/u);
    expect(decodeGitLineHistoryCursor(cursor)).toEqual(state);
  });

  it('rejects tampered and structurally invalid cursor values', () => {
    const cursor = encodeGitLineHistoryCursor(state);
    const replacement = cursor.startsWith('A') ? 'B' : 'A';

    expect(() =>
      decodeGitLineHistoryCursor(`${replacement}${cursor.slice(1)}`),
    ).toThrowError();
    expect(() => decodeGitLineHistoryCursor('not-a-cursor')).toThrowError();
  });
});
