import type { GitReviewCancellationSignal } from './git-review-port';

export type GitReviewCancellableRequest = {
  readonly signal: GitReviewCancellationSignal;
  abort(): void;
  dispose(): void;
};

export function createGitReviewCancellableRequest(
  externalSignal: GitReviewCancellationSignal,
): GitReviewCancellableRequest {
  let aborted = externalSignal.aborted;
  const listeners = new Set<() => void>();
  const abort = (): void => {
    if (aborted) {
      return;
    }
    aborted = true;
    for (const listener of listeners) {
      listener();
    }
  };
  const handleExternalAbort = (): void => abort();
  externalSignal.addEventListener?.('abort', handleExternalAbort, { once: true });
  if (externalSignal.aborted) {
    abort();
  }

  return {
    signal: {
      get aborted(): boolean {
        return aborted;
      },
      addEventListener: (_type, listener): void => {
        if (aborted) {
          listener();
          return;
        }
        listeners.add(listener);
      },
      removeEventListener: (_type, listener): void => {
        listeners.delete(listener);
      },
    },
    abort,
    dispose: (): void => {
      externalSignal.removeEventListener?.('abort', handleExternalAbort);
      listeners.clear();
    },
  };
}
