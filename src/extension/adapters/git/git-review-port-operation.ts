import {
  isGitReviewChangeDescriptor,
  type GitReviewChangeDescriptor,
  type GitReviewContentRequest,
  type GitReviewItemContent,
  type GitReviewMutationRequest,
} from '../../../core/domains/git-review/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';
import { isGitReviewRepositoryRoot } from './git-review-git-boundary';

const GIT_OPTIONAL_LOCKS = '--no-optional-locks';

export function createGitReviewNumstatArgs(hasHead: boolean): readonly string[] {
  return [
    GIT_OPTIONAL_LOCKS,
    '-c',
    'core.quotePath=false',
    'diff',
    ...(hasHead ? [] : ['--cached']),
    '--no-ext-diff',
    '--numstat',
    '-z',
    '-M',
    ...(hasHead ? ['HEAD'] : []),
    '--',
  ];
}

export function validateGitReviewContentRequest(
  request: GitReviewContentRequest,
): void {
  if (
    !isGitReviewRepositoryRoot(request.repositoryRoot) ||
    !isGitReviewChangeDescriptor(request.item)
  ) {
    throw new ApplicationError('Git Review content request is invalid.', {
      code: 'invalid-input',
    });
  }
}

export function findCurrentGitReviewItem(
  changes: readonly GitReviewChangeDescriptor[],
  item: GitReviewChangeDescriptor,
): GitReviewChangeDescriptor | undefined {
  return changes.find(
    (candidate) =>
      candidate.itemId === item.itemId &&
      candidate.contentIdentity === item.contentIdentity,
  );
}

export function gitReviewItemSummary(
  item: GitReviewChangeDescriptor,
): Extract<GitReviewItemContent, { readonly kind: 'summary' }> | undefined {
  if (item.presentation === 'binary') {
    return { kind: 'summary', reason: 'binary' };
  }
  if (item.presentation === 'submodule') {
    return { kind: 'summary', reason: 'submodule' };
  }
  return item.layer === 'conflict'
    ? { kind: 'summary', reason: 'conflict' }
    : undefined;
}

export function createGitReviewMutationArgs(
  hasHead: boolean,
  item: GitReviewChangeDescriptor,
  mutation: GitReviewMutationRequest['mutation'],
): readonly string[] {
  const paths = gitReviewItemPaths(item);
  if (mutation === 'stage') {
    return ['add', '-A', '--', ...paths];
  }
  if (mutation === 'unstage') {
    return hasHead
      ? ['reset', '-q', 'HEAD', '--', ...paths]
      : ['rm', '--cached', '-q', '--ignore-unmatch', '--', ...paths];
  }
  return item.change === 'untracked'
    ? ['clean', '-f', '--', item.path]
    : ['restore', '--worktree', '--', ...paths];
}

export function assertGitReviewMutationAllowed(
  item: GitReviewChangeDescriptor,
  mutation: GitReviewMutationRequest['mutation'],
): void {
  const allowed =
    (mutation === 'stage' &&
      (item.layer === 'unstaged' || item.layer === 'conflict')) ||
    (mutation === 'unstage' && item.layer === 'staged') ||
    (mutation === 'discard' && item.layer === 'unstaged');
  if (!allowed) {
    throw new ApplicationError('Git Review mutation is invalid for this item.', {
      code: 'invalid-input',
    });
  }
}

function gitReviewItemPaths(item: GitReviewChangeDescriptor): readonly string[] {
  return item.previousPath === undefined ? [item.path] : [item.previousPath, item.path];
}
