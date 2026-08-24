import { describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import type { GitCommandPort } from '../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../core/kernel/application-error';
import {
  VscodeGitRepositoryResolver,
  type GitRepositoryContext,
  type GitRepositoryHost,
} from './vscode-git-repository-resolver';

vi.mock('vscode', () => {
  class Uri {
    public static file(fsPath: string): Uri {
      return new Uri('file', fsPath);
    }

    private constructor(
      public readonly scheme: string,
      public readonly fsPath: string,
    ) {}
  }

  return {
    l10n: { t: (value: string): string => value },
    Uri,
    window: {},
    workspace: {},
  };
});

describe('VS Code Git 仓库解析器', () => {
  it('优先使用活动文件所在的唯一仓库，不显示选择器', async () => {
    const git = createGit();
    git.run.mockResolvedValue(gitResult('/workspace/repository\n'));
    const host = createHost({
      isWorkspaceTrusted: true,
      activeFilePath: '/workspace/repository/src/main.ts',
      workspaceFolderPaths: ['/workspace/other'],
    });
    const adapter = createResolver(git, host);

    await expect(adapter.resolve([], new AbortController().signal)).resolves.toBe(
      '/workspace/repository',
    );

    expect(git.run).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'git-repository-discovery',
        cwd: '/workspace/repository/src',
        args: ['--no-optional-locks', 'rev-parse', '--show-toplevel'],
      }),
    );
    expect(host.pickRepository).not.toHaveBeenCalled();
  });

  it('在多个工作区仓库间选择，取消时不返回候选仓库', async () => {
    const git = createGit();
    git.run
      .mockResolvedValueOnce(gitResult('/workspace/first\n'))
      .mockResolvedValueOnce(gitResult('/workspace/second\n'));
    const host = createHost({
      isWorkspaceTrusted: true,
      activeFilePath: undefined,
      workspaceFolderPaths: ['/workspace/first', '/workspace/second'],
    });
    host.pickRepository.mockResolvedValue(undefined);
    const adapter = createResolver(git, host);

    await expect(
      adapter.resolve([], new AbortController().signal),
    ).resolves.toBeUndefined();

    expect(host.pickRepository).toHaveBeenCalledWith(
      [
        expect.objectContaining({ repositoryRoot: '/workspace/first' }),
        expect.objectContaining({ repositoryRoot: '/workspace/second' }),
      ],
      'Select repository',
    );
  });

  it('优先解析 Source Control 标题菜单提供的仓库根目录', async () => {
    const git = createGit();
    git.run.mockResolvedValue(gitResult('/workspace/selected\n'));
    const host = createHost({
      isWorkspaceTrusted: true,
      activeFilePath: '/workspace/other/src/main.ts',
      workspaceFolderPaths: ['/workspace/other'],
    });
    const adapter = createResolver(git, host);

    await expect(
      adapter.resolve(
        [
          {
            id: 'git',
            label: 'Git',
            rootUri: vscode.Uri.file('/workspace/selected'),
          },
        ],
        new AbortController().signal,
      ),
    ).resolves.toBe('/workspace/selected');

    expect(git.run).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: '/workspace/selected' }),
    );
    expect(host.pickRepository).not.toHaveBeenCalled();
  });

  it('拒绝不可信工作区和未验证的命令参数', async () => {
    const git = createGit();
    const host = createHost({
      isWorkspaceTrusted: false,
      activeFilePath: undefined,
      workspaceFolderPaths: ['/workspace/repository'],
    });
    const adapter = createResolver(git, host);

    await expect(
      adapter.resolve([], new AbortController().signal),
    ).rejects.toMatchObject({
      code: 'permission-denied',
    });
    await expect(
      adapter.resolve([{ repositoryRoot: '/untrusted' }], new AbortController().signal),
    ).rejects.toMatchObject({ code: 'invalid-input' });
    await expect(
      adapter.resolve([{ id: '', label: 'Git' }], new AbortController().signal),
    ).rejects.toMatchObject({ code: 'invalid-input' });
    expect(git.run).not.toHaveBeenCalled();
  });

  it('保留取消和超时错误，不将其伪装成空仓库', async () => {
    const git = createGit();
    git.run.mockRejectedValue(
      new ApplicationError('Git request timed out.', { code: 'timeout' }),
    );
    const host = createHost({
      isWorkspaceTrusted: true,
      activeFilePath: undefined,
      workspaceFolderPaths: ['/workspace/repository'],
    });
    const adapter = createResolver(git, host);

    await expect(
      adapter.resolve([], new AbortController().signal),
    ).rejects.toMatchObject({
      code: 'timeout',
    });
  });
});

describe('SCM 标题上下文边界', () => {
  it('拒绝没有可执行根目录的上下文，不回退到活动仓库', async () => {
    const git = createGit();
    const host = createHost({
      isWorkspaceTrusted: true,
      activeFilePath: '/workspace/other/src/main.ts',
      workspaceFolderPaths: ['/workspace/other'],
    });
    const adapter = createResolver(git, host);

    await expect(
      adapter.resolve([{ id: 'git', label: 'Git' }], new AbortController().signal),
    ).rejects.toMatchObject({ code: 'capability-unavailable' });
    expect(git.run).not.toHaveBeenCalled();
    expect(host.pickRepository).not.toHaveBeenCalled();
  });
});

function createGit(): GitCommandPort & {
  readonly run: ReturnType<typeof vi.fn>;
} {
  return { run: vi.fn() } as unknown as GitCommandPort & {
    readonly run: ReturnType<typeof vi.fn>;
  };
}

function createHost(context: GitRepositoryContext): GitRepositoryHost & {
  readonly getContext: ReturnType<typeof vi.fn>;
  readonly pickRepository: ReturnType<typeof vi.fn>;
} {
  return {
    getContext: vi.fn<() => GitRepositoryContext>().mockReturnValue(context),
    pickRepository: vi.fn<GitRepositoryHost['pickRepository']>(),
  };
}

function createResolver(
  git: GitCommandPort,
  host: GitRepositoryHost,
): VscodeGitRepositoryResolver {
  return new VscodeGitRepositoryResolver(git, 'Select repository', host);
}

function gitResult(stdout: string): {
  readonly stdout: string;
  readonly stdoutBytes: number;
  readonly stderrBytes: number;
} {
  return { stdout, stdoutBytes: stdout.length, stderrBytes: 0 };
}
