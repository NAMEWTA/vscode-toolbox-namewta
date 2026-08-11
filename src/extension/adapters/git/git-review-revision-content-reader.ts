import type {
  GitReviewCancellationSignal,
  GitReviewChangeDescriptor,
} from '../../../core/domains/git-review/public-api';
import type { GitCommandResult } from '../../../core/domains/git-blame/public-api';
import {
  decodeGitReviewText,
  readGitReviewWorkingContent,
} from './git-review-content-reader';
import { assertGitReviewRequestActive } from './git-review-git-boundary';

const GIT_OPTIONAL_LOCKS = '--no-optional-locks';

export type GitReviewRevisionInventory = {
  readonly repositoryRoot: string;
  readonly hasHead: boolean;
};

export type GitReviewRevisionRun = (
  operation: string,
  args: readonly string[],
  signal: GitReviewCancellationSignal,
) => Promise<GitCommandResult>;

export async function readGitReviewBeforeContent(
  inventory: GitReviewRevisionInventory,
  item: GitReviewChangeDescriptor,
  signal: GitReviewCancellationSignal,
  run: GitReviewRevisionRun,
): Promise<string | undefined> {
  if (item.layer === 'unstaged') {
    return item.change === 'untracked'
      ? ''
      : readGitReviewIndexContent(item, signal, run);
  }
  if (!inventory.hasHead || item.change === 'added') {
    return '';
  }
  const result = await run(
    'git-review-before-content',
    [
      GIT_OPTIONAL_LOCKS,
      'show',
      '--no-ext-diff',
      '--no-textconv',
      `HEAD:${item.previousPath ?? item.path}`,
    ],
    signal,
  );
  return decodeGitReviewText(Buffer.from(result.stdout, 'utf8'));
}

export async function readGitReviewAfterContent(
  repositoryRoot: string,
  item: GitReviewChangeDescriptor,
  signal: GitReviewCancellationSignal,
  run: GitReviewRevisionRun,
): Promise<string | undefined> {
  if (item.change === 'deleted') {
    return '';
  }
  if (item.layer === 'staged') {
    return readGitReviewIndexContent(item, signal, run);
  }
  assertGitReviewRequestActive(signal);
  const content = await readGitReviewWorkingContent(repositoryRoot, item.path);
  assertGitReviewRequestActive(signal);
  return decodeGitReviewText(content);
}

async function readGitReviewIndexContent(
  item: GitReviewChangeDescriptor,
  signal: GitReviewCancellationSignal,
  run: GitReviewRevisionRun,
): Promise<string | undefined> {
  const result = await run(
    'git-review-index-content',
    [GIT_OPTIONAL_LOCKS, 'show', '--no-ext-diff', '--no-textconv', `:${item.path}`],
    signal,
  );
  return decodeGitReviewText(Buffer.from(result.stdout, 'utf8'));
}
