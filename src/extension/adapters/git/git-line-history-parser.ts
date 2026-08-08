import {
  isFullCommitHash,
  isRepositoryRelativePath,
} from '../../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';

export type ParsedGitLineHistoryBlame = {
  readonly commit: string;
  readonly originalLine: number;
  readonly author: string;
  readonly authoredAt: number;
  readonly summary: string;
  readonly path: string;
  readonly lineText: string;
  readonly previous?: {
    readonly commit: string;
    readonly path: string;
  };
};

type DiffHunk = {
  readonly oldStart: number;
  readonly oldCount: number;
  readonly newStart: number;
  readonly newCount: number;
};

export type GitLineHistoryParentPath =
  | { readonly kind: 'added' }
  | { readonly kind: 'existing'; readonly path: string };

export function parseGitLineHistoryBlame(output: string): ParsedGitLineHistoryBlame {
  const lines = output.split(/\r?\n/u);
  const header = parseBlameHeader(lines[0] ?? '');
  const { lineText, metadata } = readBlameMetadata(lines.slice(1));
  return createParsedBlame(header, metadata, lineText);
}

export function mapGitLineHistoryParentLine(
  output: string,
  targetLine: number,
): number | undefined {
  const lines = output.split(/\r?\n/u);
  let offset = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const hunk = parseHunk(lines[index] ?? '');
    if (hunk === undefined) {
      continue;
    }
    if (targetLine < hunk.newStart) {
      return positiveLine(targetLine - offset);
    }
    const newEnd = hunk.newStart + hunk.newCount - 1;
    if (hunk.newCount > 0 && targetLine <= newEnd) {
      return mapLineInsideHunk(lines, index + 1, hunk, targetLine);
    }
    offset += hunk.newCount - hunk.oldCount;
  }
  return positiveLine(targetLine - offset);
}

export function parseGitLineHistoryParentPath(
  output: string,
  currentPath: string,
): GitLineHistoryParentPath {
  for (const row of output.trimEnd().split(/\r?\n/u)) {
    const fields = row.split('\t');
    const status = fields[0]?.[0];
    if (status === 'R' && fields[2] === currentPath) {
      const path = fields[1];
      if (!isRepositoryRelativePath(path)) {
        throw parseError();
      }
      return { kind: 'existing', path };
    }
    if (fields[1] !== currentPath) {
      continue;
    }
    if (status === 'A') {
      return { kind: 'added' };
    }
    if (status === 'M' || status === 'T') {
      return { kind: 'existing', path: currentPath };
    }
  }
  throw parseError();
}

function parseBlameHeader(value: string): {
  readonly commit: string;
  readonly originalLine: number;
} {
  const match = /^\^?([a-f\d]{40}|[a-f\d]{64}) (\d+) (\d+)(?: 1)?$/iu.exec(value);
  const commit = match?.[1];
  const originalLine = Number(match?.[2]);
  if (!isFullCommitHash(commit) || !isPositiveLine(originalLine)) {
    throw parseError();
  }
  return { commit, originalLine };
}

function readBlameMetadata(lines: readonly string[]): {
  readonly metadata: ReadonlyMap<string, string>;
  readonly lineText: string;
} {
  const metadata = new Map<string, string>();
  let lineText: string | undefined;
  for (const line of lines) {
    if (line.startsWith('\t')) {
      if (lineText !== undefined) {
        throw parseError();
      }
      lineText = line.slice(1);
      continue;
    }
    const separator = line.indexOf(' ');
    if (separator > 0) {
      metadata.set(line.slice(0, separator), line.slice(separator + 1));
    }
  }
  if (lineText === undefined || !isSafeLineText(lineText)) {
    throw parseError();
  }
  return { metadata, lineText };
}

function createParsedBlame(
  header: { readonly commit: string; readonly originalLine: number },
  metadata: ReadonlyMap<string, string>,
  lineText: string,
): ParsedGitLineHistoryBlame {
  const path = metadata.get('filename');
  const author = metadata.get('author');
  const summary = metadata.get('summary');
  const authoredAt = Number(metadata.get('author-time'));
  if (
    !isRepositoryRelativePath(path) ||
    author === undefined ||
    summary === undefined
  ) {
    throw parseError();
  }
  if (!Number.isInteger(authoredAt)) {
    throw parseError();
  }
  const previous = parsePrevious(metadata.get('previous'));
  return {
    ...header,
    author,
    authoredAt,
    summary,
    path,
    lineText,
    ...(previous === undefined ? {} : { previous }),
  };
}

function parsePrevious(
  value: string | undefined,
): ParsedGitLineHistoryBlame['previous'] {
  if (value === undefined) {
    return undefined;
  }
  const separator = value.indexOf(' ');
  const commit = value.slice(0, separator);
  const path = value.slice(separator + 1);
  if (separator < 1 || !isFullCommitHash(commit) || !isRepositoryRelativePath(path)) {
    throw parseError();
  }
  return { commit, path };
}

function parseHunk(line: string): DiffHunk | undefined {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u.exec(line);
  if (match === null) {
    return undefined;
  }
  return {
    oldStart: Number(match[1]),
    oldCount: match[2] === undefined ? 1 : Number(match[2]),
    newStart: Number(match[3]),
    newCount: match[4] === undefined ? 1 : Number(match[4]),
  };
}

function mapLineInsideHunk(
  lines: readonly string[],
  startIndex: number,
  hunk: DiffHunk,
  targetLine: number,
): number | undefined {
  let oldLine = hunk.oldStart;
  let newLine = hunk.newStart;
  const deletedLines: number[] = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.startsWith('@@ ') || line.startsWith('diff --git ')) {
      break;
    }
    if (line.startsWith('---') || line.startsWith('+++')) {
      continue;
    }
    if (line.startsWith('-')) {
      deletedLines.push(oldLine);
      oldLine += 1;
      continue;
    }
    if (line.startsWith('+')) {
      const mapped = deletedLines.shift();
      if (newLine === targetLine) {
        return mapped;
      }
      newLine += 1;
    }
  }
  return undefined;
}

function positiveLine(value: number): number | undefined {
  return isPositiveLine(value) ? value : undefined;
}

function isPositiveLine(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isSafeLineText(value: string): boolean {
  return !value.includes('\0') && !value.includes('\uFFFD');
}

function parseError(): ApplicationError {
  return new ApplicationError('Git line history data is invalid.', {
    code: 'internal-error',
  });
}
