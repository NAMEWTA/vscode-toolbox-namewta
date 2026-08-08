export type ExecutableGitResource = {
  readonly repositoryRoot: string;
  readonly relativePath: string;
};

export type GitBlameLine = {
  readonly line: number;
  readonly commit: string;
  readonly author: string;
  readonly email: string;
  readonly authoredAt: number;
  readonly summary: string;
  readonly originalPath?: string;
  readonly originalLine?: number;
  readonly parentCommit?: string;
};

export type GitBlameAnnotationsInput = {
  readonly resource: ExecutableGitResource;
  readonly ref?: string;
  readonly documentVersion: number;
  readonly lineCount: number;
  readonly ignoreWhitespace: boolean;
  readonly maxLines: number;
};

export type GitBlameAnnotationsResult =
  | {
      readonly status: 'available';
      readonly documentVersion: number;
      readonly lines: readonly GitBlameLine[];
      readonly remoteUrl?: string;
    }
  | {
      readonly status: 'unavailable';
      readonly reason: 'empty' | 'max-lines' | 'not-repository' | 'untracked';
    };

export type GitHistoricalDocument = {
  readonly resource: ExecutableGitResource;
  readonly ref: string;
  readonly path: string;
};

export type GitLineHistoryInput = {
  readonly resource: ExecutableGitResource;
  readonly ref: string;
  readonly path: string;
  readonly line: number;
  readonly limit: number;
  readonly cursor?: string;
};

export type GitLineHistoryEntry = {
  readonly changeType: 'added' | 'modified' | 'renamed';
  readonly path: string;
  readonly previousPath?: string;
  readonly line: number;
  readonly commit: string;
  readonly parentCommit: string;
  readonly author: string;
  readonly authoredAt: number;
  readonly summary: string;
  readonly lineText: string;
};

export type GitLineHistoryPage = {
  readonly entries: readonly GitLineHistoryEntry[];
  readonly complete: boolean;
  readonly nextCursor?: string;
};

export type GitCommitChangesInput = {
  readonly resource: ExecutableGitResource;
  readonly commit: string;
  readonly parent?: string;
};

export type GitCommitChange = {
  readonly status: 'added' | 'modified' | 'deleted' | 'renamed';
  readonly path: string;
  readonly previousPath?: string;
  readonly before: GitHistoricalDocument;
  readonly after: GitHistoricalDocument;
};

export type GitCommitChangesResult = {
  readonly changes: readonly GitCommitChange[];
};

export type GitHistoricalContentInput = GitHistoricalDocument;

export type GitHistoricalContentResult = {
  readonly content: string;
};

export type GitCopyCommitHashInput = {
  readonly hash: string;
};

export function isExecutableGitResource(
  value: unknown,
): value is ExecutableGitResource {
  return (
    isRecordWithKeys(value, ['repositoryRoot', 'relativePath']) &&
    typeof value.repositoryRoot === 'string' &&
    isAbsoluteOsPath(value.repositoryRoot) &&
    isRepositoryRelativePath(value.relativePath)
  );
}

export function isFullCommitHash(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[a-f\d]{40}|[a-f\d]{64})$/iu.test(value);
}

export function isGitReference(value: unknown): value is string {
  if (isFullCommitHash(value)) {
    return true;
  }
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z\d][A-Za-z\d._/~^-]*$/u.test(value) &&
    hasSafeReferenceSegments(value)
  );
}

function hasSafeReferenceSegments(value: string): boolean {
  const forbiddenFragments = ['..', '//', '@{'];
  const forbiddenEndings = ['.', '/', '.lock'];
  return (
    !forbiddenFragments.some((fragment) => value.includes(fragment)) &&
    !forbiddenEndings.some((ending) => value.endsWith(ending))
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

export function isGitBlameAnnotationsInput(
  value: unknown,
): value is GitBlameAnnotationsInput {
  return (
    isRecordWithOptionalKeys(
      value,
      ['resource', 'documentVersion', 'lineCount', 'ignoreWhitespace', 'maxLines'],
      ['ref'],
    ) &&
    isExecutableGitResource(value.resource) &&
    (value.ref === undefined || isGitReference(value.ref)) &&
    isNonNegativeInteger(value.documentVersion) &&
    isNonNegativeInteger(value.lineCount) &&
    typeof value.ignoreWhitespace === 'boolean' &&
    Number.isInteger(value.maxLines) &&
    Number(value.maxLines) >= 100 &&
    Number(value.maxLines) <= 200_000
  );
}

export function isGitLineHistoryInput(value: unknown): value is GitLineHistoryInput {
  return (
    isRecordWithOptionalKeys(
      value,
      ['resource', 'ref', 'path', 'line', 'limit'],
      ['cursor'],
    ) &&
    isExecutableGitResource(value.resource) &&
    isGitReference(value.ref) &&
    isRepositoryRelativePath(value.path) &&
    isPositiveInteger(value.line) &&
    isPositiveInteger(value.limit) &&
    Number(value.limit) <= 100 &&
    (value.cursor === undefined || isHistoryCursor(value.cursor))
  );
}

export function isGitCommitChangesInput(
  value: unknown,
): value is GitCommitChangesInput {
  return (
    isRecordWithOptionalKeys(value, ['resource', 'commit'], ['parent']) &&
    isExecutableGitResource(value.resource) &&
    isFullCommitHash(value.commit) &&
    (value.parent === undefined || isFullCommitHash(value.parent))
  );
}

export function isGitHistoricalContentInput(
  value: unknown,
): value is GitHistoricalContentInput {
  return (
    isRecordWithKeys(value, ['resource', 'ref', 'path']) &&
    isExecutableGitResource(value.resource) &&
    isGitReference(value.ref) &&
    isRepositoryRelativePath(value.path)
  );
}

function isHistoryCursor(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 4_096 &&
    /^[A-Za-z\d_-]+\.[a-f\d]{8}$/u.test(value)
  );
}

function isAbsoluteOsPath(value: string): boolean {
  return (
    !value.includes('\0') &&
    (value.startsWith('/') ||
      /^[A-Za-z]:[\\/]/u.test(value) ||
      /^\\\\[^\\]+\\[^\\]+/u.test(value))
  );
}

function isPositiveInteger(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) > 0;
}

function isNonNegativeInteger(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= 0;
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
