import { describe, expect, it } from 'vitest';
import {
  isExecutableGitResource,
  isFullCommitHash,
  isGitReference,
  isRepositoryRelativePath,
} from './git-blame-model';

describe('Git Blame public input validation', () => {
  it('accepts executable resources while rejecting traversal and relative roots', () => {
    expect(
      isExecutableGitResource({
        repositoryRoot: '/workspace/repo',
        relativePath: 'src/main.ts',
      }),
    ).toBe(true);
    expect(
      isExecutableGitResource({
        repositoryRoot: 'workspace/repo',
        relativePath: '../secret.txt',
      }),
    ).toBe(false);
    expect(isRepositoryRelativePath('/src/main.ts')).toBe(false);
    expect(isRepositoryRelativePath('src/../main.ts')).toBe(false);
  });

  it('accepts full SHA-1 and SHA-256 hashes only', () => {
    expect(isFullCommitHash('a'.repeat(40))).toBe(true);
    expect(isFullCommitHash('B'.repeat(64))).toBe(true);
    expect(isFullCommitHash('a'.repeat(39))).toBe(false);
    expect(isFullCommitHash(`-${'a'.repeat(39)}`)).toBe(false);
  });

  it('accepts safe refs and rejects option injection or revision traversal syntax', () => {
    expect(isGitReference('HEAD')).toBe(true);
    expect(isGitReference('refs/heads/feature')).toBe(true);
    expect(isGitReference('-c')).toBe(false);
    expect(isGitReference('main..secret')).toBe(false);
    expect(isGitReference('main@{1}')).toBe(false);
    expect(isGitReference('main lock')).toBe(false);
  });
});
