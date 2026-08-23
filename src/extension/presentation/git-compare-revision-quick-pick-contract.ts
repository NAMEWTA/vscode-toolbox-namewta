import type {
  GitCompareCommit,
  GitCompareHistoryInput,
  GitCompareHistoryPage,
  GitCompareResolveRevisionInput,
} from '../../core/domains/git-compare/public-api';

export type GitCompareRevisionSelection = {
  readonly base: GitCompareCommit;
  readonly target: GitCompareCommit;
};

export type GitCompareRevisionQuickPickItem = {
  readonly itemType: 'commit' | 'resolve' | 'load-more' | 'back';
  readonly label: string;
  readonly description?: string;
  readonly detail?: string;
  readonly alwaysShow?: boolean;
  readonly commit?: GitCompareCommit;
  readonly revision?: string;
};

export type GitCompareRevisionQuickPickView = {
  title: string | undefined;
  placeholder: string | undefined;
  value: string;
  step: number | undefined;
  totalSteps: number | undefined;
  items: readonly GitCompareRevisionQuickPickItem[];
  selectedItems: readonly GitCompareRevisionQuickPickItem[];
  activeItems: readonly GitCompareRevisionQuickPickItem[];
  busy: boolean;
  matchOnDescription: boolean;
  matchOnDetail: boolean;
  onDidAccept(listener: () => void): { dispose(): void };
  onDidHide(listener: () => void): { dispose(): void };
  onDidChangeValue(listener: (value: string) => void): { dispose(): void };
  show(): void;
  hide(): void;
  dispose(): void;
};

export type GitCompareHistoryPageLoader = (
  input: GitCompareHistoryInput,
  signal: AbortSignal,
) => Promise<GitCompareHistoryPage>;

export type GitCompareRevisionResolver = (
  input: GitCompareResolveRevisionInput,
  signal: AbortSignal,
) => Promise<GitCompareCommit>;

export type GitCompareRevisionQuickPickLabels = {
  readonly baseTitle: string;
  readonly targetTitle: (base: GitCompareCommit) => string;
  readonly basePlaceholder: string;
  readonly targetPlaceholder: string;
  readonly loadMore: string;
  readonly back: string;
  readonly useRevision: (revision: string) => string;
  readonly sameRevision: string;
};
