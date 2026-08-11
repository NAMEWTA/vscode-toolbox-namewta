import parseDiff from 'parse-diff';
import type {
  GitReviewDiffLine,
  GitReviewItemPatch,
} from '../../../core/domains/git-review/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';

export function parseGitReviewPatch(output: string): GitReviewItemPatch {
  const files = parseDiff(output);
  if (files.length === 0) {
    return { kind: 'patch', additions: 0, deletions: 0, hunks: [] };
  }
  if (files.length !== 1) {
    throw invalidPatch();
  }
  const [file] = files;
  if (file === undefined) {
    throw invalidPatch();
  }
  return {
    kind: 'patch',
    additions: file.additions,
    deletions: file.deletions,
    hunks: file.chunks.map((chunk) => ({
      header: chunk.content,
      oldStart: chunk.oldStart,
      oldLines: chunk.oldLines,
      newStart: chunk.newStart,
      newLines: chunk.newLines,
      lines: chunk.changes.map(toDiffLine),
    })),
  };
}

export function createUntrackedGitReviewPatch(content: string): GitReviewItemPatch {
  const lines = content.length === 0 ? [] : content.split('\n');
  if (lines.at(-1) === '') {
    lines.pop();
  }
  if (lines.length === 0) {
    return { kind: 'patch', additions: 0, deletions: 0, hunks: [] };
  }
  return {
    kind: 'patch',
    additions: lines.length,
    deletions: 0,
    hunks: [
      {
        header: `@@ -0,0 +1,${lines.length} @@`,
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: lines.length,
        lines: lines.map((text, index) => ({
          kind: 'addition' as const,
          newLine: index + 1,
          text,
        })),
      },
    ],
  };
}

function toDiffLine(change: parseDiff.Change): GitReviewDiffLine {
  const text = change.content.slice(1);
  switch (change.type) {
    case 'normal':
      return {
        kind: 'context',
        oldLine: change.ln1,
        newLine: change.ln2,
        text,
      };
    case 'add':
      return { kind: 'addition', newLine: change.ln, text };
    case 'del':
      return { kind: 'deletion', oldLine: change.ln, text };
  }
}

function invalidPatch(): ApplicationError {
  return new ApplicationError('Git Review patch output is invalid.', {
    code: 'internal-error',
  });
}
