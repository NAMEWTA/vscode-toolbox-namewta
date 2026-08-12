import { describe, expect, it, vi } from 'vitest';

const vscodeState = vi.hoisted(() => ({
  getConfiguration: vi.fn(() => ({
    get: vi.fn((_key: string, fallback?: unknown) => fallback),
  })),
}));

vi.mock('vscode', () => ({
  workspace: { getConfiguration: vscodeState.getConfiguration },
}));

import { VscodeGitBlameConfigurationAdapter } from './vscode-git-blame-configuration-adapter';

describe('VscodeGitBlameConfigurationAdapter', () => {
  it('returns the non-layout Git Blame defaults', () => {
    const configuration = new VscodeGitBlameConfigurationAdapter().read();

    expect(configuration).toEqual({
      highlightCurrentCommit: false,
      ignoreWhitespace: false,
      maxLines: 20_000,
    });
  });
});
