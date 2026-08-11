import { useCallback, useEffect, useMemo, type JSX } from 'react';
import type {
  GitReviewWebviewAction,
  GitReviewWebviewStrings,
} from '../../core/contracts';
import type {
  GitReviewItem,
  GitReviewSessionSnapshot,
} from '../../core/domains/git-review/public-api';
import type { ToolMessageClient } from '../platform/webview-message-client';
import { GitReviewPatchLoader } from './git-review-patch-loader';
import {
  createGitReviewEntries,
  gitReviewProgressText,
  type GitReviewMutationCommand,
} from './git-review-view-model';
import { GitReviewVirtualList } from './GitReviewVirtualList';
import { useGitReviewSnapshot } from './use-git-review-snapshot';

export function GitReviewApp({
  client,
  initialSnapshot,
  strings,
  postAction,
}: {
  readonly client: ToolMessageClient;
  readonly initialSnapshot: GitReviewSessionSnapshot;
  readonly strings: GitReviewWebviewStrings;
  readonly postAction: (message: GitReviewWebviewAction) => void;
}): JSX.Element {
  const { snapshot, setSnapshot, focusItemId } = useGitReviewSnapshot(initialSnapshot);
  const patchLoader = useMemo(() => new GitReviewPatchLoader(client), [client]);
  const entries = useMemo(() => createGitReviewEntries(snapshot), [snapshot]);
  const runMutation = useCallback(
    async (item: GitReviewItem, command: GitReviewMutationCommand): Promise<void> => {
      const result = await client.execute(command, {
        itemId: item.itemId,
        contentIdentity: item.contentIdentity,
      });
      if (result.ok) {
        setSnapshot(result.data);
      }
    },
    [client, setSnapshot],
  );

  useEffect(() => () => patchLoader.dispose(), [patchLoader]);

  if (entries.length === 0) {
    return <div className="review-empty">{strings.noChanges}</div>;
  }
  return (
    <main className="review-shell">
      <GitReviewToolbar snapshot={snapshot} strings={strings} />
      <GitReviewVirtualList
        entries={entries}
        focusItemId={focusItemId}
        patchLoader={patchLoader}
        strings={strings}
        postAction={postAction}
        runMutation={runMutation}
      />
    </main>
  );
}

function GitReviewToolbar({
  snapshot,
  strings,
}: {
  readonly snapshot: GitReviewSessionSnapshot;
  readonly strings: GitReviewWebviewStrings;
}): JSX.Element {
  return (
    <header className="review-toolbar">
      <div>
        <h1>{strings.title}</h1>
        {snapshot.state === 'stale' ? (
          <span className="review-stale">{strings.refreshRequired}</span>
        ) : null}
      </div>
      <span className="review-progress">{gitReviewProgressText(snapshot)}</span>
    </header>
  );
}
