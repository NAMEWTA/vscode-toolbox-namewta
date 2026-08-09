import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { ApplicationError } from '../../../core/kernel/application-error';

export async function isSameGitReviewPhysicalPath(
  left: string,
  right: string,
): Promise<boolean> {
  try {
    return (await realpath(left)) === (await realpath(right));
  } catch {
    return false;
  }
}

export function parseGitReviewRepositoryRoot(output: string): string {
  const root = output.trim();
  if (!isGitReviewRepositoryRoot(root)) {
    throw gitReviewUnavailableRepository();
  }
  return path.resolve(root);
}

export function isGitReviewRepositoryRoot(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 4_096 &&
    !value.includes('\0') &&
    path.isAbsolute(value)
  );
}

export function isGitReviewObjectHash(value: string): boolean {
  return /^(?:[a-f\d]{40}|[a-f\d]{64})$/iu.test(value);
}

export function isGitReviewMissingHeadError(error: unknown): boolean {
  return (
    error instanceof ApplicationError &&
    error.code === 'internal-error' &&
    error.details?.exitCode === 1
  );
}

export function mapGitReviewFailure(error: unknown): ApplicationError {
  if (
    error instanceof ApplicationError &&
    (error.code === 'cancelled' ||
      error.code === 'timeout' ||
      error.code === 'permission-denied' ||
      error.code === 'capability-unavailable')
  ) {
    return error;
  }
  return new ApplicationError('Git Review is unavailable.', {
    code: 'capability-unavailable',
    cause: error,
  });
}

function gitReviewCancelled(): ApplicationError {
  return new ApplicationError('Git Review request was cancelled.', {
    code: 'cancelled',
  });
}

export function assertGitReviewRequestActive(signal: {
  readonly aborted: boolean;
}): void {
  if (signal.aborted) {
    throw gitReviewCancelled();
  }
}

export function gitReviewStaleItem(): ApplicationError {
  return new ApplicationError('The Git Review item is no longer current.', {
    code: 'capability-unavailable',
    retryable: true,
  });
}

export function gitReviewUnavailableRepository(): ApplicationError {
  return new ApplicationError('No executable Git repository is available for review.', {
    code: 'capability-unavailable',
  });
}
