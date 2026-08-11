import type {
  GitReviewItem,
  GitReviewLayer,
  GitReviewSessionSnapshot,
} from '../../core/domains/git-review/public-api';

export type GitReviewEntry =
  | { readonly kind: 'heading'; readonly layer: GitReviewLayer; readonly count: number }
  | { readonly kind: 'item'; readonly item: GitReviewItem };

export type GitReviewMutationCommand =
  | 'gitReview.stageItem'
  | 'gitReview.unstageItem'
  | 'gitReview.discardItem';

export type GitReviewMutationRunner = (
  item: GitReviewItem,
  command: GitReviewMutationCommand,
) => Promise<void>;

const LAYERS: readonly GitReviewLayer[] = ['conflict', 'staged', 'unstaged'];

export function createGitReviewEntries(
  snapshot: GitReviewSessionSnapshot,
): GitReviewEntry[] {
  if (!hasGitReviewSession(snapshot)) {
    return [];
  }
  const entries: GitReviewEntry[] = [];
  for (const layer of LAYERS) {
    const items = snapshot.session.items.filter((item) => item.layer === layer);
    if (items.length > 0) {
      entries.push({ kind: 'heading', layer, count: items.length });
      entries.push(...items.map((item) => ({ kind: 'item' as const, item })));
    }
  }
  return entries;
}

export function gitReviewProgressText(snapshot: GitReviewSessionSnapshot): string {
  if (!hasGitReviewSession(snapshot)) {
    return '';
  }
  const progress = snapshot.session.progress;
  return `${progress.reviewed + progress.skipped}/${progress.total}`;
}

export function gitReviewChangeCode(item: GitReviewItem): string {
  switch (item.change) {
    case 'added':
    case 'untracked':
      return 'A';
    case 'modified':
      return 'M';
    case 'deleted':
      return 'D';
    case 'renamed':
      return 'R';
    case 'conflicted':
      return '!';
  }
}

function hasGitReviewSession(
  snapshot: GitReviewSessionSnapshot,
): snapshot is Extract<
  GitReviewSessionSnapshot,
  { readonly state: 'active' | 'stale' | 'refreshing' }
> {
  return (
    snapshot.state === 'active' ||
    snapshot.state === 'stale' ||
    snapshot.state === 'refreshing'
  );
}
