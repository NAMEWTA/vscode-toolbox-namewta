import { describe, expect, it, vi } from 'vitest';
import type { GitCommandPort } from '../../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';
import {
  GitComparePortAdapter,
  parseCommitLog,
  parseMatchingRefs,
  parseNumstat,
  parseRawChanges,
} from './git-compare-port-adapter';

describe('Git compare output parsers', () => {
  it('parses NUL-delimited commit metadata', () => {
    const sha = 'a'.repeat(40);
    const parent = 'b'.repeat(40);
    expect(
      parseCommitLog(
        [sha, parent, 'Alice', '2026-08-13T10:00:00+08:00', 'subject', ''].join('\0'),
      ),
    ).toEqual([
      {
        sha,
        parents: [parent],
        author: 'Alice',
        authoredAt: Date.parse('2026-08-13T10:00:00+08:00'),
        subject: 'subject',
      },
    ]);
  });

  it('parses rename records from raw diff output', () => {
    expect(
      parseRawChanges(
        ':100644 100644 aaaaaaa bbbbbbb R087\0old name.ts\0new name.ts\0',
      ),
    ).toEqual([
      {
        status: 'renamed',
        path: 'new name.ts',
        previousPath: 'old name.ts',
        oldMode: '100644',
        newMode: '100644',
      },
    ]);
  });

  it('parses binary numstat and preserves special paths', () => {
    expect(parseNumstat('-\t-\tassets/logo.png\0')).toEqual([
      { path: 'assets/logo.png', isBinary: true },
    ]);
    expect(parseNumstat('2\t1\tpath\twith-tab.ts\0')).toEqual([
      { path: 'path\twith-tab.ts', additions: 2, deletions: 1, isBinary: false },
    ]);
  });

  it('匹配本地、远端和 annotated tag ref，并使用 peeled commit', () => {
    const branch = 'a'.repeat(40);
    const tagObject = 'b'.repeat(40);
    const tagCommit = 'c'.repeat(40);
    const stdout = [
      branch,
      '',
      'feature/search',
      `\n${tagObject}`,
      tagCommit,
      'release/search-v2',
      '',
    ].join('\0');

    expect([...parseMatchingRefs(stdout, 'SEARCH')]).toEqual([
      [branch, ['feature/search']],
      [tagCommit, ['release/search-v2']],
    ]);
  });
});

describe('GitComparePortAdapter 全 refs 搜索', () => {
  it('优先返回 ref 命中并合并消息命中的重复 commit', async () => {
    const branchSha = 'a'.repeat(40);
    const messageSha = 'b'.repeat(40);
    const metadata = (sha: string, subject: string): string =>
      [sha, '', 'Alice', '2026-08-24T10:00:00+08:00', subject, ''].join('\0');
    const git = createGitPort([
      metadata(messageSha, 'feat: searchable message'),
      [branchSha, '', 'feature/searchable', ''].join('\0'),
      metadata(branchSha, 'branch head'),
    ]);
    const adapter = new GitComparePortAdapter(git, () => true);

    const result = await adapter.searchCommits(
      { repositoryRoot: '/repo', query: 'searchable', limit: 20 },
      { aborted: false },
    );

    expect(
      result.matches.map(({ commit, refs }) => ({
        sha: commit.sha,
        subject: commit.subject,
        refs,
      })),
    ).toEqual([
      { sha: branchSha, subject: 'branch head', refs: ['feature/searchable'] },
      {
        sha: messageSha,
        subject: 'feat: searchable message',
        refs: [],
      },
    ]);
    expect(git.run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        operation: 'compare-search-messages',
        args: expect.arrayContaining(['--all', '--grep=searchable']) as unknown,
      }),
    );
    expect(git.run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ operation: 'compare-search-refs' }),
    );
  });

  it('在调用 Git 前拒绝控制字符和越界查询', async () => {
    const git = createGitPort([]);
    const adapter = new GitComparePortAdapter(git, () => true);

    await expect(
      adapter.searchCommits(
        { repositoryRoot: '/repo', query: 'bad\nquery', limit: 20 },
        { aborted: false },
      ),
    ).rejects.toMatchObject({ code: 'invalid-input' });
    expect(git.run).not.toHaveBeenCalled();
  });
});

describe('GitComparePortAdapter revision resolution', () => {
  it('pins an abbreviated object id to a full commit before reading metadata', async () => {
    const sha = 'a'.repeat(40);
    const parent = 'b'.repeat(40);
    const git = createGitPort([
      `${sha}\n`,
      [sha, parent, 'Alice', '2026-08-23T10:00:00+08:00', 'subject', ''].join('\0'),
    ]);
    const adapter = new GitComparePortAdapter(git, () => true);

    await expect(
      adapter.resolveRevision(
        { repositoryRoot: '/repo', revision: 'A1b2' },
        { aborted: false },
      ),
    ).resolves.toEqual({
      sha,
      parents: [parent],
      author: 'Alice',
      authoredAt: Date.parse('2026-08-23T10:00:00+08:00'),
      subject: 'subject',
    });
    expect(git.run).toHaveBeenNthCalledWith(1, {
      operation: 'compare-resolve-revision',
      cwd: '/repo',
      args: ['rev-parse', '--verify', '--end-of-options', 'A1b2^{commit}'],
      signal: { aborted: false },
    });
    expect(git.run).toHaveBeenNthCalledWith(2, {
      operation: 'compare-revision-metadata',
      cwd: '/repo',
      args: [
        '--no-pager',
        'show',
        '-s',
        '--no-decorate',
        '--format=%H%x00%P%x00%an%x00%aI%x00%s%x00',
        sha,
      ],
      signal: { aborted: false },
    });
  });

  it('rejects invalid prefixes before invoking Git and maps unresolved objects', async () => {
    const git = createGitPort([]);
    const adapter = new GitComparePortAdapter(git, () => true);

    await expect(
      adapter.resolveRevision(
        { repositoryRoot: '/repo', revision: '--help' },
        { aborted: false },
      ),
    ).rejects.toMatchObject({ code: 'invalid-input' });
    expect(git.run).not.toHaveBeenCalled();

    git.run.mockRejectedValueOnce(
      new ApplicationError('Git operation failed.', {
        code: 'internal-error',
        details: { exitCode: 128 },
      }),
    );
    await expect(
      adapter.resolveRevision(
        { repositoryRoot: '/repo', revision: 'dead' },
        { aborted: false },
      ),
    ).rejects.toMatchObject({ code: 'not-found' });
  });
});

function createGitPort(outputs: readonly string[]): GitCommandPort & {
  readonly run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn<GitCommandPort['run']>();
  for (const stdout of outputs) {
    run.mockResolvedValueOnce({ stdout, stdoutBytes: stdout.length, stderrBytes: 0 });
  }
  return { run };
}
