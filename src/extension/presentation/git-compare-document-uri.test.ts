import { describe, expect, it } from 'vitest';
import { GitCompareDocumentStore } from './git-compare-document-uri';

describe('GitCompareDocumentStore', () => {
  it('stores revision and summary entries behind opaque URIs', () => {
    const store = new GitCompareDocumentStore(() => 'token-1');
    const revision = {
      repositoryRoot: '/repo',
      ref: 'a'.repeat(40),
      path: 'src/main.ts',
    };
    const uri = store.createRevisionUri(revision);
    expect(uri).not.toContain('/repo');
    expect(store.resolve(uri)).toEqual({ kind: 'revision', input: revision });
    const summaryUri = store.createSummaryUri('binary');
    expect(store.resolve(summaryUri)).toEqual({ kind: 'summary', summary: 'binary' });
  });

  it('rejects tampered, malformed and cleared URIs', () => {
    const store = new GitCompareDocumentStore(() => 'token-1');
    const uri = store.createSummaryUri('summary');
    expect(() => store.resolve(uri.replace('token-1', 'other'))).toThrow();
    expect(() => store.resolve(uri.replace('/summary', '/unknown'))).toThrow();
    store.clear();
    expect(() => store.resolve(uri)).toThrow();
    expect(() => store.createSummaryUri('')).toThrow();
    expect(() =>
      store.createRevisionUri({
        repositoryRoot: '/repo',
        ref: 'short',
        path: 'main.ts',
      }),
    ).toThrow();
  });
});
