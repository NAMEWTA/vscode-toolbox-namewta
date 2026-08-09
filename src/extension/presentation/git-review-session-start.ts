import type { GitReviewSessionSnapshot } from '../../core/domains/git-review/public-api';
import { hasLiveGitReviewSession } from './git-review-session-snapshot';

export type GitReviewSessionStartDependencies = {
  readonly resolveRepository: (
    args: readonly unknown[],
    signal: AbortSignal,
  ) => Promise<string | undefined>;
  readonly confirmReplace: () => Promise<boolean>;
  readonly getSnapshot: () => GitReviewSessionSnapshot;
  readonly isCurrent: () => boolean;
  readonly clearReplacedSession: () => void;
  readonly executeStart: (
    repositoryRoot: string,
    replace: boolean,
  ) => Promise<GitReviewSessionSnapshot | undefined>;
  readonly applySnapshot: (
    snapshot: GitReviewSessionSnapshot,
    openCurrentItem: boolean,
  ) => Promise<void>;
};

export async function startGitReviewSession(
  dependencies: GitReviewSessionStartDependencies,
  args: readonly unknown[],
  signal: AbortSignal,
): Promise<void> {
  const repositoryRoot = await dependencies.resolveRepository(args, signal);
  if (repositoryRoot === undefined) {
    return;
  }
  if (!dependencies.isCurrent()) {
    return;
  }
  const replace = hasLiveGitReviewSession(dependencies.getSnapshot());
  if (replace) {
    const confirmed = await dependencies.confirmReplace();
    if (!confirmed) {
      return;
    }
  }
  if (!dependencies.isCurrent()) {
    return;
  }
  if (replace) {
    dependencies.clearReplacedSession();
  }
  const snapshot = await dependencies.executeStart(repositoryRoot, replace);
  if (snapshot === undefined) {
    await resetFailedReplacement(dependencies, replace);
    return;
  }
  if (dependencies.isCurrent()) {
    await dependencies.applySnapshot(snapshot, true);
  }
}

async function resetFailedReplacement(
  dependencies: GitReviewSessionStartDependencies,
  replace: boolean,
): Promise<void> {
  if (!replace || !dependencies.isCurrent()) {
    return;
  }
  await dependencies.applySnapshot({ state: 'inactive' }, false);
}
