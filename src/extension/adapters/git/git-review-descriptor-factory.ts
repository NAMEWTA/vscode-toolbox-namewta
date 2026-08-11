import type {
  GitReviewCancellationSignal,
  GitReviewChangeDescriptor,
} from '../../../core/domains/git-review/public-api';
import { createGitReviewContentIdentity } from './git-review-content-identity';
import {
  decodeGitReviewText,
  tryReadGitReviewWorkingContent,
} from './git-review-content-reader';
import { assertGitReviewRequestActive } from './git-review-git-boundary';
import type { GitReviewStatusEntry } from './git-review-status-parser';

export async function createGitReviewDescriptors(
  repositoryRoot: string,
  entries: readonly GitReviewStatusEntry[],
  binaryPaths: ReadonlySet<string>,
  signal: GitReviewCancellationSignal,
): Promise<readonly GitReviewChangeDescriptor[]> {
  const descriptors: GitReviewChangeDescriptor[] = [];
  for (const entry of entries) {
    assertGitReviewRequestActive(signal);
    const workingContent = shouldReadWorkingContent(entry)
      ? await tryReadGitReviewWorkingContent(repositoryRoot, entry.path)
      : undefined;
    assertGitReviewRequestActive(signal);
    descriptors.push({
      itemId: entry.itemId,
      layer: entry.layer,
      path: entry.path,
      ...(entry.previousPath === undefined ? {} : { previousPath: entry.previousPath }),
      contentIdentity: createGitReviewContentIdentity(entry, workingContent),
      change: entry.change,
      presentation: presentationFor(entry, binaryPaths, workingContent),
    });
  }
  return descriptors;
}

function shouldReadWorkingContent(entry: GitReviewStatusEntry): boolean {
  return (
    entry.layer !== 'staged' &&
    entry.change !== 'deleted' &&
    entry.presentation !== 'submodule'
  );
}

function presentationFor(
  entry: GitReviewStatusEntry,
  binaryPaths: ReadonlySet<string>,
  workingContent: Buffer | undefined,
): GitReviewChangeDescriptor['presentation'] {
  if (entry.presentation === 'submodule') {
    return 'submodule';
  }
  return binaryPaths.has(entry.path) || isBinaryContent(workingContent)
    ? 'binary'
    : 'text';
}

function isBinaryContent(content: Buffer | undefined): boolean {
  return content !== undefined && decodeGitReviewText(content) === undefined;
}
