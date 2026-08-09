import { lstat, readFile, readlink } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { ApplicationError } from '../../../core/kernel/application-error';

const MAX_GIT_REVIEW_FILE_BYTES = 64 * 1_024 * 1_024;
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

export async function readGitReviewWorkingContent(
  repositoryRoot: string,
  relativePath: string,
): Promise<Buffer> {
  const filePath = resolveGitReviewFilePath(repositoryRoot, relativePath);
  try {
    const stats = await lstat(filePath);
    if (stats.isSymbolicLink()) {
      return readGitReviewSymbolicLink(filePath);
    }
    if (!stats.isFile() || stats.size > MAX_GIT_REVIEW_FILE_BYTES) {
      throw unavailableContent();
    }
    return await readFile(filePath);
  } catch (error: unknown) {
    if (error instanceof ApplicationError) {
      throw error;
    }
    throw unavailableContent(error);
  }
}

export async function tryReadGitReviewWorkingContent(
  repositoryRoot: string,
  relativePath: string,
): Promise<Buffer | undefined> {
  try {
    return await readGitReviewWorkingContent(repositoryRoot, relativePath);
  } catch (error: unknown) {
    if (isGitReviewContentUnavailable(error)) {
      return undefined;
    }
    throw error;
  }
}

export function isGitReviewContentUnavailable(error: unknown): boolean {
  return error instanceof ApplicationError && error.code === 'capability-unavailable';
}

export function decodeGitReviewText(content: Buffer): string | undefined {
  if (content.includes(0)) {
    return undefined;
  }
  try {
    return UTF8_DECODER.decode(content);
  } catch {
    return undefined;
  }
}

async function readGitReviewSymbolicLink(filePath: string): Promise<Buffer> {
  const target = await readlink(filePath, 'utf8');
  const content = Buffer.from(target, 'utf8');
  if (content.byteLength > MAX_GIT_REVIEW_FILE_BYTES) {
    throw unavailableContent();
  }
  return content;
}

function resolveGitReviewFilePath(
  repositoryRoot: string,
  relativePath: string,
): string {
  const root = path.resolve(repositoryRoot);
  const target = path.resolve(root, ...relativePath.split('/'));
  const nestedPath = path.relative(root, target);
  if (
    nestedPath.length === 0 ||
    nestedPath === '..' ||
    nestedPath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(nestedPath)
  ) {
    throw unavailableContent();
  }
  return target;
}

function unavailableContent(cause?: unknown): ApplicationError {
  return new ApplicationError('Git Review content is unavailable.', {
    code: 'capability-unavailable',
    ...(cause === undefined ? {} : { cause }),
  });
}
