import { useCallback, useEffect, useState } from 'react';
import type {
  GitReviewItem,
  GitReviewItemPatch,
} from '../../core/domains/git-review/public-api';
import type { GitReviewPatchLoader } from './git-review-patch-loader';

export function useGitReviewPatch(
  patchLoader: GitReviewPatchLoader,
  item: GitReviewItem,
): {
  readonly patch: GitReviewItemPatch | undefined;
  readonly error: string | undefined;
  readonly loading: boolean;
  readonly reload: () => void;
} {
  const [patch, setPatch] = useState<GitReviewItemPatch>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setLoading(true);
      setError(undefined);
      try {
        const result = await patchLoader.load(
          { itemId: item.itemId, contentIdentity: item.contentIdentity },
          signal,
        );
        if (result.ok) {
          setPatch(result.data);
        } else {
          setError(result.error.message);
        }
        setLoading(false);
      } catch (caught: unknown) {
        if (!(caught instanceof Error) || caught.name !== 'AbortError') {
          setError(caught instanceof Error ? caught.message : String(caught));
          setLoading(false);
        }
      }
    },
    [item.contentIdentity, item.itemId, patchLoader],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { patch, error, loading, reload: () => void load() };
}
