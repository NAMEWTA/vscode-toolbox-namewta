import type { ToolError } from '../../core/contracts/tool-error-contract';
import type {
  GitReviewItem,
  GitReviewSessionSnapshot,
  GitReviewSummary,
} from '../../core/domains/git-review/public-api';
import type { Disposable } from '../../core/kernel/disposable';
import type { ToolboxGateway } from '../../core/orchestration/public-api';

export type GitReviewRepositoryResolver = {
  resolve(args: readonly unknown[], signal: AbortSignal): Promise<string | undefined>;
};

export type GitReviewPresentation = Disposable & {
  render(snapshot: GitReviewSessionSnapshot): void;
  focusItem?(item: GitReviewItem): boolean;
  openItemDiff?(item: GitReviewItem): Promise<boolean>;
};

export type GitReviewControllerHost = {
  confirmReplace(): Promise<boolean>;
  confirmEnd(): Promise<boolean>;
  confirmDiscard(path: string): Promise<boolean>;
  reportFailure(error: ToolError): Promise<void>;
  showStale(): Promise<void>;
  showSummary(summary: GitReviewSummary): Promise<void>;
};

export type GitReviewWatcherFactory = (
  repositoryRoot: string,
  onChange: () => Promise<void>,
) => Disposable;

export type GitReviewSessionControllerDependencies = {
  readonly gateway: ToolboxGateway;
  readonly repositoryResolver: GitReviewRepositoryResolver;
  readonly presentation: GitReviewPresentation;
  readonly host: GitReviewControllerHost;
  readonly watcherFactory: GitReviewWatcherFactory;
};
