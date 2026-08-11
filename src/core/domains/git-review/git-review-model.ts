export type GitReviewChange =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'untracked'
  | 'conflicted';

export type GitReviewLayer = 'conflict' | 'staged' | 'unstaged';

export type GitReviewPresentation = 'text' | 'binary' | 'submodule';

export type GitReviewItemState = 'unreviewed' | 'reviewed' | 'skipped';

export type GitReviewChangeDescriptor = {
  readonly itemId?: string;
  readonly layer?: GitReviewLayer;
  readonly path: string;
  readonly previousPath?: string;
  readonly contentIdentity: string;
  readonly change: GitReviewChange;
  readonly presentation: GitReviewPresentation;
};

export type GitReviewItem = GitReviewChangeDescriptor & {
  readonly itemId: string;
  readonly layer: GitReviewLayer;
  readonly reviewState: GitReviewItemState;
};

export type GitReviewProgress = {
  readonly total: number;
  readonly reviewed: number;
  readonly skipped: number;
  readonly remaining: number;
};

export type GitReviewSession = {
  readonly repositoryRoot: string;
  readonly currentItemId: string;
  readonly currentItemPath: string;
  readonly items: readonly GitReviewItem[];
  readonly progress: GitReviewProgress;
};

export type GitReviewSummary = {
  readonly total: number;
  readonly reviewed: number;
  readonly skipped: number;
};

export type GitReviewSessionSnapshot =
  | {
      readonly state: 'inactive' | 'loading';
    }
  | {
      readonly state: 'active' | 'stale' | 'refreshing';
      readonly session: GitReviewSession;
    }
  | {
      readonly state: 'completed';
      readonly summary: GitReviewSummary;
    };

export type GitReviewStartInput = {
  readonly repositoryRoot: string;
  readonly replace: boolean;
};

export type GitReviewItemContent =
  | {
      readonly kind: 'text';
      readonly before: string;
      readonly after: string;
    }
  | {
      readonly kind: 'summary';
      readonly reason:
        | 'binary'
        | 'submodule'
        | 'conflict'
        | 'too-large'
        | 'unavailable';
    };

export type GitReviewItemContentInput = {
  readonly path: string;
  readonly contentIdentity: string;
};

export function isGitReviewStartInput(value: unknown): value is GitReviewStartInput {
  return (
    isRecordWithKeys(value, ['repositoryRoot', 'replace']) &&
    isAbsolutePath(value.repositoryRoot) &&
    typeof value.replace === 'boolean'
  );
}

export function isGitReviewItemContentInput(
  value: unknown,
): value is GitReviewItemContentInput {
  return (
    isRecordWithKeys(value, ['path', 'contentIdentity']) &&
    isGitReviewPath(value.path) &&
    isContentIdentity(value.contentIdentity)
  );
}

export function isGitReviewItemContent(value: unknown): value is GitReviewItemContent {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return false;
  }
  if (value.kind === 'text') {
    return (
      isRecordWithKeys(value, ['kind', 'before', 'after']) &&
      typeof value.before === 'string' &&
      typeof value.after === 'string'
    );
  }
  return (
    value.kind === 'summary' &&
    isRecordWithKeys(value, ['kind', 'reason']) &&
    SUMMARY_REASONS.has(String(value.reason))
  );
}

const SUMMARY_REASONS = new Set([
  'binary',
  'submodule',
  'conflict',
  'too-large',
  'unavailable',
]);

export function isGitReviewChangeDescriptor(
  value: unknown,
): value is GitReviewChangeDescriptor {
  return (
    isRecordWithOptionalKeys(
      value,
      ['path', 'contentIdentity', 'change', 'presentation'],
      ['itemId', 'layer', 'previousPath'],
    ) &&
    hasValidOptionalItemIdentity(value) &&
    isGitReviewPath(value.path) &&
    (value.previousPath === undefined || isGitReviewPath(value.previousPath)) &&
    isContentIdentity(value.contentIdentity) &&
    isGitReviewChange(value.change) &&
    isGitReviewPresentation(value.presentation)
  );
}

function isGitReviewChange(value: unknown): value is GitReviewChange {
  return (
    value === 'added' ||
    value === 'modified' ||
    value === 'deleted' ||
    value === 'renamed' ||
    value === 'untracked' ||
    value === 'conflicted'
  );
}

function hasValidOptionalItemIdentity(value: Record<string, unknown>): boolean {
  if (value.itemId === undefined && value.layer === undefined) {
    return true;
  }
  return (
    typeof value.itemId === 'string' &&
    value.itemId.length > 0 &&
    value.itemId.length <= 4_128 &&
    !value.itemId.includes('\0') &&
    (value.layer === 'conflict' ||
      value.layer === 'staged' ||
      value.layer === 'unstaged')
  );
}

function isGitReviewPresentation(value: unknown): value is GitReviewPresentation {
  return value === 'text' || value === 'binary' || value === 'submodule';
}

function isAbsolutePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 4_096 &&
    !value.includes('\0') &&
    (value.startsWith('/') ||
      /^[A-Za-z]:[\\/]/u.test(value) ||
      /^\\\\[^\\]+\\[^\\]+/u.test(value))
  );
}

function isGitReviewPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 4_096 &&
    !value.includes('\0') &&
    !value.startsWith('/') &&
    value
      .split('/')
      .every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  );
}

function isContentIdentity(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 512 &&
    !value.includes('\0')
  );
}

function isRecordWithKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => key in value)
  );
}

function isRecordWithOptionalKeys(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[],
): value is Record<string, unknown> {
  if (!isRecord(value) || !requiredKeys.every((key) => key in value)) {
    return false;
  }
  const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
