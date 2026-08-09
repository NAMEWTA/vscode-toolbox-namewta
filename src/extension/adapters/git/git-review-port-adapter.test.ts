import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  GitCommandPort,
  GitCommandRequest,
  GitCommandResult,
} from '../../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';
import { GitCommandRunner } from './git-command-runner';
import { GitReviewPortAdapter } from './git-review-port-adapter';

describe('GitReviewPortAdapter', () => {
  it('读取真实仓库的合并变更、特殊项和正确的前后文本，且不执行 Git 写入', async () => {
    const repository = await createCommittedRepository();
    const runner = new GitCommandRunner();
    const git = new RecordingGitPort(runner);
    const adapter = new GitReviewPortAdapter(git, () => true);
    try {
      await writeFile(path.join(repository, 'main.ts'), 'const value = 2;\n');
      await runFixtureGit(runner, repository, ['add', '--', 'main.ts']);
      await writeFile(path.join(repository, 'main.ts'), 'const value = 3;\n');
      await rm(path.join(repository, 'removed.ts'));
      await rm(path.join(repository, 'binary-deleted.bin'));
      await runFixtureGit(runner, repository, ['mv', 'before-rename.ts', 'renamed.ts']);
      await writeFile(path.join(repository, 'draft\nname.ts'), 'draft\n');
      await writeFile(path.join(repository, 'binary.bin'), Buffer.from([0, 1, 2, 3]));

      const changes = await adapter.listChanges(repository, { aborted: false });
      const byPath = new Map(changes.map((change) => [change.path, change]));
      const main = byPath.get('main.ts');
      const removed = byPath.get('removed.ts');
      const renamed = byPath.get('renamed.ts');
      const draft = byPath.get('draft\nname.ts');
      const binary = byPath.get('binary.bin');
      const binaryDeleted = byPath.get('binary-deleted.bin');

      expect(changes).toHaveLength(6);
      expect(main).toMatchObject({ change: 'modified', presentation: 'text' });
      expect(removed).toMatchObject({ change: 'deleted', presentation: 'text' });
      expect(renamed).toMatchObject({
        change: 'renamed',
        previousPath: 'before-rename.ts',
        presentation: 'text',
      });
      expect(draft).toMatchObject({ change: 'untracked', presentation: 'text' });
      expect(binary).toMatchObject({ change: 'untracked', presentation: 'binary' });
      expect(binaryDeleted).toMatchObject({
        change: 'deleted',
        presentation: 'binary',
      });
      expect(main).toBeDefined();
      expect(removed).toBeDefined();
      expect(binary).toBeDefined();
      expect(binaryDeleted).toBeDefined();

      await expect(
        adapter.readItemContent(
          { repositoryRoot: repository, item: requiredChange(main) },
          { aborted: false },
        ),
      ).resolves.toEqual({
        kind: 'text',
        before: 'const value = 1;\n',
        after: 'const value = 3;\n',
      });
      await expect(
        adapter.readItemContent(
          { repositoryRoot: repository, item: requiredChange(removed) },
          { aborted: false },
        ),
      ).resolves.toEqual({
        kind: 'text',
        before: 'remove me\n',
        after: '',
      });
      await expect(
        adapter.readItemContent(
          { repositoryRoot: repository, item: requiredChange(binary) },
          { aborted: false },
        ),
      ).resolves.toEqual({ kind: 'summary', reason: 'binary' });
      await expect(
        adapter.readItemContent(
          { repositoryRoot: repository, item: requiredChange(binaryDeleted) },
          { aborted: false },
        ),
      ).resolves.toEqual({ kind: 'summary', reason: 'binary' });
      expect(hasOnlyReadOnlyGitCommands(git.requests)).toBe(true);
    } finally {
      await rm(repository, { recursive: true, force: true });
    }
  }, 10_000);

  it('只读 Git 调用审计拒绝写入和远程子命令', () => {
    expect(
      hasOnlyReadOnlyGitCommands([
        { operation: 'test', cwd: '/repository', args: ['push'] },
      ]),
    ).toBe(false);
    expect(
      hasOnlyReadOnlyGitCommands([
        { operation: 'test', cwd: '/repository', args: ['remote', '-v'] },
      ]),
    ).toBe(false);
  });
});

describe('GitReviewPortAdapter 无 HEAD 与错误边界', () => {
  it('为无 HEAD 仓库使用空基准，并在不可信、取消和超时边界保留结构化失败', async () => {
    const repository = await mkdtemp(
      path.join(tmpdir(), 'vscode-toolbox-namewta-review-'),
    );
    const runner = new GitCommandRunner();
    const adapter = new GitReviewPortAdapter(runner, () => true);
    try {
      await runFixtureGit(runner, repository, ['init']);
      await writeFile(path.join(repository, 'first.ts'), 'first\n');
      await runFixtureGit(runner, repository, ['add', '--', 'first.ts']);
      const changes = await adapter.listChanges(repository, { aborted: false });
      const first = changes.find((change) => change.path === 'first.ts');

      expect(first).toMatchObject({ change: 'added', presentation: 'text' });
      await expect(
        adapter.readItemContent(
          { repositoryRoot: repository, item: requiredChange(first) },
          { aborted: false },
        ),
      ).resolves.toEqual({ kind: 'text', before: '', after: 'first\n' });
      await writeFile(path.join(repository, 'first.ts'), 'changed\n');
      await expect(
        adapter.readItemContent(
          { repositoryRoot: repository, item: requiredChange(first) },
          { aborted: false },
        ),
      ).rejects.toMatchObject({
        code: 'capability-unavailable',
        retryable: true,
      });
    } finally {
      await rm(repository, { recursive: true, force: true });
    }

    const restrictedGit = new RecordingGitPort(new GitCommandRunner());
    const restricted = new GitReviewPortAdapter(restrictedGit, () => false);
    await expect(
      restricted.listChanges('/workspace/repository', { aborted: false }),
    ).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(restrictedGit.requests).toEqual([]);

    const cancelled = new GitReviewPortAdapter(
      new FailingGitPort('cancelled'),
      () => true,
    );
    await expect(
      cancelled.listChanges('/workspace/repository', { aborted: true }),
    ).rejects.toMatchObject({
      code: 'cancelled',
    });

    const timedOut = new GitReviewPortAdapter(
      new FailingGitPort('timeout'),
      () => true,
    );
    await expect(
      timedOut.listChanges('/workspace/repository', { aborted: false }),
    ).rejects.toMatchObject({
      code: 'timeout',
    });

    const unavailable = new GitReviewPortAdapter(
      new FailingGitPort('capability-unavailable'),
      () => true,
    );
    await expect(
      unavailable.listChanges('/workspace/repository', { aborted: false }),
    ).rejects.toMatchObject({
      code: 'capability-unavailable',
    });
  });

  it('在 Git 状态读取完成后立即尊重取消，不继续枚举内容', async () => {
    const repository = await mkdtemp(
      path.join(tmpdir(), 'vscode-toolbox-namewta-review-'),
    );
    const signal = { aborted: false };
    const git = new CancellingStatusGitPort(repository, signal);
    const adapter = new GitReviewPortAdapter(git, () => true);
    try {
      await expect(adapter.listChanges(repository, signal)).rejects.toMatchObject({
        code: 'cancelled',
      });
      expect(git.operations).toEqual([
        'git-review-repository-root',
        'git-review-head',
        'git-review-status',
      ]);
    } finally {
      await rm(repository, { recursive: true, force: true });
    }
  });
});

describe('GitReviewPortAdapter 特殊项', () => {
  it('保留子模块项并以摘要返回，不将目录作为普通文本读取', async () => {
    const repository = await mkdtemp(
      path.join(tmpdir(), 'vscode-toolbox-namewta-review-'),
    );
    const git = new SubmoduleGitPort(repository);
    const adapter = new GitReviewPortAdapter(git, () => true);
    try {
      const [submodule] = await adapter.listChanges(repository, { aborted: false });

      expect(submodule).toMatchObject({
        path: 'vendor/module',
        change: 'modified',
        presentation: 'submodule',
      });
      await expect(
        adapter.readItemContent(
          { repositoryRoot: repository, item: requiredChange(submodule) },
          { aborted: false },
        ),
      ).resolves.toEqual({ kind: 'summary', reason: 'submodule' });
    } finally {
      await rm(repository, { recursive: true, force: true });
    }
  });

  it('拒绝畸形的 HEAD 输出，不将外部数据错误当作无 HEAD 仓库', async () => {
    const repository = await mkdtemp(
      path.join(tmpdir(), 'vscode-toolbox-namewta-review-'),
    );
    const adapter = new GitReviewPortAdapter(
      new SubmoduleGitPort(repository, 'not-a-hash\n'),
      () => true,
    );
    try {
      await expect(
        adapter.listChanges(repository, { aborted: false }),
      ).rejects.toMatchObject({
        code: 'internal-error',
      });
    } finally {
      await rm(repository, { recursive: true, force: true });
    }
  });

  it('不将无关的 HEAD Git 失败当作无 HEAD 仓库', async () => {
    const repository = await mkdtemp(
      path.join(tmpdir(), 'vscode-toolbox-namewta-review-'),
    );
    const adapter = new GitReviewPortAdapter(
      new FailingHeadGitPort(repository),
      () => true,
    );
    try {
      await expect(
        adapter.listChanges(repository, { aborted: false }),
      ).rejects.toMatchObject({
        code: 'capability-unavailable',
      });
    } finally {
      await rm(repository, { recursive: true, force: true });
    }
  });

  it('保留不可读取的文本项，并以 unavailable 摘要而非中止队列返回', async () => {
    const repository = await mkdtemp(
      path.join(tmpdir(), 'vscode-toolbox-namewta-review-'),
    );
    const adapter = new GitReviewPortAdapter(
      new UnavailableContentGitPort(repository),
      () => true,
    );
    try {
      const [item] = await adapter.listChanges(repository, { aborted: false });

      expect(item).toMatchObject({
        path: 'missing.ts',
        change: 'modified',
        presentation: 'text',
      });
      await expect(
        adapter.readItemContent(
          { repositoryRoot: repository, item: requiredChange(item) },
          { aborted: false },
        ),
      ).resolves.toEqual({ kind: 'summary', reason: 'unavailable' });
    } finally {
      await rm(repository, { recursive: true, force: true });
    }
  });
});

async function createCommittedRepository(): Promise<string> {
  const repository = await mkdtemp(
    path.join(tmpdir(), 'vscode-toolbox-namewta-review-'),
  );
  const git = new GitCommandRunner();
  await runFixtureGit(git, repository, ['init']);
  await runFixtureGit(git, repository, [
    'config',
    'user.name',
    'vscode-toolbox-namewta Test',
  ]);
  await runFixtureGit(git, repository, [
    'config',
    'user.email',
    'test@example.invalid',
  ]);
  await writeFile(path.join(repository, 'main.ts'), 'const value = 1;\n');
  await writeFile(path.join(repository, 'removed.ts'), 'remove me\n');
  await writeFile(path.join(repository, 'before-rename.ts'), 'rename me\n');
  await writeFile(
    path.join(repository, 'binary-deleted.bin'),
    Buffer.from([0, 1, 2, 3]),
  );
  await runFixtureGit(git, repository, ['add', '--', '.']);
  await runFixtureGit(git, repository, ['commit', '-m', 'initial']);
  return repository;
}

function runFixtureGit(
  git: GitCommandPort,
  cwd: string,
  args: readonly string[],
): Promise<GitCommandResult> {
  return git.run({ operation: 'test-fixture', cwd, args });
}

function requiredChange<T>(value: T | undefined): T {
  expect(value).toBeDefined();
  return value as T;
}

function hasOnlyReadOnlyGitCommands(requests: readonly GitCommandRequest[]): boolean {
  const forbidden = new Set([
    'add',
    'branch',
    'checkout',
    'commit',
    'config',
    'fetch',
    'merge',
    'pull',
    'push',
    'rebase',
    'remote',
    'reset',
    'restore',
    'tag',
  ]);
  return requests.every((request) =>
    request.args.every((argument) => !forbidden.has(argument)),
  );
}

class RecordingGitPort implements GitCommandPort {
  public readonly requests: GitCommandRequest[] = [];

  public constructor(private readonly delegate: GitCommandPort) {}

  public run(request: GitCommandRequest): Promise<GitCommandResult> {
    this.requests.push(request);
    return this.delegate.run(request);
  }
}

class FailingGitPort implements GitCommandPort {
  public constructor(
    private readonly code: 'cancelled' | 'timeout' | 'capability-unavailable',
  ) {}

  public run(): Promise<GitCommandResult> {
    return Promise.reject(
      new ApplicationError('Expected Git failure.', { code: this.code }),
    );
  }
}

class SubmoduleGitPort implements GitCommandPort {
  public constructor(
    private readonly repositoryRoot: string,
    private readonly headOutput = `${'a'.repeat(40)}\n`,
  ) {}

  public run(request: GitCommandRequest): Promise<GitCommandResult> {
    const output = this.outputFor(request.operation);
    return Promise.resolve({
      stdout: output,
      stdoutBytes: Buffer.byteLength(output),
      stderrBytes: 0,
    });
  }

  private outputFor(operation: string): string {
    const object = 'a'.repeat(40);
    if (operation === 'git-review-repository-root') {
      return `${this.repositoryRoot}\n`;
    }
    if (operation === 'git-review-head') {
      return this.headOutput;
    }
    if (operation === 'git-review-status') {
      return `1 .M S... 160000 160000 160000 ${object} ${object} vendor/module\0`;
    }
    if (operation === 'git-review-numstat') {
      return '';
    }
    throw new Error('Unexpected Git Review operation.');
  }
}

class FailingHeadGitPort extends SubmoduleGitPort {
  public override run(request: GitCommandRequest): Promise<GitCommandResult> {
    if (request.operation === 'git-review-head') {
      return Promise.reject(
        new ApplicationError('Git repository is corrupt.', {
          code: 'internal-error',
          details: { exitCode: 128 },
        }),
      );
    }
    return super.run(request);
  }
}

class UnavailableContentGitPort implements GitCommandPort {
  public constructor(private readonly repositoryRoot: string) {}

  public run(request: GitCommandRequest): Promise<GitCommandResult> {
    const object = 'a'.repeat(40);
    const outputs: Readonly<Record<string, string>> = {
      'git-review-repository-root': `${this.repositoryRoot}\n`,
      'git-review-head': `${object}\n`,
      'git-review-status': `1 .M N... 100644 100644 100644 ${object} ${object} missing.ts\0`,
      'git-review-numstat': '1\t1\tmissing.ts\0',
      'git-review-before-content': 'before\n',
    };
    const output = outputs[request.operation];
    if (output === undefined) {
      throw new Error('Unexpected Git Review operation.');
    }
    return Promise.resolve({
      stdout: output,
      stdoutBytes: Buffer.byteLength(output),
      stderrBytes: 0,
    });
  }
}

class CancellingStatusGitPort implements GitCommandPort {
  public readonly operations: string[] = [];

  public constructor(
    private readonly repositoryRoot: string,
    private readonly signal: { aborted: boolean },
  ) {}

  public run(request: GitCommandRequest): Promise<GitCommandResult> {
    this.operations.push(request.operation);
    const object = 'a'.repeat(40);
    if (request.operation === 'git-review-repository-root') {
      return Promise.resolve(gitResult(`${this.repositoryRoot}\n`));
    }
    if (request.operation === 'git-review-head') {
      return Promise.resolve(gitResult(`${object}\n`));
    }
    if (request.operation === 'git-review-status') {
      this.signal.aborted = true;
      return Promise.resolve(
        gitResult(`1 .M N... 100644 100644 100644 ${object} ${object} main.ts\0`),
      );
    }
    throw new Error('Unexpected Git Review operation.');
  }
}

function gitResult(stdout: string): GitCommandResult {
  return { stdout, stdoutBytes: Buffer.byteLength(stdout), stderrBytes: 0 };
}
