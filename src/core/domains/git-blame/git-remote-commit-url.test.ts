import { describe, expect, it } from 'vitest';
import { createGitRemoteCommitUrl } from './git-remote-commit-url';

const commit = 'a'.repeat(40);

describe('createGitRemoteCommitUrl', () => {
  it.each([
    ['git@github.com:owner/repo.git', `https://github.com/owner/repo/commit/${commit}`],
    [
      'ssh://git@gitlab.com/group/team/repo.git',
      `https://gitlab.com/group/team/repo/-/commit/${commit}`,
    ],
    [
      'https://bitbucket.org/owner/repo.git',
      `https://bitbucket.org/owner/repo/commits/${commit}`,
    ],
    ['http://gitee.com/owner/repo', `https://gitee.com/owner/repo/commit/${commit}`],
  ])(
    'converts supported remotes to credential-free HTTPS links',
    (remote, expected) => {
      expect(createGitRemoteCommitUrl(remote, commit)).toBe(expected);
    },
  );

  it.each([
    'https://user:secret@github.com/owner/repo.git',
    'git@unknown.example:owner/repo.git',
    'file:///repo',
    'https://github.com/owner',
    'https://github.com/owner/repo.git?token=secret',
  ])('hides unsupported or unsafe remote %s', (remote) => {
    expect(createGitRemoteCommitUrl(remote, commit)).toBeUndefined();
  });

  it('rejects abbreviated and malformed commit hashes', () => {
    expect(createGitRemoteCommitUrl('git@github.com:owner/repo.git', 'abc')).toBe(
      undefined,
    );
  });
});
