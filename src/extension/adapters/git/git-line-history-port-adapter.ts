import {
  GIT_EMPTY_TREE_HASH,
  isFullCommitHash,
  type ExecutableGitResource,
  type GitCancellationSignal,
  type GitCommandPort,
  type GitCommandResult,
  type GitLineHistoryEntry,
  type GitLineHistoryLocator,
  type GitLineHistoryPort,
  type GitLineHistoryStep,
} from '../../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';
import {
  mapGitLineHistoryParentLine,
  parseGitLineHistoryBlame,
  parseGitLineHistoryParentPath,
  type ParsedGitLineHistoryBlame,
} from './git-line-history-parser';

export class GitLineHistoryPortAdapter implements GitLineHistoryPort {
  public constructor(
    private readonly git: GitCommandPort,
    private readonly isWorkspaceTrusted: () => boolean,
  ) {}

  public async getLineHistoryStep(
    resource: ExecutableGitResource,
    locator: GitLineHistoryLocator,
    signal: GitCancellationSignal,
  ): Promise<GitLineHistoryStep> {
    this.assertTrusted();
    const blame = parseGitLineHistoryBlame(
      (
        await this.runOrNotFound({
          operation: 'line-history-blame',
          cwd: resource.repositoryRoot,
          args: [
            '-c',
            'core.quotePath=false',
            'blame',
            '--line-porcelain',
            '-L',
            `${String(locator.line)},${String(locator.line)}`,
            locator.ref,
            '--',
            locator.path,
          ],
          signal,
        })
      ).stdout,
    );
    const parents = await this.getParents(resource, blame.commit, signal);
    if (parents.length === 0) {
      return { entry: createRootEntry(blame) };
    }
    const selectedParent = selectParentCommit(blame, parents);
    const parentPath = await this.resolveParentPath(
      resource,
      blame,
      selectedParent,
      signal,
    );
    if (parentPath === undefined) {
      return {
        entry: createEntry(blame, selectedParent, 'added', blame.path),
      };
    }
    const previousLine = await this.mapParentLine(
      resource,
      blame,
      selectedParent,
      parentPath,
      signal,
    );
    return createNonRootStep(blame, selectedParent, parentPath, previousLine);
  }

  private async getParents(
    resource: ExecutableGitResource,
    commit: string,
    signal: GitCancellationSignal,
  ): Promise<readonly string[]> {
    const result = await this.runOrNotFound({
      operation: 'line-history-parents',
      cwd: resource.repositoryRoot,
      args: ['rev-list', '--parents', '-n', '1', commit],
      signal,
    });
    const hashes = result.stdout.trim().split(/\s+/u).filter(Boolean);
    if (
      hashes[0]?.toLowerCase() !== commit.toLowerCase() ||
      !hashes.every(isFullCommitHash)
    ) {
      throw lineHistoryError('internal-error');
    }
    return hashes.slice(1);
  }

  private async mapParentLine(
    resource: ExecutableGitResource,
    blame: ParsedGitLineHistoryBlame,
    parent: string,
    previousPath: string,
    signal: GitCancellationSignal,
  ): Promise<number | undefined> {
    const result = await this.runOrNotFound({
      operation: 'line-history-parent-map',
      cwd: resource.repositoryRoot,
      args: [
        '-c',
        'core.quotePath=false',
        'diff',
        '--no-color',
        '--no-ext-diff',
        '--unified=0',
        `${parent}:${previousPath}`,
        `${blame.commit}:${blame.path}`,
      ],
      signal,
    });
    return mapGitLineHistoryParentLine(result.stdout, blame.originalLine);
  }

  private async resolveParentPath(
    resource: ExecutableGitResource,
    blame: ParsedGitLineHistoryBlame,
    parent: string,
    signal: GitCancellationSignal,
  ): Promise<string | undefined> {
    if (blame.previous !== undefined) {
      return blame.previous.path;
    }
    const result = await this.runOrNotFound({
      operation: 'line-history-parent-path',
      cwd: resource.repositoryRoot,
      args: [
        '-c',
        'core.quotePath=false',
        'diff',
        '--name-status',
        '-M',
        parent,
        blame.commit,
        '--',
      ],
      signal,
    });
    const resolved = parseGitLineHistoryParentPath(result.stdout, blame.path);
    return resolved.kind === 'added' ? undefined : resolved.path;
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

function selectParentCommit(
  blame: ParsedGitLineHistoryBlame,
  parents: readonly string[],
): string {
  if (blame.previous !== undefined) {
    const commit = parents.find(
      (parent) => parent.toLowerCase() === blame.previous?.commit.toLowerCase(),
    );
    if (commit === undefined) {
      throw lineHistoryError('internal-error');
    }
    return commit;
  }
  const commit = parents.length === 1 ? parents[0] : undefined;
  if (commit === undefined) {
    throw lineHistoryError('internal-error');
  }
  return commit;
}

function createRootEntry(blame: ParsedGitLineHistoryBlame): GitLineHistoryEntry {
  return createEntry(blame, GIT_EMPTY_TREE_HASH, 'added', blame.path);
}

function createNonRootStep(
  blame: ParsedGitLineHistoryBlame,
  parentCommit: string,
  parentPath: string,
  previousLine: number | undefined,
): GitLineHistoryStep {
  const changeType =
    previousLine === undefined
      ? 'added'
      : parentPath === blame.path
        ? 'modified'
        : 'renamed';
  const entry = createEntry(blame, parentCommit, changeType, parentPath);
  return previousLine === undefined
    ? { entry }
    : {
        entry,
        previous: { ref: parentCommit, path: parentPath, line: previousLine },
      };
}

function createEntry(
  blame: ParsedGitLineHistoryBlame,
  parentCommit: string,
  changeType: GitLineHistoryEntry['changeType'],
  previousPath: string,
): GitLineHistoryEntry {
  return {
    changeType,
    path: blame.path,
    ...(changeType === 'renamed' ? { previousPath } : {}),
    line: blame.originalLine,
    commit: blame.commit,
    parentCommit,
    author: blame.author,
    authoredAt: blame.authoredAt,
    summary: blame.summary,
    lineText: blame.lineText,
  };
}

function isGitExitError(error: unknown): boolean {
  return (
    error instanceof ApplicationError &&
    error.code === 'internal-error' &&
    typeof error.details?.exitCode === 'number'
  );
}

function lineHistoryError(code: 'internal-error' | 'invalid-input'): ApplicationError {
  return new ApplicationError('Git line history data is invalid.', { code });
}
