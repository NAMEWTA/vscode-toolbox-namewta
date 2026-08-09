import {
  isGitReviewChangeDescriptor,
  type GitReviewCancellationSignal,
  type GitReviewChangeDescriptor,
  type GitReviewContentRequest,
  type GitReviewItemContent,
  type GitReviewPort,
} from '../../../core/domains/git-review/public-api';
import type {
  GitCommandPort,
  GitCommandResult,
} from '../../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';
import { createGitReviewContentIdentity } from './git-review-content-identity';
import {
  decodeGitReviewText,
  isGitReviewContentUnavailable,
  readGitReviewWorkingContent,
  tryReadGitReviewWorkingContent,
} from './git-review-content-reader';
import { parseGitReviewBinaryNumstat } from './git-review-numstat-parser';
import {
  parseGitReviewStatus,
  type GitReviewStatusEntry,
} from './git-review-status-parser';
import {
  assertGitReviewRequestActive,
  gitReviewStaleItem,
  gitReviewUnavailableRepository,
  isGitReviewMissingHeadError,
  isGitReviewObjectHash,
  isGitReviewRepositoryRoot,
  isSameGitReviewPhysicalPath,
  mapGitReviewFailure,
  parseGitReviewRepositoryRoot,
} from './git-review-git-boundary';

const GIT_OPTIONAL_LOCKS = '--no-optional-locks';
const GIT_REVIEW_STATUS_ARGS = [
  GIT_OPTIONAL_LOCKS,
  '-c',
  'core.quotePath=false',
  'status',
  '--porcelain=v2',
  '-z',
  '--untracked-files=all',
] as const;
const GIT_REVIEW_NUMSTAT_ARGS = [
  GIT_OPTIONAL_LOCKS,
  '-c',
  'core.quotePath=false',
  'diff',
  '--no-ext-diff',
  '--numstat',
  '-z',
  '-M',
  'HEAD',
  '--',
] as const;

type GitReviewInventory = {
  readonly repositoryRoot: string;
  readonly hasHead: boolean;
  readonly changes: readonly GitReviewChangeDescriptor[];
};

export class GitReviewPortAdapter implements GitReviewPort {
  public constructor(
    private readonly git: GitCommandPort,
    private readonly isWorkspaceTrusted: () => boolean,
  ) {}

  public async listChanges(
    repositoryRoot: string,
    signal: GitReviewCancellationSignal,
  ): Promise<readonly GitReviewChangeDescriptor[]> {
    return (await this.loadInventory(repositoryRoot, signal)).changes;
  }

  public async readItemContent(
    request: GitReviewContentRequest,
    signal: GitReviewCancellationSignal,
  ): Promise<GitReviewItemContent> {
    validateContentRequest(request);
    const inventory = await this.loadInventory(request.repositoryRoot, signal);
    assertGitReviewRequestActive(signal);
    const item = findCurrentItem(inventory.changes, request.item);
    if (item === undefined) {
      throw gitReviewStaleItem();
    }
    if (item.presentation === 'submodule') {
      return { kind: 'summary', reason: 'submodule' };
    }
    if (item.presentation === 'binary') {
      return { kind: 'summary', reason: 'binary' };
    }

    try {
      const before = await this.readBeforeContent(inventory, item, signal);
      const after = await this.readAfterContent(inventory.repositoryRoot, item, signal);
      if (before === undefined || after === undefined) {
        return { kind: 'summary', reason: 'binary' };
      }
      return { kind: 'text', before, after };
    } catch (error: unknown) {
      if (isGitReviewContentUnavailable(error)) {
        return { kind: 'summary', reason: 'unavailable' };
      }
      throw error;
    }
  }

  private async loadInventory(
    repositoryRoot: string,
    signal: GitReviewCancellationSignal,
  ): Promise<GitReviewInventory> {
    this.assertReady(repositoryRoot, signal);
    const root = await this.resolveRepositoryRoot(repositoryRoot, signal);
    const hasHead = await this.hasHead(root, signal);
    const status = await this.run(
      root,
      'git-review-status',
      GIT_REVIEW_STATUS_ARGS,
      signal,
    );
    assertGitReviewRequestActive(signal);
    const entries = parseGitReviewStatus(status.stdout);
    const binaryPaths = hasHead
      ? parseGitReviewBinaryNumstat(
          (await this.run(root, 'git-review-numstat', GIT_REVIEW_NUMSTAT_ARGS, signal))
            .stdout,
        )
      : new Set<string>();
    assertGitReviewRequestActive(signal);
    const changes = await this.createDescriptors(root, entries, binaryPaths, signal);
    return { repositoryRoot: root, hasHead, changes };
  }

  private async createDescriptors(
    repositoryRoot: string,
    entries: readonly GitReviewStatusEntry[],
    binaryPaths: ReadonlySet<string>,
    signal: GitReviewCancellationSignal,
  ): Promise<readonly GitReviewChangeDescriptor[]> {
    const descriptors: GitReviewChangeDescriptor[] = [];
    for (const entry of entries) {
      assertGitReviewRequestActive(signal);
      const workingContent =
        entry.change === 'deleted' || entry.presentation === 'submodule'
          ? undefined
          : await tryReadGitReviewWorkingContent(repositoryRoot, entry.path);
      assertGitReviewRequestActive(signal);
      descriptors.push({
        path: entry.path,
        ...(entry.previousPath === undefined
          ? {}
          : { previousPath: entry.previousPath }),
        contentIdentity: createGitReviewContentIdentity(entry, workingContent),
        change: entry.change,
        presentation: this.toPresentation(entry, binaryPaths, workingContent),
      });
    }
    return descriptors;
  }

  private toPresentation(
    entry: GitReviewStatusEntry,
    binaryPaths: ReadonlySet<string>,
    workingContent: Buffer | undefined,
  ): GitReviewChangeDescriptor['presentation'] {
    if (entry.presentation === 'submodule') {
      return 'submodule';
    }
    if (binaryPaths.has(entry.path) || isBinaryContent(workingContent)) {
      return 'binary';
    }
    return 'text';
  }

  private async resolveRepositoryRoot(
    requestedRoot: string,
    signal: GitReviewCancellationSignal,
  ): Promise<string> {
    const result = await this.run(
      requestedRoot,
      'git-review-repository-root',
      [GIT_OPTIONAL_LOCKS, 'rev-parse', '--show-toplevel'],
      signal,
    );
    const resolvedRoot = parseGitReviewRepositoryRoot(result.stdout);
    if (!(await isSameGitReviewPhysicalPath(resolvedRoot, requestedRoot))) {
      throw gitReviewUnavailableRepository();
    }
    return resolvedRoot;
  }

  private async hasHead(
    repositoryRoot: string,
    signal: GitReviewCancellationSignal,
  ): Promise<boolean> {
    const result = await this.readHead(repositoryRoot, signal);
    if (result === undefined) {
      return false;
    }
    if (!isGitReviewObjectHash(result.stdout.trim())) {
      throw new ApplicationError('Git Review HEAD output is invalid.', {
        code: 'internal-error',
      });
    }
    return true;
  }

  private async readHead(
    repositoryRoot: string,
    signal: GitReviewCancellationSignal,
  ): Promise<GitCommandResult | undefined> {
    try {
      return await this.git.run({
        operation: 'git-review-head',
        cwd: repositoryRoot,
        args: [GIT_OPTIONAL_LOCKS, 'rev-parse', '--verify', '--quiet', 'HEAD'],
        signal,
      });
    } catch (error: unknown) {
      if (isGitReviewMissingHeadError(error)) {
        return undefined;
      }
      throw mapGitReviewFailure(error);
    }
  }

  private async readBeforeContent(
    inventory: GitReviewInventory,
    item: GitReviewChangeDescriptor,
    signal: GitReviewCancellationSignal,
  ): Promise<string | undefined> {
    if (!inventory.hasHead || item.change === 'added' || item.change === 'untracked') {
      return '';
    }
    const pathAtHead = item.previousPath ?? item.path;
    const result = await this.run(
      inventory.repositoryRoot,
      'git-review-before-content',
      [
        GIT_OPTIONAL_LOCKS,
        'show',
        '--no-ext-diff',
        '--no-textconv',
        `HEAD:${pathAtHead}`,
      ],
      signal,
    );
    return decodeGitReviewText(Buffer.from(result.stdout, 'utf8'));
  }

  private async readAfterContent(
    repositoryRoot: string,
    item: GitReviewChangeDescriptor,
    signal: GitReviewCancellationSignal,
  ): Promise<string | undefined> {
    if (item.change === 'deleted') {
      return '';
    }
    assertGitReviewRequestActive(signal);
    const content = await readGitReviewWorkingContent(repositoryRoot, item.path);
    assertGitReviewRequestActive(signal);
    return decodeGitReviewText(content);
  }

  private assertReady(
    repositoryRoot: string,
    signal: GitReviewCancellationSignal,
  ): void {
    assertGitReviewRequestActive(signal);
    if (!this.isWorkspaceTrusted()) {
      throw new ApplicationError('Git requires a trusted workspace.', {
        code: 'permission-denied',
      });
    }
    if (!isGitReviewRepositoryRoot(repositoryRoot)) {
      throw gitReviewUnavailableRepository();
    }
  }

  private async run(
    cwd: string,
    operation: string,
    args: readonly string[],
    signal: GitReviewCancellationSignal,
  ): Promise<GitCommandResult> {
    try {
      return await this.git.run({ operation, cwd, args, signal });
    } catch (error: unknown) {
      throw mapGitReviewFailure(error);
    }
  }
}

function validateContentRequest(request: GitReviewContentRequest): void {
  if (
    !isGitReviewRepositoryRoot(request.repositoryRoot) ||
    !isGitReviewChangeDescriptor(request.item)
  ) {
    throw new ApplicationError('Git Review content request is invalid.', {
      code: 'invalid-input',
    });
  }
}

function findCurrentItem(
  changes: readonly GitReviewChangeDescriptor[],
  item: GitReviewChangeDescriptor,
): GitReviewChangeDescriptor | undefined {
  return changes.find(
    (candidate) =>
      candidate.path === item.path &&
      candidate.contentIdentity === item.contentIdentity,
  );
}

function isBinaryContent(content: Buffer | undefined): boolean {
  return content !== undefined && decodeGitReviewText(content) === undefined;
}
