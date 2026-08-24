import type { GitCompareSearchMatch } from '../../core/domains/git-compare/public-api';
import type { GitCompareCommitSearcher } from './git-compare-revision-quick-pick-contract';

export type GitCompareRevisionSearchSession = {
  readonly repositoryRoot: string;
  readonly controller: AbortController;
  readonly view: { readonly value: string };
  searchMatches: readonly GitCompareSearchMatch[];
  isSearching: boolean;
  searchGeneration: number;
  searchController: AbortController | undefined;
  searchTimer: ReturnType<typeof setTimeout> | undefined;
};

export type GitCompareRevisionSearchCallbacks = {
  readonly isActive: () => boolean;
  readonly render: () => void;
  readonly updateBusy: () => void;
  readonly reportError: (error: unknown) => void;
};

export function scheduleGitCompareRevisionSearch(
  session: GitCompareRevisionSearchSession,
  value: string,
  searchCommits: GitCompareCommitSearcher,
  limit: number,
  delayMs: number,
  callbacks: GitCompareRevisionSearchCallbacks,
): void {
  if (!callbacks.isActive()) return;
  cancelGitCompareRevisionSearch(session, callbacks.updateBusy);
  session.searchMatches = [];
  callbacks.render();
  const query = value.trim();
  if (!isSearchableQuery(query)) return;
  const generation = ++session.searchGeneration;
  session.searchTimer = setTimeout(() => {
    session.searchTimer = undefined;
    void runGitCompareRevisionSearch(
      session,
      query,
      generation,
      searchCommits,
      limit,
      callbacks,
    );
  }, delayMs);
}

export function cancelGitCompareRevisionSearch(
  session: GitCompareRevisionSearchSession,
  updateBusy: () => void,
): void {
  if (session.searchTimer !== undefined) clearTimeout(session.searchTimer);
  session.searchTimer = undefined;
  session.searchController?.abort();
  session.searchController = undefined;
  session.isSearching = false;
  session.searchGeneration += 1;
  updateBusy();
}

async function runGitCompareRevisionSearch(
  session: GitCompareRevisionSearchSession,
  query: string,
  generation: number,
  searchCommits: GitCompareCommitSearcher,
  limit: number,
  callbacks: GitCompareRevisionSearchCallbacks,
): Promise<void> {
  if (!isCurrentQuery(session, query, callbacks.isActive())) return;
  const controller = new AbortController();
  session.searchController = controller;
  session.isSearching = true;
  callbacks.updateBusy();
  try {
    const result = await searchCommits(
      { repositoryRoot: session.repositoryRoot, query, limit },
      controller.signal,
    );
    if (canApplyResult(session, query, generation, controller, callbacks.isActive())) {
      session.searchMatches = result.matches;
      callbacks.render();
    }
  } catch (error: unknown) {
    if (shouldReport(session, generation, controller, callbacks.isActive())) {
      callbacks.reportError(error);
    }
  } finally {
    finishSearch(session, controller, callbacks.updateBusy);
  }
}

function finishSearch(
  session: GitCompareRevisionSearchSession,
  controller: AbortController,
  updateBusy: () => void,
): void {
  if (session.searchController === controller) {
    session.searchController = undefined;
    session.isSearching = false;
  }
  updateBusy();
}

function canApplyResult(
  session: GitCompareRevisionSearchSession,
  query: string,
  generation: number,
  controller: AbortController,
  isActive: boolean,
): boolean {
  return (
    isActive &&
    !controller.signal.aborted &&
    session.searchGeneration === generation &&
    session.view.value.trim() === query
  );
}

function shouldReport(
  session: GitCompareRevisionSearchSession,
  generation: number,
  controller: AbortController,
  isActive: boolean,
): boolean {
  return (
    isActive &&
    !session.controller.signal.aborted &&
    !controller.signal.aborted &&
    session.searchGeneration === generation
  );
}

function isCurrentQuery(
  session: GitCompareRevisionSearchSession,
  query: string,
  isActive: boolean,
): boolean {
  return isActive && session.view.value.trim() === query;
}

function isSearchableQuery(query: string): boolean {
  return query.length >= 2 && query.length <= 256;
}
