import type { JSX } from 'react';
import {
  Check,
  ExternalLink,
  FileDiff,
  GitMerge,
  Link,
  Minus,
  Plus,
  SkipForward,
  Trash2,
} from 'lucide-react';
import type { GitReviewWebviewStrings } from '../../core/contracts';
import type {
  GitReviewItem,
  GitReviewItemPatch,
} from '../../core/domains/git-review/public-api';
import { GitReviewIconButton } from './GitReviewIconButton';
import type { GitReviewItemAction } from './GitReviewPatchBody';
import {
  gitReviewChangeCode,
  type GitReviewMutationRunner,
} from './git-review-view-model';

export function GitReviewFileHeader({
  item,
  patch,
  strings,
  action,
  runMutation,
}: {
  readonly item: GitReviewItem;
  readonly patch: GitReviewItemPatch | undefined;
  readonly strings: GitReviewWebviewStrings;
  readonly action: GitReviewItemAction;
  readonly runMutation: GitReviewMutationRunner;
}): JSX.Element {
  return (
    <header className="file-header">
      <div className="file-identity">
        <span className="file-change">{gitReviewChangeCode(item)}</span>
        <button className="file-path" onClick={() => action('open-file')}>
          {item.path}
        </button>
        {item.previousPath === undefined ? null : (
          <span className="file-previous">
            {'<- '}
            {item.previousPath}
          </span>
        )}
        {patch?.kind === 'patch' ? (
          <span className="file-stats">
            <b>+{patch.additions}</b> {strings.additions} <i>-{patch.deletions}</i>{' '}
            {strings.deletions}
          </span>
        ) : null}
      </div>
      <GitReviewFileActions
        item={item}
        strings={strings}
        action={action}
        runMutation={runMutation}
      />
    </header>
  );
}

function GitReviewFileActions({
  item,
  strings,
  action,
  runMutation,
}: {
  readonly item: GitReviewItem;
  readonly strings: GitReviewWebviewStrings;
  readonly action: GitReviewItemAction;
  readonly runMutation: GitReviewMutationRunner;
}): JSX.Element {
  return (
    <div className="file-actions">
      {item.layer === 'conflict' ? (
        <GitReviewIconButton
          label={strings.mergeChanges}
          icon={<GitMerge />}
          onClick={() => action('merge-changes')}
        />
      ) : null}
      {item.layer === 'unstaged' || item.layer === 'conflict' ? (
        <GitReviewIconButton
          label={strings.stage}
          icon={<Plus />}
          onClick={() => void runMutation(item, 'gitReview.stageItem')}
        />
      ) : null}
      {item.layer === 'staged' ? (
        <GitReviewIconButton
          label={strings.unstage}
          icon={<Minus />}
          onClick={() => void runMutation(item, 'gitReview.unstageItem')}
        />
      ) : null}
      {item.layer === 'unstaged' ? (
        <GitReviewIconButton
          label={strings.discard}
          icon={<Trash2 />}
          onClick={() => void runMutation(item, 'gitReview.discardItem')}
          danger
        />
      ) : null}
      <GitReviewNavigationActions strings={strings} action={action} />
    </div>
  );
}

function GitReviewNavigationActions({
  strings,
  action,
}: {
  readonly strings: GitReviewWebviewStrings;
  readonly action: GitReviewItemAction;
}): JSX.Element {
  return (
    <>
      <GitReviewIconButton
        label={strings.openFile}
        icon={<ExternalLink />}
        onClick={() => action('open-file')}
      />
      <GitReviewIconButton
        label={strings.openDiff}
        icon={<FileDiff />}
        onClick={() => action('open-diff')}
      />
      <GitReviewIconButton
        label={strings.copyReference}
        icon={<Link />}
        onClick={() => action('copy-reference')}
      />
      <GitReviewIconButton
        label={strings.markReviewed}
        icon={<Check />}
        onClick={() => action('mark-reviewed')}
      />
      <GitReviewIconButton
        label={strings.skip}
        icon={<SkipForward />}
        onClick={() => action('skip')}
      />
    </>
  );
}
