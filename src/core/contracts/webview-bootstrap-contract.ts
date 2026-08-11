export type WebviewStrings = {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly runtimeStatusTitle: string;
  readonly refresh: string;
  readonly refreshing: string;
  readonly loadingRuntimeInfo: string;
  readonly extensionLabel: string;
  readonly apiLabel: string;
  readonly vscodeLabel: string;
  readonly nodeLabel: string;
  readonly languageLabel: string;
  readonly workspaceLabel: string;
  readonly environmentLabel: string;
  readonly runtimeLabel: string;
  readonly toolsLabel: string;
  readonly trusted: string;
  readonly restricted: string;
  readonly remote: string;
  readonly local: string;
  readonly unknownError: string;
};

export type WebviewBootstrap = {
  readonly version: 1;
  readonly language: string;
  readonly requestTimeoutMs: number;
  readonly strings: WebviewStrings;
};

export type GitReviewWebviewStrings = {
  readonly title: string;
  readonly conflict: string;
  readonly staged: string;
  readonly unstaged: string;
  readonly stage: string;
  readonly unstage: string;
  readonly discard: string;
  readonly openFile: string;
  readonly openDiff: string;
  readonly copyReference: string;
  readonly markReviewed: string;
  readonly skip: string;
  readonly mergeChanges: string;
  readonly loading: string;
  readonly retry: string;
  readonly binary: string;
  readonly submodule: string;
  readonly tooLarge: string;
  readonly unavailable: string;
  readonly noChanges: string;
  readonly refreshRequired: string;
  readonly additions: string;
  readonly deletions: string;
};

export type GitReviewWebviewBootstrap = {
  readonly version: 1;
  readonly view: 'git-review';
  readonly language: string;
  readonly requestTimeoutMs: number;
  readonly strings: GitReviewWebviewStrings;
  readonly snapshot: GitReviewSessionSnapshot;
};

const WEBVIEW_STRING_KEYS = [
  'eyebrow',
  'title',
  'description',
  'runtimeStatusTitle',
  'refresh',
  'refreshing',
  'loadingRuntimeInfo',
  'extensionLabel',
  'apiLabel',
  'vscodeLabel',
  'nodeLabel',
  'languageLabel',
  'workspaceLabel',
  'environmentLabel',
  'runtimeLabel',
  'toolsLabel',
  'trusted',
  'restricted',
  'remote',
  'local',
  'unknownError',
] as const satisfies readonly (keyof WebviewStrings)[];

export function isWebviewBootstrap(value: unknown): value is WebviewBootstrap {
  if (!isRecord(value) || value.version !== 1) {
    return false;
  }

  return (
    typeof value.language === 'string' &&
    value.language.length > 0 &&
    isWebviewTimeout(value.requestTimeoutMs) &&
    hasWebviewStrings(value.strings)
  );
}

export function isGitReviewWebviewBootstrap(
  value: unknown,
): value is GitReviewWebviewBootstrap {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    value.view !== 'git-review' ||
    typeof value.language !== 'string' ||
    value.language.length === 0 ||
    !isWebviewTimeout(value.requestTimeoutMs) ||
    !hasGitReviewStrings(value.strings) ||
    !isGitReviewSessionSnapshot(value.snapshot)
  ) {
    return false;
  }
  return true;
}

function hasWebviewStrings(value: unknown): value is WebviewStrings {
  if (!isRecord(value)) {
    return false;
  }

  return WEBVIEW_STRING_KEYS.every(
    (key) => typeof value[key] === 'string' && value[key].length > 0,
  );
}

function hasGitReviewStrings(value: unknown): value is GitReviewWebviewStrings {
  if (!isRecord(value)) {
    return false;
  }
  const keys: readonly (keyof GitReviewWebviewStrings)[] = [
    'title',
    'conflict',
    'staged',
    'unstaged',
    'stage',
    'unstage',
    'discard',
    'openFile',
    'openDiff',
    'copyReference',
    'markReviewed',
    'skip',
    'mergeChanges',
    'loading',
    'retry',
    'binary',
    'submodule',
    'tooLarge',
    'unavailable',
    'noChanges',
    'refreshRequired',
    'additions',
    'deletions',
  ];
  return keys.every((key) => typeof value[key] === 'string' && value[key].length > 0);
}

function isWebviewTimeout(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 1_000 &&
    value <= 120_000
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
import { type GitReviewSessionSnapshot } from '../domains/git-review/git-review-model';
import { isGitReviewSessionSnapshot } from '../domains/git-review/git-review-session-snapshot-contract';
