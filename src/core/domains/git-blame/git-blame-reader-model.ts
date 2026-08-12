/* eslint-disable max-lines */
import type { ExecutableGitResource, GitBlameLine } from './git-blame-model';

export type GitBlameReaderLineKind = 'committed' | 'uncommitted';

export type GitBlameReaderLine = {
  readonly line: number;
  readonly text: string;
  readonly blame: GitBlameLine;
  readonly kind: GitBlameReaderLineKind;
};

export type GitBlameReaderBlock = {
  readonly blockId: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly commit: string;
  readonly kind: GitBlameReaderLineKind;
  readonly author: string;
  readonly email: string;
  readonly authoredAt: number;
  readonly summary: string;
  readonly lines: readonly GitBlameReaderLine[];
};

export type GitBlameReaderModel = {
  readonly version: 1;
  readonly generation: number;
  readonly sourceUri: string;
  readonly resource: ExecutableGitResource;
  readonly remoteUrl?: string;
  readonly revision: string;
  readonly documentVersion: number;
  readonly sourceLine: number;
  readonly lineCount: number;
  readonly lineEnding: '\n' | '\r\n' | '\r';
  readonly hasFinalNewline: boolean;
  readonly lines: readonly GitBlameReaderLine[];
  readonly blocks: readonly GitBlameReaderBlock[];
};

export type GitBlameReaderBuildInput = {
  readonly sourceUri: string;
  readonly resource: ExecutableGitResource;
  readonly revision: string;
  readonly documentVersion: number;
  readonly generation: number;
  readonly sourceLine: number;
  readonly remoteUrl?: string;
  readonly sourceText: string;
  readonly blameLines: readonly GitBlameLine[];
};

export type GitBlameReaderCopyFormat =
  | 'code'
  | 'line-with-blame'
  | 'commit-sha'
  | 'commit-info'
  | 'block-code'
  | 'block-with-blame'
  | 'all-code'
  | 'all-with-blame';

export type GitBlameReaderCopyRequest = {
  readonly model: GitBlameReaderModel;
  readonly format: GitBlameReaderCopyFormat;
  readonly line?: number;
  readonly blockId?: string;
};

// eslint-disable-next-line complexity
export function isValidGitBlameReaderCopyRequest(
  request: GitBlameReaderCopyRequest,
): boolean {
  const lineValid =
    request.line === undefined ||
    (Number.isInteger(request.line) &&
      request.line >= 1 &&
      request.line <= request.model.lineCount);
  const blockValid =
    request.blockId === undefined ||
    request.model.blocks.some(({ blockId }) => blockId === request.blockId);
  const hasLine = request.line !== undefined;
  const hasBlock = request.blockId !== undefined;
  return (
    lineValid &&
    blockValid &&
    (((request.format === 'all-code' || request.format === 'all-with-blame') &&
      !hasLine &&
      !hasBlock) ||
      (request.format.startsWith('block-') && hasBlock && !hasLine) ||
      ((request.format === 'code' || request.format === 'line-with-blame') &&
        hasLine &&
        !hasBlock) ||
      ((request.format === 'commit-sha' || request.format === 'commit-info') &&
        hasLine !== hasBlock))
  );
}

export function buildGitBlameReaderModel(
  input: GitBlameReaderBuildInput,
): GitBlameReaderModel {
  if (input.sourceText.length === 0) {
    throw new Error('Git Blame Reader requires non-empty source text.');
  }
  const source = splitSourceText(input.sourceText);
  const blameLines = [...input.blameLines];
  if (blameLines.length !== source.lines.length) {
    throw new Error('Git blame output does not match the source line count.');
  }
  const lines = source.lines.map((text, index) => {
    const blame = blameLines[index];
    if (blame === undefined || blame.line !== index + 1) {
      throw new Error('Git blame line numbers are not contiguous.');
    }
    const kind = isUncommittedCommit(blame.commit) ? 'uncommitted' : 'committed';
    return Object.freeze({ line: index + 1, text, blame, kind });
  });
  const blocks = buildBlocks(lines);
  return Object.freeze({
    version: 1,
    generation: input.generation,
    sourceUri: input.sourceUri,
    resource: Object.freeze({ ...input.resource }),
    ...(input.remoteUrl === undefined ? {} : { remoteUrl: input.remoteUrl }),
    revision: input.revision,
    documentVersion: input.documentVersion,
    sourceLine: Math.min(input.sourceLine, lines.length),
    lineCount: lines.length,
    lineEnding: source.lineEnding,
    hasFinalNewline: source.hasFinalNewline,
    lines: Object.freeze(lines),
    blocks: Object.freeze(blocks),
  });
}

// eslint-disable-next-line complexity
export function isGitBlameReaderModel(value: unknown): value is GitBlameReaderModel {
  if (!isRecord(value) || value.version !== 1) return false;
  if (
    !Number.isInteger(value.generation) ||
    Number(value.generation) <= 0 ||
    typeof value.sourceUri !== 'string' ||
    value.sourceUri.length === 0 ||
    typeof value.revision !== 'string' ||
    value.revision.length === 0 ||
    !isResource(value.resource) ||
    (value.remoteUrl !== undefined &&
      (typeof value.remoteUrl !== 'string' || value.remoteUrl.length > 2_048)) ||
    !Number.isInteger(value.documentVersion) ||
    Number(value.documentVersion) < 0 ||
    !Number.isInteger(value.sourceLine) ||
    Number(value.sourceLine) < 1 ||
    Number(value.sourceLine) > Number(value.lineCount) ||
    !Number.isInteger(value.lineCount) ||
    Number(value.lineCount) < 1 ||
    !(['\n', '\r\n', '\r'] as const).includes(value.lineEnding as never) ||
    typeof value.hasFinalNewline !== 'boolean' ||
    !Array.isArray(value.lines) ||
    !Array.isArray(value.blocks) ||
    value.lines.length !== value.lineCount
  ) {
    return false;
  }
  return (
    value.lines.every(isReaderLine) &&
    value.blocks.every(isReaderBlock) &&
    value.blocks.flatMap((block) => block.lines).length === value.lines.length
  );
}

// eslint-disable-next-line complexity
export function formatGitBlameReaderCopy(request: GitBlameReaderCopyRequest): string {
  if (!isValidGitBlameReaderCopyRequest(request)) return invalidCopyRequest();
  const { model, format } = request;
  const line = request.line === undefined ? undefined : model.lines[request.line - 1];
  const block =
    request.blockId === undefined
      ? model.blocks.find(
          (candidate) =>
            line !== undefined &&
            line.line >= candidate.startLine &&
            line.line <= candidate.endLine,
        )
      : model.blocks.find((candidate) => candidate.blockId === request.blockId);
  switch (format) {
    case 'code':
      return line?.text ?? invalidCopyRequest();
    case 'line-with-blame':
      return line === undefined ? invalidCopyRequest() : formatLineWithBlame(line);
    case 'commit-sha':
      if (block?.kind === 'uncommitted' || line?.kind === 'uncommitted') {
        return 'Uncommitted';
      }
      return block?.commit ?? line?.blame.commit ?? invalidCopyRequest();
    case 'commit-info':
      return block === undefined ? invalidCopyRequest() : formatCommitInfo(block);
    case 'block-code':
      return block === undefined ? invalidCopyRequest() : joinLines(block.lines, model);
    case 'block-with-blame':
      return block === undefined
        ? invalidCopyRequest()
        : joinFormattedLines(block.lines, model);
    case 'all-code':
      return joinLines(model.lines, model);
    case 'all-with-blame':
      return joinFormattedLines(model.lines, model);
  }
}

function formatLineWithBlame(line: GitBlameReaderLine): string {
  const sha =
    line.kind === 'uncommitted' ? 'Uncommitted' : line.blame.commit.slice(0, 12);
  const date =
    line.kind === 'uncommitted'
      ? 'Working Tree'
      : new Date(line.blame.authoredAt * 1_000).toISOString();
  return `${line.line}\t${date}\t${line.blame.author}\t${sha}\t${line.text}`;
}

function formatCommitInfo(block: GitBlameReaderBlock): string {
  const sha = block.kind === 'uncommitted' ? 'Uncommitted' : block.commit;
  return `${sha}\n${block.author} <${block.email}>\n${new Date(block.authoredAt * 1_000).toISOString()}\n${block.summary}`;
}

function joinLines(
  lines: readonly GitBlameReaderLine[],
  model: GitBlameReaderModel,
): string {
  const eol = model.lineEnding;
  return (
    lines.map((line) => line.text).join(eol) +
    (model.hasFinalNewline && lines.at(-1)?.line === model.lineCount ? eol : '')
  );
}

function joinFormattedLines(
  lines: readonly GitBlameReaderLine[],
  model: GitBlameReaderModel,
): string {
  return (
    lines.map(formatLineWithBlame).join(model.lineEnding) +
    (model.hasFinalNewline && lines.at(-1)?.line === model.lineCount
      ? model.lineEnding
      : '')
  );
}

function buildBlocks(lines: readonly GitBlameReaderLine[]): GitBlameReaderBlock[] {
  const blocks: GitBlameReaderBlock[] = [];
  for (const line of lines) {
    const previous = blocks.at(-1);
    if (
      previous !== undefined &&
      previous.commit === line.blame.commit &&
      previous.kind === line.kind
    ) {
      const next = Object.freeze({
        ...previous,
        endLine: line.line,
        lines: Object.freeze([...previous.lines, line]),
      });
      blocks[blocks.length - 1] = next;
      continue;
    }
    blocks.push(
      Object.freeze({
        blockId: `block-${line.line}-${line.blame.commit.slice(0, 12)}`,
        startLine: line.line,
        endLine: line.line,
        commit: line.blame.commit,
        kind: line.kind,
        author: line.kind === 'uncommitted' ? 'Working Tree' : line.blame.author,
        email: line.blame.email,
        authoredAt: line.blame.authoredAt,
        summary:
          line.kind === 'uncommitted' ? 'Uncommitted changes' : line.blame.summary,
        lines: Object.freeze([line]),
      }),
    );
  }
  return blocks;
}

function splitSourceText(sourceText: string): {
  readonly lines: readonly string[];
  readonly lineEnding: '\n' | '\r\n' | '\r';
  readonly hasFinalNewline: boolean;
} {
  const lineEnding = sourceText.includes('\r\n')
    ? '\r\n'
    : sourceText.includes('\n')
      ? '\n'
      : sourceText.includes('\r')
        ? '\r'
        : '\n';
  const hasFinalNewline = /(?:\r\n|\n|\r)$/u.test(sourceText);
  const splitLines = sourceText.split(/\r\n|\n|\r/u);
  const lines = hasFinalNewline ? splitLines.slice(0, -1) : splitLines;
  return { lines, lineEnding, hasFinalNewline };
}

function isUncommittedCommit(commit: string): boolean {
  return /^0+$/u.test(commit);
}

function invalidCopyRequest(): never {
  throw new Error('The requested Reader copy target is invalid.');
}

function isReaderLine(value: unknown): value is GitBlameReaderLine {
  return (
    isRecord(value) &&
    Number.isInteger(value.line) &&
    typeof value.text === 'string' &&
    (value.kind === 'committed' || value.kind === 'uncommitted') &&
    isRecord(value.blame)
  );
}

// eslint-disable-next-line complexity
function isReaderBlock(value: unknown): value is GitBlameReaderBlock {
  return (
    isRecord(value) &&
    typeof value.blockId === 'string' &&
    Number.isInteger(value.startLine) &&
    Number.isInteger(value.endLine) &&
    typeof value.commit === 'string' &&
    (value.kind === 'committed' || value.kind === 'uncommitted') &&
    typeof value.author === 'string' &&
    typeof value.email === 'string' &&
    Number.isInteger(value.authoredAt) &&
    typeof value.summary === 'string' &&
    Array.isArray(value.lines) &&
    value.lines.every(isReaderLine)
  );
}

function isResource(value: unknown): value is ExecutableGitResource {
  return (
    isRecord(value) &&
    typeof value.repositoryRoot === 'string' &&
    typeof value.relativePath === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
