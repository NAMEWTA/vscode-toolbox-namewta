import {
  isGitReviewChangeDescriptor,
  type GitReviewItem,
  type GitReviewProgress,
  type GitReviewSession,
  type GitReviewSessionSnapshot,
  type GitReviewSummary,
} from './git-review-model';

export function isGitReviewSessionSnapshot(
  value: unknown,
): value is GitReviewSessionSnapshot {
  if (!isRecord(value) || typeof value.state !== 'string') {
    return false;
  }
  if (value.state === 'inactive' || value.state === 'loading') {
    return Object.keys(value).length === 1;
  }
  if (value.state === 'completed') {
    return isGitReviewSummary(value.summary);
  }
  return ACTIVE_STATES.has(value.state) && isGitReviewSession(value.session);
}

const ACTIVE_STATES = new Set(['active', 'stale', 'refreshing']);

function isGitReviewSession(value: unknown): value is GitReviewSession {
  if (
    !isRecordWithKeys(value, [
      'repositoryRoot',
      'currentItemId',
      'currentItemPath',
      'items',
      'progress',
    ]) ||
    !isAbsolutePath(value.repositoryRoot) ||
    !isBoundedText(value.currentItemId, 4_128) ||
    !isGitReviewPath(value.currentItemPath) ||
    !Array.isArray(value.items) ||
    value.items.length === 0 ||
    !value.items.every(isGitReviewItem) ||
    !isGitReviewProgress(value.progress)
  ) {
    return false;
  }
  return value.items.some(
    (item) =>
      item.itemId === value.currentItemId && item.path === value.currentItemPath,
  );
}

function isGitReviewItem(value: unknown): value is GitReviewItem {
  if (!isRecord(value)) {
    return false;
  }
  const { reviewState, ...descriptor } = value;
  return (
    isGitReviewChangeDescriptor(descriptor) &&
    typeof value.itemId === 'string' &&
    ['conflict', 'staged', 'unstaged'].includes(String(value.layer)) &&
    ['unreviewed', 'reviewed', 'skipped'].includes(String(reviewState))
  );
}

function isGitReviewProgress(value: unknown): value is GitReviewProgress {
  return (
    isRecordWithKeys(value, ['total', 'reviewed', 'skipped', 'remaining']) &&
    isNonNegativeInteger(value.total) &&
    isNonNegativeInteger(value.reviewed) &&
    isNonNegativeInteger(value.skipped) &&
    isNonNegativeInteger(value.remaining) &&
    value.reviewed + value.skipped + value.remaining === value.total
  );
}

function isGitReviewSummary(value: unknown): value is GitReviewSummary {
  return (
    isRecordWithKeys(value, ['total', 'reviewed', 'skipped']) &&
    isNonNegativeInteger(value.total) &&
    isNonNegativeInteger(value.reviewed) &&
    isNonNegativeInteger(value.skipped) &&
    value.reviewed + value.skipped <= value.total
  );
}

function isAbsolutePath(value: unknown): value is string {
  return (
    isBoundedText(value, 4_096) &&
    (value.startsWith('/') ||
      /^[A-Za-z]:[\\/]/u.test(value) ||
      /^\\\\[^\\]+\\[^\\]+/u.test(value))
  );
}

function isGitReviewPath(value: unknown): value is string {
  return (
    isBoundedText(value, 4_096) &&
    !value.startsWith('/') &&
    value
      .split('/')
      .every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  );
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    !value.includes('\0')
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isRecordWithKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => key in value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
