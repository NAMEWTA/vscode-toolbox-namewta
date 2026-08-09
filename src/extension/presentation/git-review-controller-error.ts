import type { ToolError } from '../../core/contracts/tool-error-contract';
import { ApplicationError } from '../../core/kernel/application-error';

export function isGitReviewAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function unavailableGitReviewCurrentItemError(): ApplicationError {
  return new ApplicationError('The Git Review current item is unavailable.', {
    code: 'internal-error',
  });
}

export function toGitReviewToolError(error: unknown): ToolError {
  if (error instanceof ApplicationError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(error.details === undefined ? {} : { details: error.details }),
    };
  }
  return {
    code: 'internal-error',
    message: 'Git Review controller failed.',
    retryable: false,
  };
}
