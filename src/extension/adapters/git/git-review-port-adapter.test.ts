import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  GitCommandPort,
  GitCommandRequest,
  GitCommandResult,
} from '../../../core/domains/git-blame/public-api';
import type {
  GitReviewChangeDescriptor,
  GitReviewItemContent,
} from '../../../core/domains/git-review/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';
import { GitCommandRunner } from './git-command-runner';
import { GitReviewPortAdapter } from './git-review-port-adapter';

describe('GitReviewPortAdapter', () => {
  it(
    '读取真实仓库的合并变更、特殊项和正确的前后文本，且不执行 Git 写入',
    readsRepositoryChanges,
    10_000,
  );

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

  it('对单个文件执行暂存、取消暂存和确认后的丢弃，并刷新分层清单', async () => {
    const repository = await createCommittedRepository();
    const runner = new GitCommandRunner();
    const adapter = new GitReviewPortAdapter(runner, () => true);
    try {
      const file = path.join(repository, 'main.ts');
      await writeFile(file, 'const value = 2;\n');

      const unstaged = requiredChange(
        (await adapter.listChanges(repository, { aborted: false })).find(
          (change) => change.path === 'main.ts' && change.layer === 'unstaged',
        ),
      );
      const stagedChanges = await adapter.mutateItem(
        { repositoryRoot: repository, item: unstaged, mutation: 'stage' },
        { aborted: false },
      );
      const staged = requiredChange(
        stagedChanges.find(
          (change) => change.path === 'main.ts' && change.layer === 'staged',
        ),
      );

      const unstagedChanges = await adapter.mutateItem(
        { repositoryRoot: repository, item: staged, mutation: 'unstage' },
        { aborted: false },
      );
      const restoredUnstaged = requiredChange(
        unstagedChanges.find(
          (change) => change.path === 'main.ts' && change.layer === 'unstaged',
        ),
      );
      const remaining = await adapter.mutateItem(
        { repositoryRoot: repository, item: restoredUnstaged, mutation: 'discard' },
        { aborted: false },
      );

      expect(remaining.some((change) => change.path === 'main.ts')).toBe(false);
      await expect(readFile(file, 'utf8')).resolves.toBe('const value = 1;\n');
    } finally {
      await rm(repository, { recursive: true, force: true });
    }
  }, 10_000);
});

type MixedChangeFixture = {
  readonly stagedMain: GitReviewChangeDescriptor;
  readonly unstagedMain: GitReviewChangeDescriptor;
  readonly removed: GitReviewChangeDescriptor;
  readonly binary: GitReviewChangeDescriptor;
  readonly binaryDeleted: GitReviewChangeDescriptor;
};

async function readsRepositoryChanges(): Promise<void> {
  const repository = await createCommittedRepository();
  const runner = new GitCommandRunner();
  const git = new RecordingGitPort(runner);
  const adapter = new GitReviewPortAdapter(git, () => true);
  try {
    await createMixedChanges(repository, runner);
    const changes = await adapter.listChanges(repository, { aborted: false });
    const fixture = assertMixedChangeInventory(changes);
    await assertMixedChangeContents(adapter, repository, fixture);
    expect(hasOnlyReadOnlyGitCommands(git.requests)).toBe(true);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
}

async function createMixedChanges(
  repository: string,
  runner: GitCommandRunner,
): Promise<void> {
  await writeFile(path.join(repository, 'main.ts'), 'const value = 2;\n');
  await runFixtureGit(runner, repository, ['add', '--', 'main.ts']);
  await writeFile(path.join(repository, 'main.ts'), 'const value = 3;\n');
  await rm(path.join(repository, 'removed.ts'));
  await rm(path.join(repository, 'binary-deleted.bin'));
  await runFixtureGit(runner, repository, ['mv', 'before-rename.ts', 'renamed.ts']);
  await writeFile(path.join(repository, 'draft\nname.ts'), 'draft\n');
  await writeFile(path.join(repository, 'binary.bin'), Buffer.from([0, 1, 2, 3]));
}

function assertMixedChangeInventory(
  changes: readonly GitReviewChangeDescriptor[],
): MixedChangeFixture {
  const byPath = new Map(changes.map((change) => [change.path, change]));
  const stagedMain = requiredChange(
    changes.find((change) => change.path === 'main.ts' && change.layer === 'staged'),
  );
  const unstagedMain = requiredChange(
    changes.find((change) => change.path === 'main.ts' && change.layer === 'unstaged'),
  );
  const removed = requiredChange(byPath.get('removed.ts'));
  const binary = requiredChange(byPath.get('binary.bin'));
  const binaryDeleted = requiredChange(byPath.get('binary-deleted.bin'));

  expect(changes).toHaveLength(7);
  expect(stagedMain).toMatchObject({ change: 'modified', presentation: 'text' });
  expect(unstagedMain).toMatchObject({ change: 'modified', presentation: 'text' });
  expect(removed).toMatchObject({ change: 'deleted', presentation: 'text' });
  expect(byPath.get('renamed.ts')).toMatchObject({
    change: 'renamed',
    previousPath: 'before-rename.ts',
    presentation: 'text',
  });
  expect(byPath.get('draft\nname.ts')).toMatchObject({
    change: 'untracked',
    presentation: 'text',
  });
  expect(binary).toMatchObject({ change: 'untracked', presentation: 'binary' });
  expect(binaryDeleted).toMatchObject({ change: 'deleted', presentation: 'binary' });
  return { stagedMain, unstagedMain, removed, binary, binaryDeleted };
}

async function assertMixedChangeContents(
  adapter: GitReviewPortAdapter,
  repository: string,
  fixture: MixedChangeFixture,
): Promise<void> {
  await expect(readContent(adapter, repository, fixture.stagedMain)).resolves.toEqual({
    kind: 'text',
    before: 'const value = 1;\n',
    after: 'const value = 2;\n',
  });
  await expect(readContent(adapter, repository, fixture.unstagedMain)).resolves.toEqual(
    {
      kind: 'text',
      before: 'const value = 2;\n',
      after: 'const value = 3;\n',
    },
  );
  await expect(readContent(adapter, repository, fixture.removed)).resolves.toEqual({
    kind: 'text',
    before: 'remove me\n',
    after: '',
  });
  await expect(readContent(adapter, repository, fixture.binary)).resolves.toEqual({
    kind: 'summary',
    reason: 'binary',
  });
  await expect(
    readContent(adapter, repository, fixture.binaryDeleted),
  ).resolves.toEqual({ kind: 'summary', reason: 'binary' });
}

function readContent(
  adapter: GitReviewPortAdapter,
  repositoryRoot: string,
  item: GitReviewChangeDescriptor,
): Promise<GitReviewItemContent> {
  return adapter.readItemContent({ repositoryRoot, item }, { aborted: false });
}

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
      await writeFile(path.join(repository, 'binary.bin'), Buffer.from([0, 1, 2, 3]));
      await runFixtureGit(runner, repository, ['add', '--', 'first.ts']);
      await runFixtureGit(runner, repository, ['add', '--', 'binary.bin']);
      const changes = await adapter.listChanges(repository, { aborted: false });
      const first = changes.find((change) => change.path === 'first.ts');
      const binary = changes.find((change) => change.path === 'binary.bin');

      expect(first).toMatchObject({ change: 'added', presentation: 'text' });
      expect(binary).toMatchObject({ change: 'added', presentation: 'binary' });
      await expect(
        adapter.readItemContent(
          { repositoryRoot: repository, item: requiredChange(first) },
          { aborted: false },
        ),
      ).resolves.toEqual({ kind: 'text', before: '', after: 'first\n' });
      await expect(
        adapter.readItemPatch(
          {
            repositoryRoot: repository,
            item: requiredChange(binary),
          },
          { aborted: false },
        ),
      ).resolves.toEqual({ kind: 'summary', reason: 'binary' });
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
