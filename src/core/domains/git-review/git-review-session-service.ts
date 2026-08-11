import { ApplicationError } from '../../kernel/application-error';
import type { Disposable } from '../../kernel/disposable';
import type {
  GitReviewItemContent,
  GitReviewItemContentInput,
  GitReviewItemState,
  GitReviewSessionSnapshot,
  GitReviewStartInput,
} from './git-review-model';
import type {
  GitReviewItemActionInput,
  GitReviewItemPatch,
} from './git-review-patch-model';
import type { GitReviewCancellationSignal, GitReviewPort } from './git-review-port';
import type { GitReviewCancellableRequest } from './git-review-cancellable-request';
import { findGitReviewActionItem, GitReviewItemReader } from './git-review-item-reader';
import { GitReviewRequestTracker } from './git-review-request-tracker';
import {
  assertGitReviewMutationAllowed,
  createGitReviewAbortError,
  createNoGitReviewChangesError,
} from './git-review-session-policy';
import {
  createActiveGitReviewSession,
  createGitReviewSessionSnapshot,
  createGitReviewSummary,
  findNextUnreviewedGitReviewItem,
  preserveGitReviewCurrentItem,
  preserveGitReviewStates,
  toGitReviewChangeDescriptor,
  type ActiveGitReviewSession,
  updateGitReviewItemState,
} from './git-review-session-state';

type GitReviewSessionState = 'inactive' | 'loading' | 'active' | 'stale' | 'refreshing';

export class GitReviewSessionService implements Disposable {
  #state: GitReviewSessionState = 'inactive';
  #session: ActiveGitReviewSession | undefined;
  readonly #requests = new GitReviewRequestTracker(() => this.#isDisposed);
  readonly #itemReader: GitReviewItemReader;
  #isDisposed = false;

  public constructor(private readonly port: GitReviewPort) {
    this.#itemReader = new GitReviewItemReader(port, this.#requests);
  }

  public async start(
    input: GitReviewStartInput,
    signal: GitReviewCancellationSignal,
  ): Promise<GitReviewSessionSnapshot> {
    this.assertCanStart(input, signal);
    if (this.hasRunningSession()) {
      this.end();
    }

    const request = this.#requests.startExclusive(signal);
    this.#state = 'loading';
    return this.loadStartedSession(input, request);
  }

  public next(): GitReviewSessionSnapshot {
    const session = this.requireActiveSession();
    session.currentIndex = Math.min(session.currentIndex + 1, session.items.length - 1);
    return this.getSnapshot();
  }

  public previous(): GitReviewSessionSnapshot {
    const session = this.requireActiveSession();
    session.currentIndex = Math.max(session.currentIndex - 1, 0);
    return this.getSnapshot();
  }

  public markReviewedAndNext(): GitReviewSessionSnapshot {
    return this.updateCurrentItemAndAdvance('reviewed');
  }

  public skip(): GitReviewSessionSnapshot {
    return this.updateCurrentItemAndAdvance('skipped');
  }

  public markStale(): GitReviewSessionSnapshot {
    if (this.#state === 'active') {
      this.#state = 'stale';
    }
    return this.getSnapshot();
  }

  public retry(): GitReviewSessionSnapshot {
    this.requireRefreshableSession();
    return this.getSnapshot();
  }

  public async refresh(
    signal: GitReviewCancellationSignal,
  ): Promise<GitReviewSessionSnapshot> {
    const previousSession = this.requireRefreshableSession();
    const previousState = this.#state;
    const request = this.#requests.startExclusive(signal);
    this.#state = 'refreshing';

    try {
      const changes = await this.port.listChanges(
        previousSession.repositoryRoot,
        request.signal,
      );
      this.#requests.assertExclusive(request);
      if (changes.length === 0) {
        throw createNoGitReviewChangesError();
      }

      const refreshedSession = createActiveGitReviewSession(
        previousSession.repositoryRoot,
        changes,
      );
      preserveGitReviewStates(previousSession, refreshedSession);
      preserveGitReviewCurrentItem(previousSession, refreshedSession);
      this.#session = refreshedSession;
      this.#state = 'active';
      return this.getSnapshot();
    } catch (error: unknown) {
      if (this.#requests.isExclusive(request) && this.#session === previousSession) {
        this.#state = previousState;
      }
      throw error;
    } finally {
      this.#requests.finishExclusive(request);
    }
  }

  public async getItemContent(
    input: GitReviewItemContentInput,
    signal: GitReviewCancellationSignal,
  ): Promise<GitReviewItemContent> {
    return this.#itemReader.readContent(
      this.requireRefreshableSession(),
      input,
      signal,
    );
  }

  public async getItemPatch(
    input: GitReviewItemActionInput,
    signal: GitReviewCancellationSignal,
  ): Promise<GitReviewItemPatch> {
    return this.#itemReader.readPatch(this.requireRefreshableSession(), input, signal);
  }

  public stageItem(
    input: GitReviewItemActionInput,
    signal: GitReviewCancellationSignal,
  ): Promise<GitReviewSessionSnapshot> {
    return this.mutateItem(input, 'stage', signal);
  }

  public unstageItem(
    input: GitReviewItemActionInput,
    signal: GitReviewCancellationSignal,
  ): Promise<GitReviewSessionSnapshot> {
    return this.mutateItem(input, 'unstage', signal);
  }

  public discardItem(
    input: GitReviewItemActionInput,
    signal: GitReviewCancellationSignal,
  ): Promise<GitReviewSessionSnapshot> {
    return this.mutateItem(input, 'discard', signal);
  }

  public end(): GitReviewSessionSnapshot {
    this.#requests.abortAll();
    this.#session = undefined;
    this.#state = 'inactive';
    return { state: 'inactive' };
  }

  public dispose(): void {
    if (this.#isDisposed) {
      return;
    }
    this.#isDisposed = true;
    this.end();
  }

  public getSnapshot(): GitReviewSessionSnapshot {
    if (this.#state === 'loading') {
      return { state: 'loading' };
    }
    if (this.#session === undefined) {
      return { state: 'inactive' };
    }
    return {
      state:
        this.#state === 'stale'
          ? 'stale'
          : this.#state === 'refreshing'
            ? 'refreshing'
            : 'active',
      session: createGitReviewSessionSnapshot(this.#session),
    };
  }

  private async loadStartedSession(
    input: GitReviewStartInput,
    request: GitReviewCancellableRequest,
  ): Promise<GitReviewSessionSnapshot> {
    try {
      const changes = await this.port.listChanges(input.repositoryRoot, request.signal);
      this.#requests.assertExclusive(request);
      if (changes.length === 0) {
        throw createNoGitReviewChangesError();
      }

      this.#session = createActiveGitReviewSession(input.repositoryRoot, changes);
      this.#state = 'active';
      return this.getSnapshot();
    } catch (error: unknown) {
      if (this.#requests.isExclusive(request)) {
        this.#session = undefined;
        this.#state = 'inactive';
      }
      throw error;
    } finally {
      this.#requests.finishExclusive(request);
    }
  }

  private async mutateItem(
    input: GitReviewItemActionInput,
    mutation: 'stage' | 'unstage' | 'discard',
    signal: GitReviewCancellationSignal,
  ): Promise<GitReviewSessionSnapshot> {
    const previousSession = this.requireActiveSession();
    const item = findGitReviewActionItem(previousSession, input);
    assertGitReviewMutationAllowed(item.layer, mutation);
    const request = this.#requests.startExclusive(signal);
    this.#state = 'refreshing';
    try {
      const changes = await this.port.mutateItem(
        {
          repositoryRoot: previousSession.repositoryRoot,
          item: toGitReviewChangeDescriptor(item),
          mutation,
        },
        request.signal,
      );
      this.#requests.assertExclusive(request);
      if (changes.length === 0) {
        this.#session = undefined;
        this.#state = 'inactive';
        return { state: 'inactive' };
      }
      const refreshedSession = createActiveGitReviewSession(
        previousSession.repositoryRoot,
        changes,
      );
      preserveGitReviewStates(previousSession, refreshedSession);
      preserveGitReviewCurrentItem(previousSession, refreshedSession);
      this.#session = refreshedSession;
      this.#state = 'active';
      return this.getSnapshot();
    } catch (error: unknown) {
      if (this.#requests.isExclusive(request) && this.#session === previousSession) {
        this.#state = 'active';
      }
      throw error;
    } finally {
      this.#requests.finishExclusive(request);
    }
  }

  private assertCanStart(
    input: GitReviewStartInput,
    signal: GitReviewCancellationSignal,
  ): void {
    if (this.#isDisposed || signal.aborted) {
      throw createGitReviewAbortError();
    }
    if (this.hasRunningSession() && !input.replace) {
      throw new ApplicationError('A Git Review session is already active.', {
        code: 'invalid-input',
      });
    }
  }

  private hasRunningSession(): boolean {
    return this.#session !== undefined || this.#requests.hasExclusive();
  }

  private requireActiveSession(): ActiveGitReviewSession {
    if (this.#state !== 'active' || this.#session === undefined) {
      throw new ApplicationError('No Git Review session is active.', {
        code: 'not-found',
      });
    }
    return this.#session;
  }

  private requireRefreshableSession(): ActiveGitReviewSession {
    if (
      this.#session === undefined ||
      (this.#state !== 'active' && this.#state !== 'stale')
    ) {
      throw new ApplicationError('No Git Review session is available to refresh.', {
        code: 'not-found',
      });
    }
    return this.#session;
  }

  private updateCurrentItemAndAdvance(
    reviewState: GitReviewItemState,
  ): GitReviewSessionSnapshot {
    const session = this.requireActiveSession();
    updateGitReviewItemState(session, reviewState);
    const nextUnreviewedIndex = findNextUnreviewedGitReviewItem(
      session.items,
      session.currentIndex,
    );
    if (nextUnreviewedIndex === undefined) {
      const summary = createGitReviewSummary(session.items);
      this.#session = undefined;
      this.#state = 'inactive';
      return { state: 'completed', summary };
    }

    session.currentIndex = nextUnreviewedIndex;
    return this.getSnapshot();
  }
}
