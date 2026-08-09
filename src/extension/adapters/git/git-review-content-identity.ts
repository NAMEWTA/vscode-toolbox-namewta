import { createHash } from 'node:crypto';
import type { GitReviewStatusEntry } from './git-review-status-parser';

export function createGitReviewContentIdentity(
  entry: GitReviewStatusEntry,
  workingContent: Buffer | undefined,
): string {
  const hash = createHash('sha256');
  hash.update(entry.identityMaterial, 'utf8');
  hash.update('\0', 'utf8');
  if (workingContent === undefined) {
    hash.update('missing', 'utf8');
  } else {
    hash.update(workingContent);
  }
  return hash.digest('hex');
}
