import { useEffect, useState } from 'react';
import { isExtensionToWebviewMessage } from '../../core/contracts';
import type { GitReviewSessionSnapshot } from '../../core/domains/git-review/public-api';

export function useGitReviewSnapshot(initialSnapshot: GitReviewSessionSnapshot): {
  readonly snapshot: GitReviewSessionSnapshot;
  readonly setSnapshot: (snapshot: GitReviewSessionSnapshot) => void;
  readonly focusItemId: string | undefined;
} {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [focusItemId, setFocusItemId] = useState<string>();

  useEffect(() => {
    const listener = (event: MessageEvent): void => {
      if (!isExtensionToWebviewMessage(event.data)) {
        return;
      }
      if (event.data.type === 'gitReview.snapshot') {
        setSnapshot(event.data.snapshot);
      }
      if (event.data.type === 'gitReview.focus') {
        setFocusItemId(event.data.itemId);
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  return { snapshot, setSnapshot, focusItemId };
}
