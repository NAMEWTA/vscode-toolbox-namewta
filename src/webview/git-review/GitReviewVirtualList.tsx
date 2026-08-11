import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, type JSX } from 'react';
import type {
  GitReviewWebviewAction,
  GitReviewWebviewStrings,
} from '../../core/contracts';
import { GitReviewFileDiff } from './GitReviewFileDiff';
import type { GitReviewPatchLoader } from './git-review-patch-loader';
import type { GitReviewEntry, GitReviewMutationRunner } from './git-review-view-model';

export function GitReviewVirtualList({
  entries,
  focusItemId,
  patchLoader,
  strings,
  postAction,
  runMutation,
}: {
  readonly entries: readonly GitReviewEntry[];
  readonly focusItemId: string | undefined;
  readonly patchLoader: GitReviewPatchLoader;
  readonly strings: GitReviewWebviewStrings;
  readonly postAction: (message: GitReviewWebviewAction) => void;
  readonly runMutation: GitReviewMutationRunner;
}): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (entries[index]?.kind === 'heading' ? 40 : 320),
    overscan: 3,
  });

  useEffect(() => {
    const index = entries.findIndex(
      (entry) => entry.kind === 'item' && entry.item.itemId === focusItemId,
    );
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: 'start' });
    }
  }, [entries, focusItemId, virtualizer]);

  return (
    <div ref={scrollRef} className="review-scroll">
      <div
        className="review-virtual"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((row) => (
          <GitReviewVirtualRow
            key={row.key}
            entry={entries[row.index]}
            index={row.index}
            start={row.start}
            measure={virtualizer.measureElement}
            focusItemId={focusItemId}
            patchLoader={patchLoader}
            strings={strings}
            postAction={postAction}
            runMutation={runMutation}
          />
        ))}
      </div>
    </div>
  );
}

function GitReviewVirtualRow({
  entry,
  index,
  start,
  measure,
  focusItemId,
  patchLoader,
  strings,
  postAction,
  runMutation,
}: {
  readonly entry: GitReviewEntry | undefined;
  readonly index: number;
  readonly start: number;
  readonly measure: (element: Element | null) => void;
  readonly focusItemId: string | undefined;
  readonly patchLoader: GitReviewPatchLoader;
  readonly strings: GitReviewWebviewStrings;
  readonly postAction: (message: GitReviewWebviewAction) => void;
  readonly runMutation: GitReviewMutationRunner;
}): JSX.Element | null {
  if (entry === undefined) {
    return null;
  }
  return (
    <div
      ref={measure}
      data-index={index}
      className="review-row"
      style={{ transform: `translateY(${start}px)` }}
    >
      {entry.kind === 'heading' ? (
        <GitReviewLayerHeading entry={entry} strings={strings} />
      ) : (
        <GitReviewFileDiff
          patchLoader={patchLoader}
          item={entry.item}
          strings={strings}
          isFocused={entry.item.itemId === focusItemId}
          postAction={postAction}
          runMutation={runMutation}
        />
      )}
    </div>
  );
}

function GitReviewLayerHeading({
  entry,
  strings,
}: {
  readonly entry: Extract<GitReviewEntry, { readonly kind: 'heading' }>;
  readonly strings: GitReviewWebviewStrings;
}): JSX.Element {
  const labels = {
    conflict: strings.conflict,
    staged: strings.staged,
    unstaged: strings.unstaged,
  } as const;
  return (
    <h2 className={`layer-heading layer-heading--${entry.layer}`}>
      {labels[entry.layer]} <span>{entry.count}</span>
    </h2>
  );
}
