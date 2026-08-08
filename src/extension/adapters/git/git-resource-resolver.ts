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

export class GitResourceResolver {
  public constructor(private readonly git: GitCommandPort) {}

  public async resolve(
    candidate: GitResourceCandidate,
    signal?: GitCancellationSignal,
  ): Promise<ExecutableGitResource> {
    validateCandidate(candidate);
    const repositoryRoot = await this.findRepositoryRoot(candidate.filePath, signal);
    const relativePath = path
      .relative(repositoryRoot, candidate.filePath)
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
