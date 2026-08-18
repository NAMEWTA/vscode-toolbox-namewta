export type GitCompareRepository = {
  readonly repositoryRoot: string;
};

export type GitCompareCommit = {
  readonly sha: string;
  readonly parents: readonly string[];
  readonly author: string;
  readonly authoredAt: number;
  readonly subject: string;
};

export type GitCompareHistoryInput = {
  readonly repositoryRoot: string;
  readonly limit: number;
  readonly cursor?: string;
};

export type GitCompareHistoryPage = {
  readonly commits: readonly GitCompareCommit[];
  readonly complete: boolean;
  readonly nextCursor?: string;
};

export type GitCompareFileStatus =
  | 'added'
  | 'copied'
  | 'deleted'
  | 'modified'
  | 'renamed'
  | 'type-changed'
  | 'unmerged'
  | 'unknown';

export type GitCompareContentKind = 'text' | 'binary' | 'submodule' | 'unavailable';

export type GitCompareFileChange = {
  readonly status: GitCompareFileStatus;
  readonly path: string;
  readonly previousPath?: string;
  readonly contentKind: GitCompareContentKind;
  readonly additions?: number;
  readonly deletions?: number;
};

export type GitCompareInput = {
  readonly repositoryRoot: string;
  readonly base: string;
  readonly target: string;
};

export type GitCompareResult = {
  readonly base: string;
  readonly target: string;
  readonly changes: readonly GitCompareFileChange[];
  readonly stats: {
    readonly files: number;
    readonly additions: number;
    readonly deletions: number;
  };
};

export type GitCompareRevisionInput = {
  readonly repositoryRoot: string;
  readonly ref: string;
  readonly path: string;
};

export type GitCompareRevisionResult =
  | { readonly kind: 'text'; readonly content: string }
  | {
      readonly kind: 'summary';
      readonly reason: 'binary' | 'submodule' | 'too-large' | 'missing';
    };

export const GIT_COMPARE_EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

export function isGitCompareRepository(value: unknown): value is GitCompareRepository {
  return (
    isRecordWithKeys(value, ['repositoryRoot']) && isAbsolutePath(value.repositoryRoot)
  );
}

export function isGitCompareHistoryInput(
  value: unknown,
): value is GitCompareHistoryInput {
  return (
    isRecordWithOptionalKeys(value, ['repositoryRoot', 'limit'], ['cursor']) &&
    isAbsolutePath(value.repositoryRoot) &&
    Number.isInteger(value.limit) &&
    Number(value.limit) > 0 &&
    Number(value.limit) <= 200 &&
    (value.cursor === undefined || isGitCompareCursor(value.cursor))
  );
}

export function isGitCompareInput(value: unknown): value is GitCompareInput {
  return (
    isRecordWithKeys(value, ['repositoryRoot', 'base', 'target']) &&
    isAbsolutePath(value.repositoryRoot) &&
    isFullCommitHash(value.base) &&
    isFullCommitHash(value.target)
  );
}

export function isGitCompareRevisionInput(
  value: unknown,
): value is GitCompareRevisionInput {
  return (
    isRecordWithKeys(value, ['repositoryRoot', 'ref', 'path']) &&
    isAbsolutePath(value.repositoryRoot) &&
    isFullCommitHash(value.ref) &&
    isRepositoryRelativePath(value.path)
  );
}

export function isFullCommitHash(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[a-f\d]{40}|[a-f\d]{64})$/iu.test(value);
}

export function isGitCompareCursor(value: unknown): value is string {
  return (
    typeof value === 'string' && /^(?:[a-f\d]{40}|[a-f\d]{64})\.\d{1,9}$/iu.test(value)
  );
}

export function isRepositoryRelativePath(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 4_096 ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.includes('\0')
  ) {
    return false;
  }
  return value
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..');
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
