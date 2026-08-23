import type {
  GitCompareFileChange,
  GitCompareHistoryInput,
  GitCompareHistoryPage,
  GitCompareInput,
  GitCompareCommit,
  GitCompareResolveRevisionInput,
  GitCompareRevisionInput,
  GitCompareRevisionResult,
} from './git-compare-model';

export type GitCompareCancellationSignal = {
  readonly aborted: boolean;
  addEventListener?(
    type: 'abort',
    listener: () => void,
    options?: { readonly once?: boolean },
  ): void;
  removeEventListener?(type: 'abort', listener: () => void): void;
};

export type GitComparePort = {
  listCommits(
    input: GitCompareHistoryInput,
    signal: GitCompareCancellationSignal,
  ): Promise<GitCompareHistoryPage>;
  resolveRevision(
    input: GitCompareResolveRevisionInput,
    signal: GitCompareCancellationSignal,
  ): Promise<GitCompareCommit>;
  compareCommits(
    input: GitCompareInput,
    signal: GitCompareCancellationSignal,
  ): Promise<{
    readonly changes: readonly GitCompareFileChange[];
    readonly stats: {
      readonly files: number;
      readonly additions: number;
      readonly deletions: number;
    };
  }>;
  getRevisionContent(
    input: GitCompareRevisionInput,
    signal: GitCompareCancellationSignal,
  ): Promise<GitCompareRevisionResult>;
};
