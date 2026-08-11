import { ApplicationError } from '../../kernel/application-error';
import type { GitReviewLayer } from './git-review-model';
import type { GitReviewMutation } from './git-review-port';

export function assertGitReviewMutationAllowed(
  layer: GitReviewLayer,
  mutation: GitReviewMutation,
): void {
  const isAllowed =
    (mutation === 'stage' && (layer === 'unstaged' || layer === 'conflict')) ||
    (mutation === 'unstage' && layer === 'staged') ||
    (mutation === 'discard' && layer === 'unstaged');
  if (!isAllowed) {
    throw new ApplicationError('The Git Review action is invalid for this layer.', {
      code: 'invalid-input',
    });
  }
}

export function createNoGitReviewChangesError(): ApplicationError {
  return new ApplicationError('No Git changes are available for review.', {
    code: 'capability-unavailable',
    details: { reason: 'no-changes' },
  });
}

export function createGitReviewAbortError(): Error {
  const error = new Error('The Git Review request was cancelled.');
  error.name = 'AbortError';
  return error;
}
