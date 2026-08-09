import { ApplicationError } from '../../../core/kernel/application-error';
import { isGitReviewRepositoryPath } from './git-review-repository-path';

export function parseGitReviewBinaryNumstat(output: string): ReadonlySet<string> {
  if (output.length === 0) {
    return new Set();
  }
  if (!output.endsWith('\0')) {
    throw invalidNumstat();
  }

  const records = output.slice(0, -1).split('\0');
  const binaryPaths = new Set<string>();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const row = parseNumstatRow(record);
    const paths =
      row.path.length === 0 ? [records[index + 1], records[index + 2]] : [row.path];
    if (row.path.length === 0) {
      index += 2;
    }
    for (const candidate of paths) {
      const path = requiredPath(candidate);
      if (row.isBinary) {
        binaryPaths.add(path);
      }
    }
  }
  return binaryPaths;
}

type GitReviewNumstatRow = {
  readonly path: string;
  readonly isBinary: boolean;
};

function parseNumstatRow(record: string | undefined): GitReviewNumstatRow {
  const match = /^(\d+|-)\t(\d+|-)\t(.*)$/su.exec(record ?? '');
  if (match === null) {
    throw invalidNumstat();
  }
  const added = match[1];
  const deleted = match[2];
  const path = match[3];
  if (added === undefined || deleted === undefined || path === undefined) {
    throw invalidNumstat();
  }
  if ((added === '-') !== (deleted === '-')) {
    throw invalidNumstat();
  }
  return { path, isBinary: added === '-' && deleted === '-' };
}

function requiredPath(value: string | undefined): string {
  if (!isGitReviewRepositoryPath(value)) {
    throw invalidNumstat();
  }
  return value;
}

function invalidNumstat(): ApplicationError {
  return new ApplicationError('Git Review numstat output is invalid.', {
    code: 'internal-error',
  });
}
