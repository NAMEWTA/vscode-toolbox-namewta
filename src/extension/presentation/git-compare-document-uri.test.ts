import { describe, expect, it } from 'vitest';
import { GitCompareDocumentStore } from './git-compare-document-uri';

describe('GitCompareDocumentStore', () => {
  it('stores revision and summary entries behind opaque URIs', () => {
    const tokens = ['token-1', 'token-2'];
    const store = new GitCompareDocumentStore(() => tokens.shift() ?? 'unexpected');
    const revision = {
      repositoryRoot: '/repo',
      ref: 'a'.repeat(40),
      path: 'src/feature file.ts',
    };
    const uri = store.createRevisionUri(revision);
    expect(uri).not.toContain('/repo');
    expect(uri).toBe(
      'vscode-toolbox-namewta-git-compare://token-1/src/feature%20file.ts',
    );
    expect(store.resolve(uri)).toEqual({ kind: 'revision', input: revision });
    const summaryUri = store.createSummaryUri('binary', 'assets/logo.bin');
    expect(summaryUri).toBe(
      'vscode-toolbox-namewta-git-compare://token-2/assets/logo.bin',
    );
    expect(store.resolve(summaryUri)).toEqual({ kind: 'summary', summary: 'binary' });
  });

  it('rejects tampered, malformed and cleared URIs', () => {
    const store = new GitCompareDocumentStore(() => 'token-1');
    const uri = store.createSummaryUri('summary', 'src/main.ts');
    expect(() => store.resolve(uri.replace('token-1', 'other'))).toThrow();
    expect(() => store.resolve(uri.replace('/src/main.ts', '/src/other.ts'))).toThrow();
    store.clear();
    expect(() => store.resolve(uri)).toThrow();
    expect(() => store.createSummaryUri('', 'src/main.ts')).toThrow();
    expect(() => store.createSummaryUri('summary', '../outside.ts')).toThrow();
    expect(() =>
      store.createRevisionUri({
        repositoryRoot: '/repo',
        ref: 'short',
        path: 'main.ts',
      }),
    ).toThrow();
  });

  it('rejects tokens that URL host normalization would change', () => {
    const store = new GitCompareDocumentStore(() => 'Token-Uppercase');

    expect(() =>
      store.createRevisionUri({
        repositoryRoot: '/repo',
        ref: 'a'.repeat(40),
        path: 'src/main.ts',
      }),
    ).toThrow();
  });
});
