import { ApplicationError } from '../../kernel/application-error';
import {
  isGitReviewChangeDescriptor,
  type GitReviewChangeDescriptor,
  type GitReviewItem,
  type GitReviewItemState,
  type GitReviewProgress,
  type GitReviewSession,
  type GitReviewSummary,
} from './git-review-model';

export type ActiveGitReviewSession = {
  readonly repositoryRoot: string;
  readonly items: GitReviewItem[];
  currentIndex: number;
};

export function createActiveGitReviewSession(
  repositoryRoot: string,
  changes: readonly GitReviewChangeDescriptor[],
): ActiveGitReviewSession {
  if (!changes.every(isGitReviewChangeDescriptor)) {
    throw new ApplicationError('Git Review changes are invalid.', {
      code: 'internal-error',
    });
  }
  const items = [...changes]
    .map(normalizeGitReviewDescriptor)
    .sort(compareGitReviewItems)
    .map((change) => ({ ...change, reviewState: 'unreviewed' as const }));
  const itemIds = new Set(items.map((item) => item.itemId));
  if (itemIds.size !== items.length) {
    throw new ApplicationError('Git Review changes contain duplicate items.', {
      code: 'internal-error',
    });
  }
  return { repositoryRoot, items, currentIndex: 0 };
}

export function createGitReviewSessionSnapshot(
  session: ActiveGitReviewSession,
): GitReviewSession {
  return {
    repositoryRoot: session.repositoryRoot,
    currentItemId: session.items[session.currentIndex]?.itemId ?? '',
    currentItemPath: session.items[session.currentIndex]?.path ?? '',
    items: session.items.map((item) => ({ ...item })),
    progress: createGitReviewProgress(session.items),
  };
}

function createGitReviewProgress(items: readonly GitReviewItem[]): GitReviewProgress {
  const reviewed = items.filter((item) => item.reviewState === 'reviewed').length;
  const skipped = items.filter((item) => item.reviewState === 'skipped').length;
  return {
    total: items.length,
    reviewed,
    skipped,
    remaining: items.length - reviewed - skipped,
  };
}

export function createGitReviewSummary(
  items: readonly GitReviewItem[],
): GitReviewSummary {
  const progress = createGitReviewProgress(items);
  return {
    total: progress.total,
    reviewed: progress.reviewed,
    skipped: progress.skipped,
  };
}

export function preserveGitReviewStates(
  previousSession: ActiveGitReviewSession,
  refreshedSession: ActiveGitReviewSession,
): void {
  const previousStates = new Map(
    previousSession.items.map((item) => [item.contentIdentity, item.reviewState]),
  );
  for (const [index, item] of refreshedSession.items.entries()) {
    const reviewState = previousStates.get(item.contentIdentity);
    if (reviewState !== undefined) {
      refreshedSession.items[index] = { ...item, reviewState };
    }
  }
}

export function preserveGitReviewCurrentItem(
  previousSession: ActiveGitReviewSession,
  refreshedSession: ActiveGitReviewSession,
): void {
  const previousItemId = previousSession.items[previousSession.currentIndex]?.itemId;
  const currentIndex = refreshedSession.items.findIndex(
    (item) => item.itemId === previousItemId,
  );
  refreshedSession.currentIndex =
    currentIndex >= 0
      ? currentIndex
      : (findNextUnreviewedGitReviewItem(refreshedSession.items, -1) ?? 0);
}

export function findNextUnreviewedGitReviewItem(
  items: readonly GitReviewItem[],
  currentIndex: number,
): number | undefined {
  for (let offset = 1; offset <= items.length; offset += 1) {
    const index = (currentIndex + offset) % items.length;
    if (items[index]?.reviewState === 'unreviewed') {
      return index;
    }
  }
  return undefined;
}

export function toGitReviewChangeDescriptor(
  item: GitReviewItem,
): GitReviewChangeDescriptor {
  return {
    itemId: item.itemId,
    layer: item.layer,
    path: item.path,
    ...(item.previousPath === undefined ? {} : { previousPath: item.previousPath }),
    contentIdentity: item.contentIdentity,
    change: item.change,
    presentation: item.presentation,
  };
}

function normalizeGitReviewDescriptor(
  change: GitReviewChangeDescriptor,
): GitReviewItem {
  const layer = change.layer ?? 'unstaged';
  return {
    ...change,
    itemId: change.itemId ?? `${layer}:${change.path}`,
    layer,
    reviewState: 'unreviewed',
  };
}

function compareGitReviewItems(
  left: GitReviewChangeDescriptor & { readonly layer: string },
  right: GitReviewChangeDescriptor & { readonly layer: string },
): number {
  const layerDifference = layerOrder(left.layer) - layerOrder(right.layer);
  return layerDifference === 0
    ? compareGitReviewPaths(left.path, right.path)
    : layerDifference;
}

function layerOrder(layer: string): number {
  switch (layer) {
    case 'conflict':
      return 0;
    case 'staged':
      return 1;
    default:
      return 2;
  }
}

export function updateGitReviewItemState(
  session: ActiveGitReviewSession,
  reviewState: GitReviewItemState,
): void {
  const currentItem = session.items[session.currentIndex];
  if (currentItem === undefined) {
    throw new ApplicationError('The active Git Review item is unavailable.', {
      code: 'internal-error',
    });
  }
  session.items[session.currentIndex] = { ...currentItem, reviewState };
}

function compareGitReviewPaths(left: string, right: string): number {
  const normalizedLeft = left.normalize('NFC');
  const normalizedRight = right.normalize('NFC');
  if (normalizedLeft < normalizedRight) {
    return -1;
  }
  if (normalizedLeft > normalizedRight) {
    return 1;
  }
  return left < right ? -1 : Number(left > right);
}
