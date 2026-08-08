import {
  isFullCommitHash,
  isRepositoryRelativePath,
  type GitBlameLine,
} from '../../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';

type BlameHeader = {
  readonly commit: string;
  readonly originalLine: number;
  readonly finalLine: number;
};

type BlameMetadata = {
  author?: string;
  email?: string;
  authoredAt?: number;
  summary?: string;
  filename?: string;
  parentCommit?: string;
};

type CompleteBlameMetadata = BlameMetadata & {
  readonly author: string;
  readonly email: string;
  readonly authoredAt: number;
  readonly summary: string;
  readonly filename: string;
};

export function parseGitBlamePorcelain(output: string): readonly GitBlameLine[] {
  if (output.length === 0) {
    return [];
  }
  const rawLines = output.split(/\r?\n/u);
  const result: GitBlameLine[] = [];
  let index = 0;
  while (index < rawLines.length && rawLines[index] !== '') {
    const header = parseHeader(requiredLine(rawLines, index));
    index += 1;
    const metadata: BlameMetadata = {};
    while (index < rawLines.length && !requiredLine(rawLines, index).startsWith('\t')) {
      readMetadata(requiredLine(rawLines, index), metadata);
      index += 1;
    }
    if (index >= rawLines.length) {
      throw parseError();
    }
    index += 1;
    result.push(createBlameLine(header, metadata, result.length + 1));
  }
  if (rawLines.slice(index).some((line) => line !== '')) {
    throw parseError();
  }
  return result;
}

function parseHeader(value: string): BlameHeader {
  const match = /^\^?([a-f\d]{40}|[a-f\d]{64}) (\d+) (\d+)(?: \d+)?$/iu.exec(value);
  if (match === null) {
    throw parseError();
  }
  const commit = match[1];
  const originalLine = Number(match[2]);
  const finalLine = Number(match[3]);
  if (!isFullCommitHash(commit) || originalLine < 1 || finalLine < 1) {
    throw parseError();
  }
  return { commit, originalLine, finalLine };
}

function readMetadata(value: string, metadata: BlameMetadata): void {
  const separatorIndex = value.indexOf(' ');
  const key = separatorIndex < 0 ? value : value.slice(0, separatorIndex);
  const fieldValue = separatorIndex < 0 ? '' : value.slice(separatorIndex + 1);
  switch (key) {
    case 'author':
      metadata.author = fieldValue;
      break;
    case 'author-mail':
      metadata.email = fieldValue.replace(/^<|>$/gu, '');
      break;
    case 'author-time':
      metadata.authoredAt = Number(fieldValue);
      break;
    case 'summary':
      metadata.summary = fieldValue;
      break;
    case 'filename':
      metadata.filename = fieldValue;
      break;
    case 'previous':
      metadata.parentCommit = fieldValue.slice(0, Math.max(0, fieldValue.indexOf(' ')));
      break;
    default:
      break;
  }
}

function createBlameLine(
  header: BlameHeader,
  metadata: BlameMetadata,
  expectedLine: number,
): GitBlameLine {
  if (
    !isCompleteMetadata(metadata) ||
    !isLineHistoryValid(header, metadata, expectedLine)
  ) {
    throw parseError();
  }
  return {
    line: header.finalLine,
    commit: header.commit,
    author: metadata.author,
    email: metadata.email,
    authoredAt: metadata.authoredAt,
    summary: metadata.summary,
    originalPath: metadata.filename,
    originalLine: header.originalLine,
    ...(metadata.parentCommit === undefined
      ? {}
      : { parentCommit: metadata.parentCommit }),
  };
}

function isCompleteMetadata(
  metadata: BlameMetadata,
): metadata is CompleteBlameMetadata {
  return (
    metadata.author !== undefined &&
    metadata.email !== undefined &&
    typeof metadata.authoredAt === 'number' &&
    Number.isInteger(metadata.authoredAt) &&
    metadata.summary !== undefined &&
    isRepositoryRelativePath(metadata.filename)
  );
}

function isLineHistoryValid(
  header: BlameHeader,
  metadata: BlameMetadata,
  expectedLine: number,
): boolean {
  return (
    header.finalLine === expectedLine &&
    (metadata.parentCommit === undefined || isFullCommitHash(metadata.parentCommit))
  );
}

function requiredLine(lines: readonly string[], index: number): string {
  const value = lines[index];
  if (value === undefined) {
    throw parseError();
  }
  return value;
}

function parseError(): ApplicationError {
  return new ApplicationError('Git blame output is invalid.', {
    code: 'internal-error',
  });
}
