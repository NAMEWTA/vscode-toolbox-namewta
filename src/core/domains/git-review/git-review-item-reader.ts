import { ApplicationError } from '../../kernel/application-error';
import {
  isGitReviewItemContent,
  type GitReviewItemContent,
  type GitReviewItemContentInput,
} from './git-review-model';
import {
  isGitReviewItemPatch,
  type GitReviewItemActionInput,
  type GitReviewItemPatch,
} from './git-review-patch-model';
import type { GitReviewCancellationSignal, GitReviewPort } from './git-review-port';
import type { GitReviewRequestTracker } from './git-review-request-tracker';
import {
  toGitReviewChangeDescriptor,
  type ActiveGitReviewSession,
} from './git-review-session-state';

export class GitReviewItemReader {
  public constructor(
    private readonly port: GitReviewPort,
    private readonly requests: GitReviewRequestTracker,
  ) {}

  public async readContent(
    session: ActiveGitReviewSession,
    input: GitReviewItemContentInput,
    signal: GitReviewCancellationSignal,
  ): Promise<GitReviewItemContent> {
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
    const request = this.requests.startRead(signal);
    try {
      const content = await this.port.readItemContent(
        {
          repositoryRoot: session.repositoryRoot,
          item: toGitReviewChangeDescriptor(item),
        },
        request.signal,
      );
      this.requests.assertRead(request);
      if (!isGitReviewItemContent(content)) {
        throw invalidPortResult('content');
      }
      return content;
    } finally {
      this.requests.finishRead(request);
    }
  }

  public async readPatch(
    session: ActiveGitReviewSession,
    input: GitReviewItemActionInput,
    signal: GitReviewCancellationSignal,
  ): Promise<GitReviewItemPatch> {
    const item = findGitReviewActionItem(session, input);
    const request = this.requests.startRead(signal);
    try {
      const patch = await this.port.readItemPatch(
        {
          repositoryRoot: session.repositoryRoot,
          item: toGitReviewChangeDescriptor(item),
        },
        request.signal,
      );
      this.requests.assertRead(request);
      if (!isGitReviewItemPatch(patch)) {
        throw invalidPortResult('patch');
      }
      return patch;
    } finally {
      this.requests.finishRead(request);
    }
  }
}

export function findGitReviewActionItem(
  session: ActiveGitReviewSession,
  input: GitReviewItemActionInput,
): ActiveGitReviewSession['items'][number] {
  const item = session.items.find(
    (candidate) =>
      candidate.itemId === input.itemId &&
      candidate.contentIdentity === input.contentIdentity,
  );
  if (item === undefined) {
    throw new ApplicationError('The Git Review item is stale.', {
      code: 'capability-unavailable',
      retryable: true,
      details: { reason: 'stale-item' },
    });
  }
  return item;
}

function invalidPortResult(kind: 'content' | 'patch'): ApplicationError {
  return new ApplicationError(`Git Review ${kind} is invalid.`, {
    code: 'internal-error',
  });
}
