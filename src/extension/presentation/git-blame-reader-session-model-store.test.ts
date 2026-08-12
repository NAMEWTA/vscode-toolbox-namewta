import { describe, expect, it } from 'vitest';
import { buildGitBlameReaderModel } from '../../core/domains/git-blame/public-api';
import { GitBlameReaderSessionModelStore } from './git-blame-reader-session-model-store';

describe('GitBlameReaderSessionModelStore', () => {
  it('exposes only the current generation and clears it conditionally', () => {
    const store = new GitBlameReaderSessionModelStore();
    const model = buildGitBlameReaderModel({
      sourceUri: 'file:///repo/main.ts',
      resource: { repositoryRoot: '/repo', relativePath: 'main.ts' },
      revision: 'HEAD',
      documentVersion: 1,
      generation: 2,
      sourceLine: 1,
      sourceText: 'source',
      blameLines: [
        {
          line: 1,
          commit: 'a'.repeat(40),
          author: 'Alice',
          email: 'alice@example.com',
          authoredAt: 1_700_000_000,
          summary: 'Initial',
        },
      ],
    });
    store.set(model);
    expect(store.get(1)).toBeUndefined();
    expect(store.get(2)).toBe(model);
    store.clear(1);
    expect(store.get(2)).toBe(model);
    store.clear(2);
    expect(store.get(2)).toBeUndefined();
  });
});
