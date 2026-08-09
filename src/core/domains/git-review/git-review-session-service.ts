import { ApplicationError } from '../../kernel/application-error';
import type { Disposable } from '../../kernel/disposable';
import {
  isGitReviewItemContent,
  type GitReviewItemContent,
  type GitReviewItemContentInput,
  type GitReviewItemState,
  type GitReviewSessionSnapshot,
  type GitReviewStartInput,
} from './git-review-model';
import type { GitReviewCancellationSignal, GitReviewPort } from './git-review-port';
import {
  createGitReviewCancellableRequest,
  type GitReviewCancellableRequest,
} from './git-review-cancellable-request';
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
  #request: GitReviewCancellableRequest | undefined;
  #isDisposed = false;

  public constructor(private readonly port: GitReviewPort) {}

  public async start(
    input: GitReviewStartInput,
    signal: GitReviewCancellationSignal,
  ): Promise<GitReviewSessionSnapshot> {
    this.assertCanStart(input, signal);
    if (this.hasRunningSession()) {
      this.end();
    }

    const request = this.startRequest(signal);
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
    const request = this.startRequest(signal);
    this.#state = 'refreshing';

    try {
      const changes = await this.port.listChanges(
        previousSession.repositoryRoot,
        request.signal,
      );
      this.assertCurrentRequest(request);
      if (changes.length === 0) {
        throw createNoChangesError();
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
      if (this.#request === request && this.#session === previousSession) {
        this.#state = previousState;
      }
      throw error;
    } finally {
      this.finishRequest(request);
    }
  }

  public async getItemContent(
    input: GitReviewItemContentInput,
    signal: GitReviewCancellationSignal,
  ): Promise<GitReviewItemContent> {
    const session = this.requireRefreshableSession();
    const item = session.items.find(
      (candidate) =>
        candidate.path === input.path &&
        candidate.contentIdentity === input.contentIdentity,
    );
    if (item === undefined) {
      throw new ApplicationError('The Git Review item no longer matches the session.', {
        code: 'invalid-input',
      });
    }

    const request = this.startRequest(signal);
    try {
      const content = await this.port.readItemContent(
        {
          repositoryRoot: session.repositoryRoot,
          item: toGitReviewChangeDescriptor(item),
        },
        request.signal,
      );
      this.assertCurrentRequest(request);
      if (!isGitReviewItemContent(content)) {
        throw new ApplicationError('Git Review content is invalid.', {
          code: 'internal-error',
        });
      }
      return content;
    } finally {
      this.finishRequest(request);
    }
  }

  public end(): GitReviewSessionSnapshot {
    this.abortRequest();
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
      this.assertCurrentRequest(request);
      if (changes.length === 0) {
        throw createNoChangesError();
      }

      this.#session = createActiveGitReviewSession(input.repositoryRoot, changes);
      this.#state = 'active';
      return this.getSnapshot();
    } catch (error: unknown) {
      if (this.#request === request) {
        this.#session = undefined;
        this.#state = 'inactive';
      }
      throw error;
    } finally {
      this.finishRequest(request);
    }
  }

  private assertCanStart(
    input: GitReviewStartInput,
    signal: GitReviewCancellationSignal,
  ): void {
    if (this.#isDisposed || signal.aborted) {
      throw createAbortError();
    }
    if (this.hasRunningSession() && !input.replace) {
      throw new ApplicationError('A Git Review session is already active.', {
        code: 'invalid-input',
      });
    }
  }

  private hasRunningSession(): boolean {
    return this.#session !== undefined || this.#request !== undefined;
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

  private startRequest(
    signal: GitReviewCancellationSignal,
  ): GitReviewCancellableRequest {
    if (signal.aborted) {
      throw createAbortError();
    }
    this.abortRequest();
    const request = createGitReviewCancellableRequest(signal);
    this.#request = request;
    return request;
  }

  private finishRequest(request: GitReviewCancellableRequest): void {
    request.dispose();
    if (this.#request === request) {
      this.#request = undefined;
    }
  }

  private abortRequest(): void {
    if (this.#request === undefined) {
      return;
    }
    this.#request.abort();
    this.#request.dispose();
    this.#request = undefined;
  }

  private assertCurrentRequest(request: GitReviewCancellableRequest): void {
    if (this.#isDisposed || request.signal.aborted || this.#request !== request) {
      throw createAbortError();
    }
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

function createNoChangesError(): ApplicationError {
  return new ApplicationError('No Git changes are available for review.', {
    code: 'capability-unavailable',
    details: { reason: 'no-changes' },
  });
}

function createAbortError(): Error {
  const error = new Error('The Git Review request was cancelled.');
  error.name = 'AbortError';
  return error;
}
