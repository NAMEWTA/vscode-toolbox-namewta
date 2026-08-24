import type {
  ToolCommandId,
  ToolCommandInput,
  ToolCommandOutput,
} from '../../core/contracts';
import type {
  GitReviewItem,
  GitReviewSessionSnapshot,
} from '../../core/domains/git-review/public-api';
import type { Disposable } from '../../core/kernel/disposable';
import {
  isGitReviewAbortError,
  toGitReviewToolError,
} from './git-review-controller-error';
import {
  GitReviewOperationTracker,
  type GitReviewOperation,
} from './git-review-operation-tracker';
import {
  calculateGitReviewNavigation,
  getActiveGitReviewSession,
  getGitReviewSession,
} from './git-review-session-snapshot';
import { startGitReviewSession } from './git-review-session-start';
import { resolveGitReviewQueueCommandItem } from './git-review-queue-command-item';
import type { GitReviewSessionControllerDependencies } from './git-review-session-controller-contract';

type GitReviewGatewayCommand = Extract<ToolCommandId, `gitReview.${string}`>;
type GitReviewSnapshotCommand =
  | 'gitReview.start'
  | 'gitReview.previous'
  | 'gitReview.next'
  | 'gitReview.markReviewedAndNext'
  | 'gitReview.retry'
  | 'gitReview.skip'
  | 'gitReview.refresh'
  | 'gitReview.end'
  | 'gitReview.markStale';

const EMPTY_INPUT: Record<string, never> = {};

export class GitReviewSessionController implements Disposable {
  #snapshot: GitReviewSessionSnapshot = { state: 'inactive' };
  readonly #operations = new GitReviewOperationTracker();
  #watcher: Disposable | undefined;
  #watchedRepositoryRoot: string | undefined;
  #staleRequested = false;
  #isDisposed = false;

  public constructor(
    private readonly dependencies: GitReviewSessionControllerDependencies,
  ) {}

  public async start(...args: readonly unknown[]): Promise<void> {
    const operation = this.#operations.begin();
    try {
      await startGitReviewSession(
        {
          resolveRepository: (values, signal) =>
            this.dependencies.repositoryResolver.resolve(values, signal),
          confirmReplace: () => this.dependencies.host.confirmReplace(),
          getSnapshot: () => this.#snapshot,
          isCurrent: () => this.isCurrent(operation),
          clearReplacedSession: () => this.clearReplacedSession(),
          executeStart: (repositoryRoot, replace) =>
            this.execute(operation, 'gitReview.start', { repositoryRoot, replace }),
          applySnapshot: (snapshot, openCurrentItem) =>
            this.applySnapshot(snapshot, operation, openCurrentItem),
        },
        args,
        operation.controller.signal,
      );
    } catch (error: unknown) {
      await this.reportException(operation, error);
    } finally {
      this.#operations.finish(operation);
    }
  }

  public previous(): Promise<void> {
    return this.runSnapshotCommand('gitReview.previous', true);
  }

  public next(): Promise<void> {
    return this.runSnapshotCommand('gitReview.next', true);
  }

  public markReviewedAndNext(): Promise<void> {
    return this.runSnapshotCommand('gitReview.markReviewedAndNext', true);
  }

  public retry(): Promise<void> {
    return this.runSnapshotCommand('gitReview.retry', true);
  }

  public skip(): Promise<void> {
    return this.runSnapshotCommand('gitReview.skip', true);
  }

  public refresh(): Promise<void> {
    return this.runSnapshotCommand('gitReview.refresh', true);
  }

  public end(): Promise<void> {
    return this.runSnapshotCommand('gitReview.end', false);
  }

  public stageItem(...args: readonly unknown[]): Promise<void> {
    return this.runItemCommand('gitReview.stageItem', args);
  }

  public unstageItem(...args: readonly unknown[]): Promise<void> {
    return this.runItemCommand('gitReview.unstageItem', args);
  }

  public discardItem(...args: readonly unknown[]): Promise<void> {
    return this.runItemCommand('gitReview.discardItem', args);
  }

  public async select(item: GitReviewItem): Promise<void> {
    if (this.#snapshot.state !== 'active') {
      return;
    }
    const session = this.#snapshot.session;
    const targetIndex = session.items.findIndex(
      (candidate) => candidate.itemId === item.itemId,
    );
    const currentIndex = session.items.findIndex(
      (candidate) => candidate.itemId === session.currentItemId,
    );
    if (targetIndex < 0 || currentIndex < 0) {
      return;
    }

    const operation = this.#operations.begin();
    try {
      const navigation = calculateGitReviewNavigation(targetIndex, currentIndex);
      let snapshot: GitReviewSessionSnapshot = this.#snapshot;
      for (let index = 0; index < navigation.count; index += 1) {
        const nextSnapshot = await this.execute(
          operation,
          navigation.command,
          EMPTY_INPUT,
        );
        if (nextSnapshot === undefined || !this.isCurrent(operation)) {
          return;
        }
        snapshot = nextSnapshot;
      }
      await this.applySnapshot(snapshot, operation, true);
    } catch (error: unknown) {
      await this.reportException(operation, error);
    } finally {
      this.#operations.finish(operation);
    }
  }

  public async markStale(): Promise<void> {
    if (this.#snapshot.state !== 'active' || this.#staleRequested) {
      return;
    }
    this.#staleRequested = true;
    const operation = this.#operations.begin();
    try {
      const snapshot = await this.execute(
        operation,
        'gitReview.markStale',
        EMPTY_INPUT,
      );
      if (snapshot !== undefined && this.isCurrent(operation)) {
        await this.applySnapshot(snapshot, operation, false);
        if (snapshot.state === 'stale' && this.isCurrent(operation)) {
          await this.dependencies.host.showStale();
        }
      }
    } catch (error: unknown) {
      await this.reportException(operation, error);
    } finally {
      this.#staleRequested = false;
      this.#operations.finish(operation);
    }
  }

  public dispose(): void {
    if (this.#isDisposed) {
      return;
    }
    this.#isDisposed = true;
    this.#operations.dispose();
    this.releaseWatcher();
    this.dependencies.presentation.dispose();
  }

  private async runSnapshotCommand(
    command: Exclude<GitReviewSnapshotCommand, 'gitReview.start'>,
    openCurrentItem: boolean,
  ): Promise<void> {
    const operation = this.#operations.begin();
    try {
      if (
        command === 'gitReview.end' &&
        getGitReviewSession(this.#snapshot)?.progress.remaining !== 0 &&
        !(await this.dependencies.host.confirmEnd())
      ) {
        return;
      }
      if (!this.isCurrent(operation)) {
        return;
      }
      const snapshot = await this.execute(operation, command, EMPTY_INPUT);
      if (snapshot !== undefined && this.isCurrent(operation)) {
        await this.applySnapshot(snapshot, operation, openCurrentItem);
      }
    } catch (error: unknown) {
      await this.reportException(operation, error);
    } finally {
      this.#operations.finish(operation);
    }
  }

  private async runItemCommand(
    command: 'gitReview.stageItem' | 'gitReview.unstageItem' | 'gitReview.discardItem',
    args: readonly unknown[],
  ): Promise<void> {
    const operation = this.#operations.begin();
    try {
      const item = resolveGitReviewQueueCommandItem(args, this.#snapshot);
      if (
        command === 'gitReview.discardItem' &&
        !(await this.dependencies.host.confirmDiscard(item.path))
      ) {
        return;
      }
      const snapshot = await this.execute(operation, command, {
        itemId: item.itemId,
        contentIdentity: item.contentIdentity,
      });
      if (snapshot !== undefined && this.isCurrent(operation)) {
        await this.applySnapshot(snapshot, operation, false);
      }
    } catch (error: unknown) {
      await this.reportException(operation, error);
    } finally {
      this.#operations.finish(operation);
    }
  }

  private async execute<TCommand extends GitReviewGatewayCommand>(
    operation: GitReviewOperation,
    command: TCommand,
    input: ToolCommandInput<TCommand>,
  ): Promise<ToolCommandOutput<TCommand> | undefined> {
    const result = await this.dependencies.gateway.execute(command, input, {
      signal: operation.controller.signal,
      source: 'extension-command',
    });
    if (!this.isCurrent(operation)) {
      return undefined;
    }
    if (!result.ok) {
      if (result.error.code !== 'cancelled') {
        await this.dependencies.host.reportFailure(result.error);
      }
      return undefined;
    }
    return result.data;
  }

  private async applySnapshot(
    snapshot: GitReviewSessionSnapshot,
    operation: GitReviewOperation,
    openCurrentItem: boolean,
  ): Promise<void> {
    this.#snapshot = snapshot;
    this.dependencies.presentation.render(snapshot);
    if (snapshot.state === 'completed') {
      this.releaseWatcher();
      try {
        await this.dependencies.host.showSummary(snapshot.summary);
      } finally {
        if (this.isCurrent(operation)) {
          this.#snapshot = { state: 'inactive' };
          this.dependencies.presentation.render(this.#snapshot);
        }
      }
      return;
    }

    const session = getGitReviewSession(snapshot);
    if (session === undefined) {
      this.releaseWatcher();
      return;
    }
    this.ensureWatcher(session.repositoryRoot);
    if (openCurrentItem) {
      this.focusCurrentItem();
    }
  }

  private focusCurrentItem(): void {
    const session = getActiveGitReviewSession(this.#snapshot);
    if (session === undefined) return;
    const item = session.items.find(
      (candidate) => candidate.itemId === session.currentItemId,
    );
    if (item !== undefined) this.dependencies.presentation.focusItem?.(item);
  }

  private ensureWatcher(repositoryRoot: string): void {
    if (this.#watchedRepositoryRoot === repositoryRoot) {
      return;
    }
    this.releaseWatcher();
    this.#watcher = this.dependencies.watcherFactory(repositoryRoot, () =>
      this.markStale(),
    );
    this.#watchedRepositoryRoot = repositoryRoot;
  }

  private clearReplacedSession(): void {
    this.#snapshot = { state: 'inactive' };
    this.releaseWatcher();
    this.dependencies.presentation.render(this.#snapshot);
  }

  private releaseWatcher(): void {
    this.#watcher?.dispose();
    this.#watcher = undefined;
    this.#watchedRepositoryRoot = undefined;
  }

  private isCurrent(operation: GitReviewOperation): boolean {
    return this.#operations.isCurrent(operation);
  }

  private async reportException(
    operation: GitReviewOperation,
    error: unknown,
  ): Promise<void> {
    if (!this.isCurrent(operation) || isGitReviewAbortError(error)) {
      return;
    }
    await this.dependencies.host.reportFailure(toGitReviewToolError(error));
  }
}
