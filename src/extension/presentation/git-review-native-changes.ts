import type {
  GitReviewItem,
  GitReviewSession,
} from '../../core/domains/git-review/public-api';

export type GitReviewNativeDocument = {
  readonly item: GitReviewItem;
  readonly side: 'before' | 'after';
};

export type GitReviewNativeChange = {
  readonly labelPath: string;
  readonly original?: GitReviewNativeDocument;
  readonly modified?: GitReviewNativeDocument;
};

export function createGitReviewNativeChanges(
  session: GitReviewSession,
): readonly GitReviewNativeChange[] {
  return session.items.map((item) => ({
    labelPath: `${item.layer}/${item.path}`,
    ...(item.change === 'added' ||
    item.change === 'untracked' ||
    item.change === 'conflicted'
      ? {}
      : { original: { item, side: 'before' as const } }),
    ...(item.change === 'deleted'
      ? {}
      : { modified: { item, side: 'after' as const } }),
  }));
}

export function gitReviewInventoryIdentity(session: GitReviewSession): string {
  return session.items
    .map(
      (item) =>
        `${item.itemId}\0${item.contentIdentity}\0${item.layer}\0${item.path}\0${item.change}`,
    )
    .join('\n');
}
