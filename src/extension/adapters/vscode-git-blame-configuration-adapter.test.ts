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
  it('defaults blame dates to local year-month-day and minute precision', () => {
    const configuration = new VscodeGitBlameConfigurationAdapter().read();

    expect(configuration.dateFormatStyle).toBe('YYYY-MM-DD HH:mm');
  });
});
