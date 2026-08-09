import type {
  GitReviewChange,
  GitReviewPresentation,
} from '../../../core/domains/git-review/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';
import { isGitReviewRepositoryPath } from './git-review-repository-path';

export type GitReviewStatusEntry = {
  readonly path: string;
  readonly previousPath?: string;
  readonly change: GitReviewChange;
  readonly presentation: GitReviewPresentation;
  readonly identityMaterial: string;
};

export function parseGitReviewStatus(output: string): readonly GitReviewStatusEntry[] {
  if (output.length === 0) {
    return [];
  }
  if (!output.endsWith('\0')) {
    throw invalidStatus();
  }

  const records = output.slice(0, -1).split('\0');
  const entries: GitReviewStatusEntry[] = [];
  const paths = new Set<string>();
  for (let index = 0; index < records.length; index += 1) {
    const record = requiredRecord(records[index]);
    if (record.startsWith('1 ')) {
      appendEntry(entries, paths, parseOrdinaryRecord(record));
      continue;
    }
    if (record.startsWith('2 ')) {
      const previousPath = requiredPath(records[index + 1]);
      index += 1;
      appendEntry(entries, paths, parseRenameRecord(record, previousPath));
      continue;
    }
    if (record.startsWith('? ')) {
      appendEntry(entries, paths, parseUntrackedRecord(record));
      continue;
    }
    if (record.startsWith('! ')) {
      requiredPath(record.slice(2));
      continue;
    }
    throw invalidStatus();
  }
  return entries;
}

function parseOrdinaryRecord(record: string): GitReviewStatusEntry {
  const fields = parseRecordFields(record, '1');
  const [xy, submodule] = fields;
  const path = requiredPath(fields.at(-1));
  return createTrackedEntry(path, xy, submodule, record);
}

function parseRenameRecord(record: string, previousPath: string): GitReviewStatusEntry {
  const fields = parseRecordFields(record, '2');
  const [xy, submodule, , , , , , score] = fields;
  const path = requiredPath(fields.at(-1));
  if (!isStatusPair(xy) || !isSubmoduleField(submodule) || !isRenameScore(score)) {
    throw invalidStatus();
  }
  return {
    path,
    previousPath,
    change: score.startsWith('R') ? 'renamed' : 'added',
    presentation: toPresentation(submodule),
    identityMaterial: `${record}\0${previousPath}`,
  };
}

function parseUntrackedRecord(record: string): GitReviewStatusEntry {
  const path = requiredPath(record.slice(2));
  return {
    path,
    change: 'untracked',
    presentation: 'text',
    identityMaterial: record,
  };
}

function createTrackedEntry(
  path: string,
  xy: string | undefined,
  submodule: string | undefined,
  record: string,
): GitReviewStatusEntry {
  if (!isStatusPair(xy) || !isSubmoduleField(submodule)) {
    throw invalidStatus();
  }
  return {
    path,
    change: toTrackedChange(xy),
    presentation: toPresentation(submodule),
    identityMaterial: record,
  };
}

function parseRecordFields(record: string, kind: '1' | '2'): readonly string[] {
  const match = recordPattern(kind).exec(record);
  if (match === null) {
    throw invalidStatus();
  }
  const fields = match.slice(1);
  const hashes = fields.slice(5, 7);
  const modes = fields.slice(2, 5);
  if (!modes.every(isMode) || !hashes.every(isObjectHash)) {
    throw invalidStatus();
  }
  return fields;
}

function recordPattern(kind: '1' | '2'): RegExp {
  return kind === '1'
    ? /^1 ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) (.*)$/su
    : /^2 ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) (.*)$/su;
}

function appendEntry(
  entries: GitReviewStatusEntry[],
  paths: Set<string>,
  entry: GitReviewStatusEntry,
): void {
  if (paths.has(entry.path)) {
    throw invalidStatus();
  }
  paths.add(entry.path);
  entries.push(entry);
}

function toTrackedChange(xy: string): GitReviewChange {
  const [indexStatus, worktreeStatus] = xy;
  if (indexStatus === 'D' || worktreeStatus === 'D') {
    return 'deleted';
  }
  if (indexStatus === 'A' || worktreeStatus === 'A') {
    return 'added';
  }
  if (
    indexStatus === 'M' ||
    worktreeStatus === 'M' ||
    indexStatus === 'T' ||
    worktreeStatus === 'T'
  ) {
    return 'modified';
  }
  throw invalidStatus();
}

function toPresentation(submodule: string): GitReviewPresentation {
  return submodule.startsWith('S') ? 'submodule' : 'text';
}

function requiredRecord(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    throw invalidStatus();
  }
  return value;
}

function requiredPath(value: string | undefined): string {
  if (!isGitReviewRepositoryPath(value)) {
    throw invalidStatus();
  }
  return value;
}

function isStatusPair(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length === 2 &&
    /^[.MADRCUT]{2}$/u.test(value) &&
    value !== '..'
  );
}

function isSubmoduleField(value: unknown): value is string {
  return typeof value === 'string' && /^(?:N\.\.\.|S[.CMU]{3})$/u.test(value);
}

function isMode(value: string): boolean {
  return /^[0-7]{6}$/u.test(value);
}

function isObjectHash(value: string): boolean {
  return /^(?:[a-f\d]{40}|[a-f\d]{64})$/iu.test(value);
}

function isRenameScore(value: string | undefined): value is string {
  return typeof value === 'string' && /^[RC]\d{1,3}$/u.test(value);
}

function invalidStatus(): ApplicationError {
  return new ApplicationError('Git Review status output is invalid.', {
    code: 'internal-error',
  });
}
