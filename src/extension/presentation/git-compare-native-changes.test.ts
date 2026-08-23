import { describe, expect, it } from 'vitest';
import type { GitCompareResult } from '../../core/domains/git-compare/public-api';
import { createGitCompareNativeChanges } from './git-compare-native-changes';

const base = 'a'.repeat(40);
const target = 'b'.repeat(40);

describe('Git compare native changes', () => {
  it('maps added, deleted, renamed and special files to native resource sides', () => {
    const resources = createGitCompareNativeChanges('/repo', result());

    expect(resources).toEqual([
      {
        labelPath: 'added.ts',
        modified: {
          kind: 'revision',
          input: { repositoryRoot: '/repo', ref: target, path: 'added.ts' },
        },
      },
      {
        labelPath: 'deleted.ts',
        original: {
          kind: 'revision',
          input: { repositoryRoot: '/repo', ref: base, path: 'deleted.ts' },
        },
      },
      {
        labelPath: 'new-name.ts',
        original: {
          kind: 'revision',
          input: { repositoryRoot: '/repo', ref: base, path: 'old-name.ts' },
        },
        modified: {
          kind: 'revision',
          input: { repositoryRoot: '/repo', ref: target, path: 'new-name.ts' },
        },
      },
      {
        labelPath: 'binary.dat',
        original: {
          kind: 'summary',
          endpoint: base,
          path: 'binary.dat',
          status: 'modified',
          contentKind: 'binary',
        },
        modified: {
          kind: 'summary',
          endpoint: target,
          path: 'binary.dat',
          status: 'modified',
          contentKind: 'binary',
        },
      },
    ]);
  });
});

function result(): GitCompareResult {
  return {
    base,
    target,
    changes: [
      { status: 'added', path: 'added.ts', contentKind: 'text' },
      { status: 'deleted', path: 'deleted.ts', contentKind: 'text' },
      {
        status: 'renamed',
        path: 'new-name.ts',
        previousPath: 'old-name.ts',
        contentKind: 'text',
      },
      { status: 'modified', path: 'binary.dat', contentKind: 'binary' },
    ],
    stats: { files: 4, additions: 8, deletions: 3 },
  };
}
