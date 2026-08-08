import { describe, expect, it } from 'vitest';
import type { GitHistoricalDocument } from '../../core/domains/git-blame/public-api';
import {
  GitRepositoryTokenRegistry,
  decodeHistoricalDocumentUri,
  encodeHistoricalDocumentUri,
} from './git-historical-document-uri';

describe('Historical Document URI', () => {
  it('round-trips a descriptor without exposing the repository root', () => {
    const registry = new GitRepositoryTokenRegistry(
      () => '11111111-1111-4111-8111-111111111111',
    );
    const descriptor = document();
    const uri = encodeHistoricalDocumentUri(
      registry.register(descriptor.resource),
      descriptor,
    );

    expect(uri.startsWith('vscode-toolbox-namewta-git://')).toBe(true);
    expect(uri).not.toContain('/private/repository');
    expect(decodeHistoricalDocumentUri(uri, registry)).toEqual(descriptor);
  });

  it.each([
    'vscode-toolbox-namewta-git://missing/bad/path',
    'vscode-toolbox-namewta-git://token/ref/path?leak=true',
    'file://token/ref/path',
  ])('rejects malformed or non-owned URIs', (uri) => {
    const registry = new GitRepositoryTokenRegistry(() => 'token');
    expect(() => decodeHistoricalDocumentUri(uri, registry)).toThrowError();
  });
});

function document(): GitHistoricalDocument {
  return {
    resource: {
      repositoryRoot: '/private/repository',
      relativePath: 'src/main.ts',
    },
    ref: 'a'.repeat(40),
    path: 'src/main.ts',
  };
}
