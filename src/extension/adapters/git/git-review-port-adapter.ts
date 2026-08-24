import {
  type GitReviewCancellationSignal,
  type GitReviewChangeDescriptor,
  type GitReviewContentRequest,
  type GitReviewItemContent,
  type GitReviewMutationRequest,
  type GitReviewPort,
} from '../../../core/domains/git-review/public-api';
import type {
  GitCommandPort,
  GitCommandResult,
} from '../../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';
import { isGitReviewContentUnavailable } from './git-review-content-reader';
import { createGitReviewDescriptors } from './git-review-descriptor-factory';
import { parseGitReviewBinaryNumstat } from './git-review-numstat-parser';
import { parseGitReviewStatus } from './git-review-status-parser';
import {
  assertGitReviewMutationAllowed,
  createGitReviewMutationArgs,
  createGitReviewNumstatArgs,
  findCurrentGitReviewItem,
  gitReviewItemSummary,
  validateGitReviewContentRequest,
} from './git-review-port-operation';
import {
  readGitReviewAfterContent,
  readGitReviewBeforeContent,
} from './git-review-revision-content-reader';
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
    validateGitReviewContentRequest(request);
    const inventory = await this.loadInventory(request.repositoryRoot, signal);
    assertGitReviewRequestActive(signal);
    const item = findCurrentGitReviewItem(inventory.changes, request.item);
    if (item === undefined) {
      throw gitReviewStaleItem();
    }
    const summary = gitReviewItemSummary(item);
    if (summary !== undefined) {
      return summary;
    }

    try {
      const before = await readGitReviewBeforeContent(
        inventory,
        item,
        signal,
        (operation, args, requestSignal) =>
          this.run(inventory.repositoryRoot, operation, args, requestSignal),
      );
      const after = await readGitReviewAfterContent(
        inventory.repositoryRoot,
        item,
        signal,
        (operation, args, requestSignal) =>
          this.run(inventory.repositoryRoot, operation, args, requestSignal),
      );
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

  public async mutateItem(
    request: GitReviewMutationRequest,
    signal: GitReviewCancellationSignal,
  ): Promise<readonly GitReviewChangeDescriptor[]> {
    validateGitReviewContentRequest(request);
    const inventory = await this.loadInventory(request.repositoryRoot, signal);
    const item = findCurrentGitReviewItem(inventory.changes, request.item);
    if (item === undefined) {
      throw gitReviewStaleItem();
    }
    assertGitReviewMutationAllowed(item, request.mutation);
    await this.run(
      inventory.repositoryRoot,
      `git-review-${request.mutation}`,
      createGitReviewMutationArgs(inventory.hasHead, item, request.mutation),
      signal,
    );
    return (await this.loadInventory(inventory.repositoryRoot, signal)).changes;
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
    const binaryPaths = parseGitReviewBinaryNumstat(
      (
        await this.run(
          root,
          'git-review-numstat',
          createGitReviewNumstatArgs(hasHead),
          signal,
        )
      ).stdout,
    );
    assertGitReviewRequestActive(signal);
    const changes = await createGitReviewDescriptors(
      root,
      entries,
      binaryPaths,
      signal,
    );
    return { repositoryRoot: root, hasHead, changes };
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
    maxOutputBytes?: number,
  ): Promise<GitCommandResult> {
    try {
      return await this.git.run({
        operation,
        cwd,
        args,
        signal,
        ...(maxOutputBytes === undefined ? {} : { maxOutputBytes }),
      });
    } catch (error: unknown) {
      throw mapGitReviewFailure(error);
    }
  }
}
