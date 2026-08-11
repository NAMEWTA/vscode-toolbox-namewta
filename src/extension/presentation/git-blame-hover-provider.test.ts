import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitBlameLineIdentity } from './git-blame-annotation-controller';

vi.mock('vscode', () => {
  class MarkdownString {
    public value = '';
    public isTrusted: boolean | { readonly enabledCommands: readonly string[] } = false;
    public supportHtml = false;
    public appendMarkdown(value: string): MarkdownString {
      this.value += value;
      return this;
    }
  }
  return {
    MarkdownString,
    Hover: class Hover {
      public constructor(public readonly contents: MarkdownString) {}
    },
    l10n: {
      t: (message: string, ...args: readonly unknown[]) =>
        args.reduce<string>(
          (result, value, index) => result.replace(`{${String(index)}}`, String(value)),
          message,
        ),
    },
  };
});

import {
  GIT_BLAME_HOVER_COMMAND_IDS,
  buildGitBlameHoverMarkdown,
} from './git-blame-hover-provider';

const now = 1_700_003_600;

describe('buildGitBlameHoverMarkdown', () => {
  beforeEach(() => vi.useRealTimers());

  it('renders complete escaped metadata and only the internal command allowlist', () => {
    const markdown = buildGitBlameHoverMarkdown(identity(), now);

    expect(markdown.value).toContain('Alice \\*Admin\\*');
    expect(markdown.value).toContain('alice@example\\.com');
    expect(markdown.value).toContain('a'.repeat(40));
    expect(markdown.value).toContain('1 hour ago');
    expect(markdown.value).toMatch(/\b\d{4}\\-\d{2}\\-\d{2} \d{2}:\d{2}\b/u);
    expect(markdown.value).toContain('Fix \\[parser\\]');
    expect(markdown.value).toContain('https://github.com/owner/repo/commit/');
    expect(markdown.isTrusted).toEqual({
      enabledCommands: Object.values(GIT_BLAME_HOVER_COMMAND_IDS),
    });
  });

  it('hides only the external action for unsafe remotes', () => {
    const markdown = buildGitBlameHoverMarkdown(
      identity('https://user:secret@github.com/owner/repo.git'),
      now,
    );

    expect(markdown.value).not.toContain('user:secret');
    expect(markdown.value).not.toContain('Open Remote Commit');
    expect(markdown.value).toContain('Copy Commit Hash');
    expect(markdown.supportHtml).toBe(false);
  });
});

function identity(remoteUrl = 'git@github.com:owner/repo.git'): GitBlameLineIdentity {
  return {
    documentKey: 'file:///repo/main.ts',
    documentVersion: 3,
    generation: 7,
    remoteUrl,
    blame: {
      line: 2,
      commit: 'a'.repeat(40),
      author: 'Alice *Admin*',
      email: 'alice@example.com',
      authoredAt: 1_700_000_000,
      summary: 'Fix [parser]',
      originalPath: 'main.ts',
      originalLine: 2,
      parentCommit: 'b'.repeat(40),
    },
  };
}
