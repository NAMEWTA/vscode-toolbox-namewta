import type { GitBlameLine } from './git-blame-model';

const UNCOMMITTED_HASH = '0'.repeat(40);

export type GitBlameLineChange = {
  readonly startLine: number;
  readonly endLine: number;
  readonly startCharacter: number;
  readonly endCharacter: number;
  readonly insertedLineBreakCount: number;
  readonly insertedTextLength: number;
  readonly insertedTextEndsWithLineBreak: boolean;
};

export function mapGitBlameLines(
  previousLines: readonly GitBlameLine[],
  changes: readonly GitBlameLineChange[],
  currentLineCount: number,
): readonly GitBlameLine[] {
  if (!isValidLineCount(currentLineCount) || !areChangesValid(changes)) {
    return uncommittedLines(Math.max(0, currentLineCount));
  }
  const sortedChanges = [...changes].sort(
    (left, right) => right.startLine - left.startLine || right.endLine - left.endLine,
  );
  if (hasOverlappingChanges(sortedChanges)) {
    return uncommittedLines(currentLineCount);
  }

  const mapped = [...previousLines];
  for (const change of sortedChanges) {
    const replacement = replacementShape(change);
    if (
      change.startLine > mapped.length ||
      change.startLine + replacement.removedLineCount > mapped.length
    ) {
      return uncommittedLines(currentLineCount);
    }
    mapped.splice(
      change.startLine,
      replacement.removedLineCount,
      ...uncommittedLines(replacement.insertedLineCount),
    );
  }
  if (mapped.length !== currentLineCount) {
    return uncommittedLines(currentLineCount);
  }
  return mapped.map((line, index) => ({ ...line, line: index + 1 }));
}

export function isUncommittedBlameLine(line: GitBlameLine): boolean {
  return line.commit === UNCOMMITTED_HASH;
}

function replacementShape(change: GitBlameLineChange): {
  readonly removedLineCount: number;
  readonly insertedLineCount: number;
} {
  const isCompleteLineBoundary =
    change.startCharacter === 0 &&
    change.endCharacter === 0 &&
    (change.insertedTextLength === 0 || change.insertedTextEndsWithLineBreak);
  return isCompleteLineBoundary
    ? {
        removedLineCount: change.endLine - change.startLine,
        insertedLineCount: change.insertedLineBreakCount,
      }
    : {
        removedLineCount: change.endLine - change.startLine + 1,
        insertedLineCount: change.insertedLineBreakCount + 1,
      };
}

function areChangesValid(changes: readonly GitBlameLineChange[]): boolean {
  return changes.every(
    (change) =>
      isNonNegativeInteger(change.startLine) &&
      isNonNegativeInteger(change.endLine) &&
      change.startLine <= change.endLine &&
      isNonNegativeInteger(change.startCharacter) &&
      isNonNegativeInteger(change.endCharacter) &&
      isNonNegativeInteger(change.insertedLineBreakCount) &&
      isNonNegativeInteger(change.insertedTextLength) &&
      (!change.insertedTextEndsWithLineBreak || change.insertedTextLength > 0),
  );
}

function hasOverlappingChanges(changes: readonly GitBlameLineChange[]): boolean {
  return changes.some((change, index) => {
    const higherChange = changes[index - 1];
    return higherChange !== undefined && change.endLine > higherChange.startLine;
  });
}

function uncommittedLines(count: number): GitBlameLine[] {
  return Array.from({ length: count }, (_, index) => ({
    line: index + 1,
    commit: UNCOMMITTED_HASH,
    author: '',
    email: '',
    authoredAt: 0,
    summary: '',
  }));
}

function isValidLineCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
