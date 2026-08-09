import { sep } from 'node:path';

export function isGitReviewRepositoryPath(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 4_096 ||
    value.includes('\0') ||
    value.startsWith('/') ||
    (sep === '\\' && value.includes('\\'))
  ) {
    return false;
  }
  return value
    .split('/')
    .every(
      (part) =>
        part.length > 0 &&
        part !== '.' &&
        part !== '..' &&
        !isGitReviewMetadataDirectory(part),
    );
}

function isGitReviewMetadataDirectory(part: string): boolean {
  return sep === '\\' ? part.toLowerCase() === '.git' : part === '.git';
}
