import { EventEmitter } from 'node:events';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { GitCommandResult } from '../../../core/domains/git-blame/public-api';
import {
  GitCommandRunner,
  type GitProcessFactory,
  type SpawnedGitProcess,
} from './git-command-runner';

describe('GitCommandRunner', () => {
  it('executes a real isolated Git repository workflow', async () => {
    const repository = await mkdtemp(
      path.join(tmpdir(), 'vscode-toolbox-namewta-git-'),
    );
    const runner = new GitCommandRunner();
    try {
      await runGit(runner, repository, ['init']);
      await runGit(runner, repository, [
        'config',
        'user.name',
        'vscode-toolbox-namewta Test',
      ]);
      await runGit(runner, repository, [
        'config',
        'user.email',
        'test@example.invalid',
      ]);
      await writeFile(path.join(repository, 'main.ts'), 'export const value = 1;\n');
      await runGit(runner, repository, ['add', '--', 'main.ts']);
      await runGit(runner, repository, ['commit', '-m', 'initial']);

      const result = await runGit(runner, repository, ['rev-parse', '--show-toplevel']);
      expect(await realpath(result.stdout.trim())).toBe(await realpath(repository));
    } finally {
      await rm(repository, { recursive: true, force: true });
    }
  });

  it('executes Git with an argument array, isolated cwd and no shell', async () => {
    const process = new FakeGitProcess();
    const factory = vi.fn<GitProcessFactory>(() => process);
    const runner = new GitCommandRunner(factory);
    const pending = runner.run({
      operation: 'repository-root',
      cwd: '/workspace/repo',
      args: ['rev-parse', '--show-toplevel'],
    });

    process.stdout.end('/workspace/repo\n');
    process.stderr.end();
    process.close(0);

    await expect(pending).resolves.toMatchObject({
      stdout: '/workspace/repo\n',
      stdoutBytes: 16,
      stderrBytes: 0,
    });
    expect(factory).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--show-toplevel'],
      expect.objectContaining({ cwd: '/workspace/repo', shell: false }),
    );
  });

  it('kills the process and returns timeout when the deadline expires', async () => {
    vi.useFakeTimers();
    const process = new FakeGitProcess();
    const runner = new GitCommandRunner(() => process);
    const pending = runner.run({
      operation: 'blame',
      cwd: '/workspace/repo',
      args: ['blame', '--porcelain', '--', 'main.ts'],
      timeoutMs: 25,
    });

    await vi.advanceTimersByTimeAsync(25);
    process.close(null);

    await expect(pending).rejects.toMatchObject({ code: 'timeout' });
    expect(process.kill).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('kills the process and returns cancelled when the signal aborts', async () => {
    const process = new FakeGitProcess();
    const runner = new GitCommandRunner(() => process);
    const controller = new AbortController();
    const pending = runner.run({
      operation: 'history',
      cwd: '/workspace/repo',
      args: ['log'],
      signal: controller.signal,
    });

    controller.abort();
    process.close(null);

    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
    expect(process.kill).toHaveBeenCalled();
  });

  it('terminates output that exceeds the configured byte limit', async () => {
    const process = new FakeGitProcess();
    const runner = new GitCommandRunner(() => process);
    const pending = runner.run({
      operation: 'content',
      cwd: '/workspace/repo',
      args: ['show', 'HEAD:main.ts'],
      maxOutputBytes: 3,
    });

    process.stdout.write('four');
    process.close(null);

    await expect(pending).rejects.toMatchObject({ code: 'capability-unavailable' });
    expect(process.kill).toHaveBeenCalled();
  });

  it('maps spawn failures without exposing command arguments', async () => {
    const runner = new GitCommandRunner(() => {
      const error = new Error('spawn git ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    });

    await expect(
      runner.run({
        operation: 'repository-root',
        cwd: '/workspace/repo',
        args: ['rev-parse', '--show-toplevel'],
      }),
    ).rejects.toMatchObject({
      code: 'capability-unavailable',
      details: { operation: 'repository-root' },
    });
  });
});

function runGit(
  runner: GitCommandRunner,
  cwd: string,
  args: readonly string[],
): Promise<GitCommandResult> {
  return runner.run({ operation: 'test-fixture', cwd, args });
}

class FakeGitProcess extends EventEmitter implements SpawnedGitProcess {
  public readonly stdout = new PassThrough();
  public readonly stderr = new PassThrough();
  public readonly kill = vi.fn((): boolean => true);

  public close(code: number | null): void {
    this.emit('close', code, null);
  }
}
