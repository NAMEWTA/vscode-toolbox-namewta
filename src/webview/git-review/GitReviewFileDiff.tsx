import { RefreshCw, RotateCcw } from 'lucide-react';
import { useCallback, type JSX } from 'react';
import type {
  GitReviewWebviewAction,
  GitReviewWebviewStrings,
} from '../../core/contracts';
import type { GitReviewItem } from '../../core/domains/git-review/public-api';
import { GitReviewFileHeader } from './GitReviewFileHeader';
import { GitReviewPatchBody, type GitReviewItemAction } from './GitReviewPatchBody';
import type { GitReviewPatchLoader } from './git-review-patch-loader';
import type { GitReviewMutationRunner } from './git-review-view-model';
import { useGitReviewPatch } from './use-git-review-patch';

export function GitReviewFileDiff({
  patchLoader,
  item,
  strings,
  isFocused,
  postAction,
  runMutation,
}: {
  readonly patchLoader: GitReviewPatchLoader;
  readonly item: GitReviewItem;
  readonly strings: GitReviewWebviewStrings;
  readonly isFocused: boolean;
  readonly postAction: (message: GitReviewWebviewAction) => void;
  readonly runMutation: GitReviewMutationRunner;
}): JSX.Element {
  const { patch, error, loading, reload } = useGitReviewPatch(patchLoader, item);
  const action = useCallback<GitReviewItemAction>(
    (name, line) =>
      postAction({
        type: 'gitReview.action',
        action: name,
        itemId: item.itemId,
        contentIdentity: item.contentIdentity,
        ...(line === undefined ? {} : { line }),
      }),
    [item.contentIdentity, item.itemId, postAction],
  );

  return (
    <article
      className={`file-diff file-diff--${item.layer}${isFocused ? ' is-focused' : ''}`}
      data-item-id={item.itemId}
    >
      <GitReviewFileHeader
        item={item}
        patch={patch}
        strings={strings}
        action={action}
        runMutation={runMutation}
      />
      <GitReviewPatchState
        loading={loading}
        error={error}
        patchBody={
          <GitReviewPatchBody
            patch={patch}
            item={item}
            strings={strings}
            action={action}
          />
        }
        strings={strings}
        reload={reload}
      />
    </article>
  );
}

function GitReviewPatchState({
  loading,
  error,
  patchBody,
  strings,
  reload,
}: {
  readonly loading: boolean;
  readonly error: string | undefined;
  readonly patchBody: JSX.Element;
  readonly strings: GitReviewWebviewStrings;
  readonly reload: () => void;
}): JSX.Element {
  if (loading) {
    return (
      <div className="diff-state" role="status">
        <RefreshCw className="is-spinning" /> {strings.loading}
      </div>
    );
  }
  if (error === undefined) {
    return patchBody;
  }
  return (
    <div className="diff-state diff-state--error" role="alert">
      <span>{error}</span>
      <button onClick={reload} title={strings.retry} aria-label={strings.retry}>
        <RotateCcw />
      </button>
    </div>
  );
}
