import type { GitReviewCancellationSignal } from './git-review-port';
import {
  createGitReviewCancellableRequest,
  type GitReviewCancellableRequest,
} from './git-review-cancellable-request';

export class GitReviewRequestTracker {
  #exclusive: GitReviewCancellableRequest | undefined;
  readonly #reads = new Set<GitReviewCancellableRequest>();

  public constructor(private readonly isDisposed: () => boolean) {}

  public startExclusive(
    signal: GitReviewCancellationSignal,
  ): GitReviewCancellableRequest {
    this.assertCanStart(signal);
    this.abortAll();
    const request = createGitReviewCancellableRequest(signal);
    this.#exclusive = request;
    return request;
  }

  public finishExclusive(request: GitReviewCancellableRequest): void {
    request.dispose();
    if (this.#exclusive === request) {
      this.#exclusive = undefined;
    }
  }

  public assertExclusive(request: GitReviewCancellableRequest): void {
    if (this.isDisposed() || request.signal.aborted || this.#exclusive !== request) {
      throw abortError();
    }
  }

  public isExclusive(request: GitReviewCancellableRequest): boolean {
    return this.#exclusive === request;
  }

  public hasExclusive(): boolean {
    return this.#exclusive !== undefined;
  }

  public startRead(signal: GitReviewCancellationSignal): GitReviewCancellableRequest {
    this.assertCanStart(signal);
    const request = createGitReviewCancellableRequest(signal);
    this.#reads.add(request);
    return request;
  }

  public finishRead(request: GitReviewCancellableRequest): void {
    request.dispose();
    this.#reads.delete(request);
  }

  public assertRead(request: GitReviewCancellableRequest): void {
    if (this.isDisposed() || request.signal.aborted || !this.#reads.has(request)) {
      throw abortError();
    }
  }

  public abortAll(): void {
    if (this.#exclusive !== undefined) {
      this.#exclusive.abort();
      this.#exclusive.dispose();
      this.#exclusive = undefined;
    }
    for (const request of this.#reads) {
      request.abort();
      request.dispose();
    }
    this.#reads.clear();
  }

  private assertCanStart(signal: GitReviewCancellationSignal): void {
    if (signal.aborted || this.isDisposed()) {
      throw abortError();
    }
  }
}

function abortError(): Error {
  const error = new Error('The Git Review request was cancelled.');
  error.name = 'AbortError';
  return error;
}
