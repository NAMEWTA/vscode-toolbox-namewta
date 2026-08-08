import {
  GIT_EMPTY_TREE_HASH,
  isFullCommitHash,
  isRepositoryRelativePath,
  type GitCancellationSignal,
  type GitCommandPort,
  type GitCommandResult,
  type GitCommitChange,
  type GitCommitChangesInput,
  type GitCommitChangesResult,
  type GitHistoricalContentInput,
  type GitHistoricalContentResult,
  type GitHistoryPort,
} from '../../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';

export class GitHistoryPortAdapter implements GitHistoryPort {
  public constructor(
    private readonly git: GitCommandPort,
    private readonly isWorkspaceTrusted: () => boolean,
  ) {}

  public async getCommitChanges(
    input: GitCommitChangesInput,
    signal: GitCancellationSignal,
  ): Promise<GitCommitChangesResult> {
    this.assertTrusted();
    const parent = await this.resolveParent(input, signal);
    const result = await this.runOrNotFound({
      operation: 'commit-changes',
      cwd: input.resource.repositoryRoot,
      args: [
        '-c',
        'core.quotePath=false',
        'diff',
        '--name-status',
        '-M',
        parent,
        input.commit,
        '--',
      ],
      signal,
    });
    return {
      changes: parseNameStatus(result.stdout, input.resource, parent, input.commit),
    };
  }

  public async getHistoricalContent(
    input: GitHistoricalContentInput,
    signal: GitCancellationSignal,
  ): Promise<GitHistoricalContentResult> {
    this.assertTrusted();
    const result = await this.runOrNotFound({
      operation: 'historical-content',
      cwd: input.resource.repositoryRoot,
      args: ['show', `${input.ref}:${input.path}`],
      signal,
    });
    if (result.stdout.includes('\0') || result.stdout.includes('\uFFFD')) {
      throw new ApplicationError('Historical content is not safe UTF-8 text.', {
        code: 'capability-unavailable',
      });
    }
    return { content: result.stdout };
  }

  private async resolveParent(
    input: GitCommitChangesInput,
    signal: GitCancellationSignal,
  ): Promise<string> {
    const result = await this.runOrNotFound({
      operation: 'commit-parents',
      cwd: input.resource.repositoryRoot,
      args: ['rev-list', '--parents', '-n', '1', input.commit],
      signal,
    });
    const hashes = result.stdout.trim().split(/\s+/u).filter(Boolean);
    if (
      hashes[0]?.toLowerCase() !== input.commit.toLowerCase() ||
      !hashes.every(isFullCommitHash)
    ) {
      throw historyError('internal-error');
    }
    const parents = hashes.slice(1);
    if (input.parent !== undefined) {
      const selectedParent = parents.find(
        (parent) => parent.toLowerCase() === input.parent?.toLowerCase(),
      );
      if (selectedParent === undefined) {
        throw historyError('invalid-input');
      }
      return selectedParent;
    }
    return parents[0] ?? GIT_EMPTY_TREE_HASH;
  }

  private async runOrNotFound(
    request: Parameters<GitCommandPort['run']>[0],
  ): Promise<GitCommandResult> {
    try {
      return await this.git.run(request);
    } catch (error: unknown) {
      if (isGitExitError(error)) {
        throw new ApplicationError('The requested Git object was not found.', {
          code: 'not-found',
          cause: error,
        });
      }
      throw error;
    }
  }

  private assertTrusted(): void {
    if (!this.isWorkspaceTrusted()) {
      throw new ApplicationError('Git requires a trusted workspace.', {
        code: 'permission-denied',
      });
    }
  }
}

function parseNameStatus(
  output: string,
  resource: GitCommitChangesInput['resource'],
  parent: string,
  commit: string,
): readonly GitCommitChange[] {
  if (output.length === 0) {
    return [];
  }
  return output
    .trimEnd()
    .split(/\r?\n/u)
    .map((row) => parseChangeRow(row, resource, parent, commit));
}

function parseChangeRow(
  row: string,
  resource: GitCommitChangesInput['resource'],
  parent: string,
  commit: string,
): GitCommitChange {
  const fields = row.split('\t');
  const statusCode = fields[0]?.[0];
  if (statusCode === 'R') {
    const previousPath = requiredPath(fields[1]);
    const path = requiredPath(fields[2]);
    return {
      status: 'renamed',
      path,
      previousPath,
      before: { resource, ref: parent, path: previousPath },
      after: { resource, ref: commit, path },
    };
  }
  const path = requiredPath(fields[1]);
  if (statusCode === 'A') {
    return change('added', resource, path, GIT_EMPTY_TREE_HASH, commit);
  }
  if (statusCode === 'D') {
    return change('deleted', resource, path, parent, GIT_EMPTY_TREE_HASH);
  }
  if (statusCode === 'M' || statusCode === 'T') {
    return change('modified', resource, path, parent, commit);
  }
  throw historyError('internal-error');
}

function change(
  status: 'added' | 'modified' | 'deleted',
  resource: GitCommitChangesInput['resource'],
  path: string,
  beforeRef: string,
  afterRef: string,
): GitCommitChange {
  return {
    status,
    path,
    before: { resource, ref: beforeRef, path },
    after: { resource, ref: afterRef, path },
  };
}

function requiredPath(value: unknown): string {
  if (!isRepositoryRelativePath(value)) {
    throw historyError('internal-error');
  }
  return value;
}

function isGitExitError(error: unknown): boolean {
  return (
    error instanceof ApplicationError &&
    error.code === 'internal-error' &&
    typeof error.details?.exitCode === 'number'
  );
}

function historyError(code: 'invalid-input' | 'internal-error'): ApplicationError {
  return new ApplicationError('Git history data is invalid.', { code });
}
