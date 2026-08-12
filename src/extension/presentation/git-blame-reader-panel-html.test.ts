import { describe, expect, it } from 'vitest';
import { buildGitBlameReaderModel } from '../../core/domains/git-blame/public-api';
import {
  createGitBlameReaderPanelHtml,
  type GitBlameReaderWebviewStrings,
} from './git-blame-reader-panel-html';

describe('Git Blame Reader Panel HTML', () => {
  it('uses a nonce CSP and serializes source text without creating markup', () => {
    const html = createGitBlameReaderPanelHtml(
      {
        cspSource: 'vscode-webview://reader',
      } as never,
      {
        scriptUri: uri('vscode-webview://reader/git-blame-reader.js'),
        styleUri: uri('vscode-webview://reader/git-blame-reader.css'),
        model: model(),
        language: 'zh-cn',
        title: 'Reader <main.ts>',
        strings: strings(),
      },
    );
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('<html lang="zh-cn"');
    expect(html).toMatch(/script-src 'nonce-[^']+'/u);
    expect(html).toContain('Reader &lt;main.ts&gt;');
    expect(html).toContain(String.raw`const value = \u003cscript\u003e;`);
    expect(html).not.toContain('const value = <script>;');
  });
});

function model(): ReturnType<typeof buildGitBlameReaderModel> {
  return buildGitBlameReaderModel({
    sourceUri: 'file:///repo/main.ts',
    resource: { repositoryRoot: '/repo', relativePath: 'main.ts' },
    revision: 'HEAD',
    documentVersion: 1,
    generation: 1,
    sourceLine: 1,
    sourceText: 'const value = <script>;',
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
}

function uri(value: string): never {
  return { toString: (): string => value } as never;
}

function strings(): GitBlameReaderWebviewStrings {
  return {
    title: 'Git Blame Reader',
    search: 'Search source',
    logicalLines: 'Git blame logical lines',
    refresh: 'Refresh',
    copyActions: 'Copy actions',
    copyCode: 'Copy Code',
    copyLineWithBlame: 'Copy Line With Blame',
    copyCommitSha: 'Copy Commit SHA',
    copyCommitInfo: 'Copy Commit Info',
    copyBlockCode: 'Copy Block Code',
    copyBlockWithBlame: 'Copy Block With Blame',
    copyAllCode: 'Copy All Code',
    copyAllWithBlame: 'Copy All With Blame',
    lines: '{0} lines',
    matches: '{0} match(es)',
    noMatches: 'No matches',
    workingTree: 'Working Tree',
    uncommitted: 'Uncommitted',
  } as const;
}
