import { realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  isExecutableGitResource,
  type ExecutableGitResource,
  type GitCancellationSignal,
  type GitCommandPort,
} from '../../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';

export type GitResourceCandidate = {
  readonly isWorkspaceTrusted: boolean;
  readonly scheme: string;
  readonly filePath: string;
};

type GitPathCanonicalizer = (filePath: string) => Promise<string>;

export class GitResourceResolver {
  public constructor(
    private readonly git: GitCommandPort,
    private readonly canonicalizePath: GitPathCanonicalizer = realpath,
  ) {}

  public async resolve(
    candidate: GitResourceCandidate,
    signal?: GitCancellationSignal,
  ): Promise<ExecutableGitResource> {
    validateCandidate(candidate);
    const reportedRepositoryRoot = await this.findRepositoryRoot(
      candidate.filePath,
      signal,
    );
    const [repositoryRoot, resourceDirectory] = await this.canonicalizePaths(
      reportedRepositoryRoot,
      path.dirname(candidate.filePath),
    );
    const resourcePath = path.join(
      resourceDirectory,
      path.basename(candidate.filePath),
    );
    const relativePath = path
      .relative(repositoryRoot, resourcePath)
      .split(path.sep)
      .join('/');
    const resource = { repositoryRoot, relativePath };
    if (!isExecutableGitResource(resource)) {
      throw new ApplicationError('The resource is outside the Git repository.', {
        code: 'capability-unavailable',
      });
    }
    return resource;
  }

  private async canonicalizePaths(
    repositoryRoot: string,
    resourceDirectory: string,
  ): Promise<readonly [string, string]> {
    try {
      return await Promise.all([
        this.canonicalizePath(repositoryRoot),
        this.canonicalizePath(resourceDirectory),
      ]);
    } catch (error: unknown) {
      throw new ApplicationError('The Git resource path cannot be resolved.', {
        code: 'capability-unavailable',
        cause: error,
      });
    }
  }

  private async findRepositoryRoot(
    filePath: string,
    signal?: GitCancellationSignal,
  ): Promise<string> {
    try {
      const result = await this.git.run({
        operation: 'repository-root',
        cwd: path.dirname(filePath),
        args: ['rev-parse', '--show-toplevel'],
        ...(signal === undefined ? {} : { signal }),
      });
      return path.resolve(result.stdout.trim());
    } catch (error: unknown) {
      if (
        error instanceof ApplicationError &&
        ['cancelled', 'timeout', 'permission-denied'].includes(error.code)
      ) {
        throw error;
      }
      throw new ApplicationError('No executable Git repository is available.', {
        code: 'capability-unavailable',
        cause: error,
      });
    }
  }
}

function validateCandidate(candidate: GitResourceCandidate): void {
  if (!candidate.isWorkspaceTrusted) {
    throw new ApplicationError('Git requires a trusted workspace.', {
      code: 'permission-denied',
    });
  }
  if (candidate.scheme !== 'file' || candidate.filePath.length === 0) {
    throw new ApplicationError('The resource cannot be accessed by Git.', {
      code: 'capability-unavailable',
    });
  }
}
