import type {
  GitReviewSession,
  GitReviewSessionSnapshot,
} from '../../core/domains/git-review/public-api';

export type GitReviewNavigation = {
  readonly command: 'gitReview.next' | 'gitReview.previous';
  readonly count: number;
};

export function hasLiveGitReviewSession(snapshot: GitReviewSessionSnapshot): boolean {
  return snapshot.state === 'loading' || getGitReviewSession(snapshot) !== undefined;
}

export function getGitReviewSession(
  snapshot: GitReviewSessionSnapshot,
): GitReviewSession | undefined {
  switch (snapshot.state) {
    case 'active':
    case 'stale':
    case 'refreshing':
      return snapshot.session;
    case 'inactive':
    case 'loading':
    case 'completed':
      return undefined;
  }
}

export function getActiveGitReviewSession(
  snapshot: GitReviewSessionSnapshot,
): GitReviewSession | undefined {
  switch (snapshot.state) {
    case 'active':
    case 'stale':
      return snapshot.session;
    case 'inactive':
    case 'loading':
    case 'refreshing':
    case 'completed':
      return undefined;
  }
}

export function calculateGitReviewNavigation(
  targetIndex: number,
  currentIndex: number,
): GitReviewNavigation {
  const moveForward = targetIndex >= currentIndex;
  return {
    command: moveForward ? 'gitReview.next' : 'gitReview.previous',
    count: Math.abs(targetIndex - currentIndex),
  };
}
