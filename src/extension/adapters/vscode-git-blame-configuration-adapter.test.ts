import { beforeEach, describe, expect, it, vi } from 'vitest';

const vscodeState = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  getConfiguration: vi.fn(() => ({
    get: vi.fn((key: string, fallback?: unknown) =>
      vscodeState.values.has(key) ? vscodeState.values.get(key) : fallback,
    ),
  })),
}));

vi.mock('vscode', () => ({
  workspace: { getConfiguration: vscodeState.getConfiguration },
}));

import { VscodeGitBlameConfigurationAdapter } from './vscode-git-blame-configuration-adapter';

describe('VscodeGitBlameConfigurationAdapter', () => {
  beforeEach(() => vscodeState.values.clear());

  it('返回 Git Blame Annotations 的固定列默认配置', () => {
    const configuration = new VscodeGitBlameConfigurationAdapter().read();

    expect(configuration).toEqual({
      highlightCurrentCommit: false,
      ignoreWhitespace: false,
      maxLines: 20_000,
      dateFormatStyle: 'Y/M/D',
      authorNameStyle: 'full',
      showCommitNumber: false,
      mergeCommitLines: false,
    });
  });

  it('接受受支持的显示选项，并拒绝越界枚举和行数', () => {
    vscodeState.values.set('dateFormatStyle', 'YYYY-MM-DD HH:mm');
    vscodeState.values.set('authorNameStyle', 'last');
    vscodeState.values.set('showCommitNumber', true);
    vscodeState.values.set('mergeCommitLines', true);
    vscodeState.values.set('maxLines', 99);

    expect(new VscodeGitBlameConfigurationAdapter().read()).toMatchObject({
      dateFormatStyle: 'YYYY-MM-DD HH:mm',
      authorNameStyle: 'last',
      showCommitNumber: true,
      mergeCommitLines: true,
      maxLines: 20_000,
    });

    vscodeState.values.set('dateFormatStyle', 'invalid');
    vscodeState.values.set('authorNameStyle', 'nickname');
    expect(new VscodeGitBlameConfigurationAdapter().read()).toMatchObject({
      dateFormatStyle: 'Y/M/D',
      authorNameStyle: 'full',
    });
  });
});
