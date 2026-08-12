import type {
  GitBlameDataPort,
  GitBlameDataRequest,
  GitBlameDataResult,
} from '../../../core/domains/git-blame/git-blame-annotation-model';
import type {
  GitCancellationSignal,
  GitCommandPort,
} from '../../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';
import { parseGitBlamePorcelain } from './git-blame-parser';

export class GitBlamePortAdapter implements GitBlameDataPort {
  public constructor(
    private readonly git: GitCommandPort,
    private readonly isWorkspaceTrusted: () => boolean,
  ) {}

  public async getAnnotations(
    request: GitBlameDataRequest,
    signal: GitCancellationSignal,
  ): Promise<GitBlameDataResult> {
    if (!this.isWorkspaceTrusted()) {
      throw new ApplicationError('Git requires a trusted workspace.', {
        code: 'permission-denied',
      });
    }
    if (request.ref !== undefined) {
      await this.assertHistoricalPath(request, request.ref, signal);
    } else if (!(await this.isTracked(request, signal))) {
      return { status: 'unavailable', reason: 'untracked' };
    }

    try {
      const result = await this.git.run({
        operation: 'blame',
        cwd: request.resource.repositoryRoot,
        args: createBlameArguments(request),
        ...(request.contents === undefined ? {} : { stdinText: request.contents }),
        signal,
      });
      const lines = parseGitBlamePorcelain(result.stdout);
      if (lines.length === 0) {
        return { status: 'unavailable', reason: 'empty' };
      }
      const remoteUrl = await this.readRemoteUrl(request, signal);
      return {
        status: 'available',
        lines,
        ...(remoteUrl === undefined ? {} : { remoteUrl }),
      };
    } catch (error: unknown) {
      if (request.ref !== undefined && isGitExitError(error)) {
        throw new ApplicationError('The requested Git reference was not found.', {
          code: 'not-found',
          cause: error,
        });
      }
      throw error;
    }
  }

  private async readRemoteUrl(
    request: GitBlameDataRequest,
    signal: GitCancellationSignal,
  ): Promise<string | undefined> {
    try {
      const result = await this.git.run({
        operation: 'blame-remote',
        cwd: request.resource.repositoryRoot,
        args: ['config', '--get', 'remote.origin.url'],
        signal,
      });
      const remote = result.stdout.trim();
      return remote.length === 0 || remote.length > 2_048 ? undefined : remote;
    } catch (error: unknown) {
      if (isGitExitError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  private async isTracked(
    request: GitBlameDataRequest,
    signal: GitCancellationSignal,
  ): Promise<boolean> {
    try {
      await this.git.run({
        operation: 'tracked-file',
        cwd: request.resource.repositoryRoot,
        args: ['ls-files', '--error-unmatch', '--', request.resource.relativePath],
        signal,
      });
      return true;
    } catch (error: unknown) {
      if (isGitExitError(error)) {
        return false;
      }
      throw error;
    }
  }

  private async assertHistoricalPath(
    request: GitBlameDataRequest,
    ref: string,
    signal: GitCancellationSignal,
  ): Promise<void> {
    try {
      await this.git.run({
        operation: 'historical-path',
        cwd: request.resource.repositoryRoot,
        args: ['cat-file', '-e', `${ref}:${request.resource.relativePath}`],
        signal,
      });
    } catch (error: unknown) {
      if (isGitExitError(error)) {
        throw new ApplicationError('The requested historical path was not found.', {
          code: 'not-found',
          cause: error,
        });
      }
      throw error;
    }
  }
}

function createBlameArguments(request: GitBlameDataRequest): readonly string[] {
  return [
    '-c',
    'core.quotePath=false',
    'blame',
    '--line-porcelain',
    ...(request.ignoreWhitespace ? ['-w'] : []),
    ...(request.contents === undefined ? [] : ['--contents', '-']),
    ...(request.ref === undefined ? [] : [request.ref]),
    '--',
    request.resource.relativePath,
  ];
}

function isGitExitError(error: unknown): boolean {
  return (
    error instanceof ApplicationError &&
    error.code === 'internal-error' &&
    typeof error.details?.exitCode === 'number'
  );
}
