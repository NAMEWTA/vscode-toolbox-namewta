import { describe, expect, it } from 'vitest';
import {
  GIT_COMPARE_EMPTY_TREE_HASH,
  isFullCommitHash,
  isGitCompareCursor,
  isGitCompareHistoryInput,
  isGitCompareInput,
  isGitCompareRepository,
  isGitCompareRevisionInput,
  isRepositoryRelativePath,
} from './git-compare-model';

const sha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);
const resource = { repositoryRoot: '/repo' };

describe('Git compare model guards', () => {
  it('accepts valid repository, history, comparison and revision inputs', () => {
    expect(isGitCompareRepository(resource)).toBe(true);
    expect(
      isGitCompareHistoryInput({ ...resource, limit: 100, cursor: `${sha}.100` }),
    ).toBe(true);
    expect(isGitCompareInput({ ...resource, base: sha, target: otherSha })).toBe(true);
    expect(
      isGitCompareRevisionInput({ ...resource, ref: sha, path: 'src/main.ts' }),
    ).toBe(true);
  });

  it('rejects malformed input shapes and unsafe paths', () => {
    expect(isGitCompareRepository({ repositoryRoot: 'relative' })).toBe(false);
    expect(isGitCompareHistoryInput({ ...resource, limit: 0 })).toBe(false);
    expect(isGitCompareHistoryInput({ ...resource, limit: 201 })).toBe(false);
    expect(
      isGitCompareHistoryInput({ ...resource, limit: 10, cursor: 'invalid' }),
    ).toBe(false);
    expect(isGitCompareInput({ ...resource, base: sha, target: 'short' })).toBe(false);
    expect(
      isGitCompareRevisionInput({ ...resource, ref: sha, path: '../secret' }),
    ).toBe(false);
    expect(isRepositoryRelativePath('/absolute')).toBe(false);
    expect(isRepositoryRelativePath('a\\b')).toBe(false);
    expect(isRepositoryRelativePath('a//b')).toBe(false);
    expect(isRepositoryRelativePath('a/./b')).toBe(false);
    expect(isRepositoryRelativePath('a/../b')).toBe(false);
    expect(isRepositoryRelativePath('')).toBe(false);
  });

  it('recognizes supported commit hashes and cursors', () => {
    expect(isFullCommitHash(sha)).toBe(true);
    expect(isFullCommitHash('c'.repeat(64))).toBe(true);
    expect(isFullCommitHash('not-a-hash')).toBe(false);
    expect(isGitCompareCursor(`${sha}.0`)).toBe(true);
    expect(isGitCompareCursor(`${sha}.123456789`)).toBe(true);
    expect(isGitCompareCursor(`${sha}.1234567890`)).toBe(false);
    expect(GIT_COMPARE_EMPTY_TREE_HASH).toHaveLength(40);
  });
});
