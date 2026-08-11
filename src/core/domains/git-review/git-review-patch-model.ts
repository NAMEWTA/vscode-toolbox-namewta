import { isGitReviewItemContent, type GitReviewItemContent } from './git-review-model';

export type GitReviewItemActionInput = {
  readonly itemId: string;
  readonly contentIdentity: string;
};

export type GitReviewDiffLine = {
  readonly kind: 'context' | 'addition' | 'deletion';
  readonly oldLine?: number;
  readonly newLine?: number;
  readonly text: string;
};

export type GitReviewDiffHunk = {
  readonly header: string;
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly lines: readonly GitReviewDiffLine[];
};

export type GitReviewItemPatch =
  | {
      readonly kind: 'patch';
      readonly additions: number;
      readonly deletions: number;
      readonly hunks: readonly GitReviewDiffHunk[];
    }
  | Extract<GitReviewItemContent, { readonly kind: 'summary' }>;

export function isGitReviewItemActionInput(
  value: unknown,
): value is GitReviewItemActionInput {
  return (
    isRecordWithKeys(value, ['itemId', 'contentIdentity']) &&
    isBoundedText(value.itemId, 4_128) &&
    isBoundedText(value.contentIdentity, 512)
  );
}

export function isGitReviewItemPatch(value: unknown): value is GitReviewItemPatch {
  if (isGitReviewItemContent(value)) {
    return value.kind === 'summary';
  }
  return (
    isRecordWithKeys(value, ['kind', 'additions', 'deletions', 'hunks']) &&
    value.kind === 'patch' &&
    isNonNegativeInteger(value.additions) &&
    isNonNegativeInteger(value.deletions) &&
    Array.isArray(value.hunks) &&
    value.hunks.every(isGitReviewDiffHunk)
  );
}

function isGitReviewDiffHunk(value: unknown): boolean {
  return (
    isRecordWithKeys(value, [
      'header',
      'oldStart',
      'oldLines',
      'newStart',
      'newLines',
      'lines',
    ]) &&
    typeof value.header === 'string' &&
    value.header.length <= 4_096 &&
    isNonNegativeInteger(value.oldStart) &&
    isNonNegativeInteger(value.oldLines) &&
    isNonNegativeInteger(value.newStart) &&
    isNonNegativeInteger(value.newLines) &&
    Array.isArray(value.lines) &&
    value.lines.every(isGitReviewDiffLine)
  );
}

function isGitReviewDiffLine(value: unknown): boolean {
  if (
    !isRecordWithOptionalKeys(value, ['kind', 'text'], ['oldLine', 'newLine']) ||
    !['context', 'addition', 'deletion'].includes(String(value.kind)) ||
    typeof value.text !== 'string' ||
    value.text.length > 1_000_000
  ) {
    return false;
  }
  return (
    (value.oldLine === undefined || isNonNegativeInteger(value.oldLine)) &&
    (value.newLine === undefined || isNonNegativeInteger(value.newLine))
  );
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    !value.includes('\0')
  );
}

function isNonNegativeInteger(value: unknown): value is number {
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
