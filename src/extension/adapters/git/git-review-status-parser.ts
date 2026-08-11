import type {
  GitReviewChange,
  GitReviewPresentation,
} from '../../../core/domains/git-review/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';
import { isGitReviewRepositoryPath } from './git-review-repository-path';

export type GitReviewStatusEntry = {
  readonly itemId: string;
  readonly layer: 'conflict' | 'staged' | 'unstaged';
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
  const itemIds = new Set<string>();
  for (let index = 0; index < records.length; index += 1) {
    const record = requiredRecord(records[index]);
    if (record.startsWith('1 ')) {
      appendEntries(entries, itemIds, parseOrdinaryRecord(record));
      continue;
    }
    if (record.startsWith('2 ')) {
      const previousPath = requiredPath(records[index + 1]);
      index += 1;
      appendEntries(entries, itemIds, parseRenameRecord(record, previousPath));
      continue;
    }
    if (record.startsWith('u ')) {
      appendEntry(entries, itemIds, parseUnmergedRecord(record));
      continue;
    }
    if (record.startsWith('? ')) {
      appendEntry(entries, itemIds, parseUntrackedRecord(record));
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

function parseOrdinaryRecord(record: string): readonly GitReviewStatusEntry[] {
  const fields = parseRecordFields(record, '1');
  const [xy, submodule] = fields;
  const path = requiredPath(fields.at(-1));
  return createTrackedEntries(path, undefined, xy, submodule, record);
}

function parseRenameRecord(
  record: string,
  previousPath: string,
): readonly GitReviewStatusEntry[] {
  const fields = parseRecordFields(record, '2');
  const [xy, submodule, , , , , , score] = fields;
  const path = requiredPath(fields.at(-1));
  if (!isStatusPair(xy) || !isSubmoduleField(submodule) || !isRenameScore(score)) {
    throw invalidStatus();
  }
  return createTrackedEntries(
    path,
    previousPath,
    xy,
    submodule,
    `${record}\0${previousPath}`,
  );
}

function parseUntrackedRecord(record: string): GitReviewStatusEntry {
  const path = requiredPath(record.slice(2));
  return {
    itemId: `unstaged:${path}`,
    layer: 'unstaged',
    path,
    change: 'untracked',
    presentation: 'text',
    identityMaterial: record,
  };
}

function createTrackedEntries(
  path: string,
  previousPath: string | undefined,
  xy: string | undefined,
  submodule: string | undefined,
  record: string,
): readonly GitReviewStatusEntry[] {
  if (!isStatusPair(xy) || !isSubmoduleField(submodule)) {
    throw invalidStatus();
  }
  const entries: GitReviewStatusEntry[] = [];
  const [indexStatus, worktreeStatus] = xy;
  if (indexStatus !== '.') {
    entries.push(
      createTrackedEntry(
        'staged',
        path,
        indexStatus,
        indexStatus === 'R' || indexStatus === 'C' ? previousPath : undefined,
        submodule,
        record,
      ),
    );
  }
  if (worktreeStatus !== '.') {
    entries.push(
      createTrackedEntry(
        'unstaged',
        path,
        worktreeStatus,
        worktreeStatus === 'R' || worktreeStatus === 'C' ? previousPath : undefined,
        submodule,
        record,
      ),
    );
  }
  return entries;
}

function createTrackedEntry(
  layer: 'staged' | 'unstaged',
  path: string,
  status: string | undefined,
  previousPath: string | undefined,
  submodule: string,
  record: string,
): GitReviewStatusEntry {
  if (status === undefined) {
    throw invalidStatus();
  }
  return {
    itemId: `${layer}:${path}`,
    layer,
    path,
    ...(previousPath === undefined ? {} : { previousPath }),
    change: toTrackedChange(status),
    presentation: toPresentation(submodule),
    identityMaterial: `${layer}\0${record}`,
  };
}

function parseUnmergedRecord(record: string): GitReviewStatusEntry {
  const match =
    /^u ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) (.*)$/su.exec(
      record,
    );
  if (match === null) {
    throw invalidStatus();
  }
  const fields = match.slice(1);
  const [xy, submodule] = fields;
  const modes = fields.slice(2, 6);
  const hashes = fields.slice(6, 9);
  const path = requiredPath(fields.at(-1));
  if (
    !isStatusPair(xy) ||
    !xy.includes('U') ||
    !isSubmoduleField(submodule) ||
    !modes.every(isMode) ||
    !hashes.every(isObjectHash)
  ) {
    throw invalidStatus();
  }
  return {
    itemId: `conflict:${path}`,
    layer: 'conflict',
    path,
    change: 'conflicted',
    presentation: toPresentation(submodule),
    identityMaterial: `conflict\0${record}`,
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

function appendEntries(
  entries: GitReviewStatusEntry[],
  itemIds: Set<string>,
  candidates: readonly GitReviewStatusEntry[],
): void {
  for (const candidate of candidates) {
    appendEntry(entries, itemIds, candidate);
  }
}

function appendEntry(
  entries: GitReviewStatusEntry[],
  itemIds: Set<string>,
  entry: GitReviewStatusEntry,
): void {
  if (itemIds.has(entry.itemId)) {
    throw invalidStatus();
  }
  itemIds.add(entry.itemId);
  entries.push(entry);
}

function toTrackedChange(status: string): GitReviewChange {
  if (status === 'D') {
    return 'deleted';
  }
  if (status === 'A' || status === 'C') {
    return 'added';
  }
  if (status === 'R') {
    return 'renamed';
  }
  if (status === 'M' || status === 'T') {
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
