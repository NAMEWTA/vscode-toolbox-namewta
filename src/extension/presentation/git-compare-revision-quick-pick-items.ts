import {
  isGitCommitObjectIdPrefix,
  type GitCompareCommit,
  type GitCompareSearchMatch,
} from '../../core/domains/git-compare/public-api';
import type {
  GitCompareRevisionQuickPickItem,
  GitCompareRevisionQuickPickLabels,
  GitCompareRevisionQuickPickView,
} from './git-compare-revision-quick-pick-contract';

export function createGitCompareRevisionItems(input: {
  readonly step: 'base' | 'target';
  readonly revision: string;
  readonly commits: readonly GitCompareCommit[];
  readonly searchMatches: readonly GitCompareSearchMatch[];
  readonly complete: boolean;
  readonly labels: GitCompareRevisionQuickPickLabels;
}): readonly GitCompareRevisionQuickPickItem[] {
  const items: GitCompareRevisionQuickPickItem[] = [];
  if (input.step === 'target') {
    items.push({
      itemType: 'back',
      label: `$(arrow-left) ${input.labels.back}`,
      alwaysShow: true,
    });
  }
  if (isGitCommitObjectIdPrefix(input.revision)) {
    items.push({
      itemType: 'resolve',
      label: `$(search) ${input.labels.useRevision(input.revision)}`,
      alwaysShow: true,
      revision: input.revision,
    });
  }
  items.push(...createCommitItems(input));
  if (input.revision.length < 2 && !input.complete) {
    items.push({
      itemType: 'load-more',
      label: `$(sync) ${input.labels.loadMore}`,
      alwaysShow: true,
    });
  }
  return items;
}

export function activateGitCompareTypedRevision(
  view: GitCompareRevisionQuickPickView,
  items: readonly GitCompareRevisionQuickPickItem[],
): void {
  const resolveItem = items.find((item) => item.itemType === 'resolve');
  view.selectedItems = [];
  view.activeItems = resolveItem === undefined ? [] : [resolveItem];
}

function createCommitItems(input: {
  readonly revision: string;
  readonly commits: readonly GitCompareCommit[];
  readonly searchMatches: readonly GitCompareSearchMatch[];
}): readonly GitCompareRevisionQuickPickItem[] {
  return input.revision.length >= 2
    ? input.searchMatches.map((match) =>
        createCommitItem(match.commit, match.refs, true),
      )
    : input.commits.map((commit) => createCommitItem(commit));
}

function createCommitItem(
  commit: GitCompareCommit,
  refs: readonly string[] = [],
  alwaysShow = false,
): GitCompareRevisionQuickPickItem {
  return {
    itemType: 'commit',
    label: `$(git-commit) ${commit.subject || commit.sha.slice(0, 8)}`,
    description: [commit.sha.slice(0, 8), commit.author, ...refs].join('  '),
    detail: new Date(commit.authoredAt).toLocaleString(),
    commit,
    ...(alwaysShow ? { alwaysShow: true } : {}),
  };
}
