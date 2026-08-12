import { describe, expect, it, vi } from 'vitest';
import type { GitCommandPort } from '../../../core/domains/git-blame/public-api';
import { GitResourceResolver } from './git-resource-resolver';

describe('GitResourceResolver', () => {
  it('rejects restricted workspaces before invoking Git', async () => {
    const git = createGitPort();
    const resolver = new GitResourceResolver(git);

    await expect(
      resolver.resolve({
        isWorkspaceTrusted: false,
        scheme: 'file',
        filePath: '/workspace/repo/main.ts',
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(git.run).not.toHaveBeenCalled();
  });

  it('rejects virtual resources before invoking Git', async () => {
    const git = createGitPort();
    const resolver = new GitResourceResolver(git);

    await expect(
      resolver.resolve({
        isWorkspaceTrusted: true,
        scheme: 'memfs',
        filePath: '/workspace/repo/main.ts',
      }),
    ).rejects.toMatchObject({ code: 'capability-unavailable' });
    expect(git.run).not.toHaveBeenCalled();
  });

  it('resolves the nearest repository root and a normalized relative path', async () => {
    const git = createGitPort('/workspace/repo\n');
    const resolver = new GitResourceResolver(git, (filePath) =>
      Promise.resolve(filePath),
    );

    await expect(
      resolver.resolve({
        isWorkspaceTrusted: true,
        scheme: 'file',
        filePath: '/workspace/repo/src/main.ts',
      }),
    ).resolves.toEqual({
      repositoryRoot: '/workspace/repo',
      relativePath: 'src/main.ts',
    });
    expect(git.run).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: '/workspace/repo/src',
        args: ['rev-parse', '--show-toplevel'],
      }),
    );
  });

  it('canonicalizes filesystem aliases before checking the repository boundary', async () => {
    const git = createGitPort('/private/tmp/repository\n');
    const canonicalizePath = vi.fn((filePath: string) =>
      Promise.resolve(filePath.replace(/^\/tmp(?=\/)/u, '/private/tmp')),
    );
    const resolver = new GitResourceResolver(git, canonicalizePath);

    await expect(
      resolver.resolve({
        isWorkspaceTrusted: true,
        scheme: 'file',
        filePath: '/tmp/repository/src/main.ts',
      }),
    ).resolves.toEqual({
      repositoryRoot: '/private/tmp/repository',
      relativePath: 'src/main.ts',
    });
    expect(canonicalizePath).toHaveBeenCalledWith('/private/tmp/repository');
    expect(canonicalizePath).toHaveBeenCalledWith('/tmp/repository/src');
  });
});

function createGitPort(
  stdout = '',
): GitCommandPort & { readonly run: ReturnType<typeof vi.fn> } {
  return {
    run: vi
      .fn()
      .mockResolvedValue({ stdout, stdoutBytes: stdout.length, stderrBytes: 0 }),
  };
}
