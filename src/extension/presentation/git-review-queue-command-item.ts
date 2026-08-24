import type {
  GitReviewItem,
  GitReviewSessionSnapshot,
} from '../../core/domains/git-review/public-api';
import { ApplicationError } from '../../core/kernel/application-error';
import { getGitReviewSession } from './git-review-session-snapshot';

export function resolveGitReviewQueueCommandItem(
  args: readonly unknown[],
  snapshot: GitReviewSessionSnapshot,
): GitReviewItem {
  const value = args.length === 1 ? args[0] : undefined;
  const candidate = readQueueEntryItem(value);
  const item = getGitReviewSession(snapshot)?.items.find(
    (current) =>
      candidate !== undefined &&
      current.itemId === candidate.itemId &&
      current.contentIdentity === candidate.contentIdentity,
  );
  if (item === undefined) {
    throw new ApplicationError('Git Review queue item is invalid or stale.', {
      code: 'invalid-input',
    });
  }
  return item;
}

function readQueueEntryItem(
  value: unknown,
): { readonly itemId: string; readonly contentIdentity: string } | undefined {
  if (!isRecord(value) || !isRecord(value.item)) return undefined;
  const { contentIdentity, itemId } = value.item;
  return typeof itemId === 'string' && typeof contentIdentity === 'string'
    ? { itemId, contentIdentity }
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
