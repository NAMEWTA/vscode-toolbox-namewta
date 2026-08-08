import type { GitCancellationSignal } from './git-blame-port';
import type {
  GitCommitChangesInput,
  GitCommitChangesResult,
  GitHistoricalContentInput,
  GitHistoricalContentResult,
} from './git-blame-model';

export const GIT_EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

export type GitHistoryPort = {
  getCommitChanges(
    input: GitCommitChangesInput,
    signal: GitCancellationSignal,
  ): Promise<GitCommitChangesResult>;
  getHistoricalContent(
    input: GitHistoricalContentInput,
    signal: GitCancellationSignal,
  ): Promise<GitHistoricalContentResult>;
};
