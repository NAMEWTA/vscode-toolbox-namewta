import { ApplicationError } from '../../kernel/application-error';
import type { GitCancellationSignal } from './git-blame-port';
import {
  isGitReference,
  isRepositoryRelativePath,
  type ExecutableGitResource,
  type GitLineHistoryEntry,
} from './git-blame-model';

const CURSOR_VERSION = 1;
const CURSOR_MAX_LENGTH = 4_096;
const BASE64URL_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export type GitLineHistoryLocator = {
  readonly ref: string;
  readonly path: string;
  readonly line: number;
};

export type GitLineHistoryStep = {
  readonly entry: GitLineHistoryEntry;
  readonly previous?: GitLineHistoryLocator;
};

export type GitLineHistoryPort = {
  getLineHistoryStep(
    resource: ExecutableGitResource,
    locator: GitLineHistoryLocator,
    signal: GitCancellationSignal,
  ): Promise<GitLineHistoryStep>;
};

export type GitLineHistoryCursorState = {
  readonly resourceHash: string;
  readonly origin: GitLineHistoryLocator;
  readonly current: GitLineHistoryLocator;
  readonly visited: readonly string[];
};

export function encodeGitLineHistoryCursor(state: GitLineHistoryCursorState): string {
  if (!isCursorState(state)) {
    throw cursorError();
  }
  const json = JSON.stringify({ version: CURSOR_VERSION, ...state });
  const payload = encodeBase64Url(toUtf8Bytes(json));
  const cursor = `${payload}.${hashText(payload)}`;
  if (cursor.length > CURSOR_MAX_LENGTH) {
    throw cursorError();
  }
  return cursor;
}

export function decodeGitLineHistoryCursor(cursor: string): GitLineHistoryCursorState {
  const match = /^([A-Za-z\d_-]+)\.([a-f\d]{8})$/u.exec(cursor);
  if (
    match === null ||
    cursor.length > CURSOR_MAX_LENGTH ||
    hashText(match[1] ?? '') !== match[2]
  ) {
    throw cursorError();
  }
  try {
    const payload = match[1] ?? '';
    const json = fromUtf8Bytes(decodeBase64Url(payload));
    if (encodeBase64Url(toUtf8Bytes(json)) !== payload) {
      throw cursorError();
    }
    const parsed: unknown = JSON.parse(json);
    if (!isEncodedCursorState(parsed)) {
      throw cursorError();
    }
    return {
      resourceHash: parsed.resourceHash,
      origin: parsed.origin,
      current: parsed.current,
      visited: parsed.visited,
    };
  } catch (error: unknown) {
    if (error instanceof ApplicationError) {
      throw error;
    }
    throw cursorError(error);
  }
}

export function hashGitLineHistoryLocator(locator: GitLineHistoryLocator): string {
  return hashText(`${locator.ref}\0${locator.path}\0${String(locator.line)}`);
}

export function hashGitLineHistoryResource(resource: ExecutableGitResource): string {
  return hashText(resource.repositoryRoot);
}

function isEncodedCursorState(value: unknown): value is GitLineHistoryCursorState & {
  readonly version: 1;
} {
  return (
    isRecordWithKeys(value, [
      'version',
      'resourceHash',
      'origin',
      'current',
      'visited',
    ]) &&
    value.version === CURSOR_VERSION &&
    isCursorState(value)
  );
}

function isCursorState(value: unknown): value is GitLineHistoryCursorState {
  if (!isRecord(value)) {
    return false;
  }
  const allowedKeys = new Set([
    'version',
    'resourceHash',
    'origin',
    'current',
    'visited',
  ]);
  return (
    Object.keys(value).every((key) => allowedKeys.has(key)) &&
    typeof value.resourceHash === 'string' &&
    /^[a-f\d]{8}$/u.test(value.resourceHash) &&
    isLocator(value.origin) &&
    isLocator(value.current) &&
    Array.isArray(value.visited) &&
    value.visited.length <= 300 &&
    value.visited.every(
      (item): item is string => typeof item === 'string' && /^[a-f\d]{8}$/u.test(item),
    ) &&
    new Set(value.visited).size === value.visited.length
  );
}

function isLocator(value: unknown): value is GitLineHistoryLocator {
  return (
    isRecordWithKeys(value, ['ref', 'path', 'line']) &&
    isGitReference(value.ref) &&
    isRepositoryRelativePath(value.path) &&
    Number.isInteger(value.line) &&
    Number(value.line) > 0
  );
}

function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function toUtf8Bytes(value: string): readonly number[] {
  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] === '%') {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(encoded.charCodeAt(index));
    }
  }
  return bytes;
}

function fromUtf8Bytes(bytes: readonly number[]): string {
  return decodeURIComponent(
    bytes.map((byte) => `%${byte.toString(16).padStart(2, '0')}`).join(''),
  );
}

function encodeBase64Url(bytes: readonly number[]): string {
  let result = '';
  let buffer = 0;
  let bitCount = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitCount += 8;
    while (bitCount >= 6) {
      bitCount -= 6;
      result += BASE64URL_ALPHABET[(buffer >>> bitCount) & 63] ?? '';
    }
  }
  if (bitCount > 0) {
    result += BASE64URL_ALPHABET[(buffer << (6 - bitCount)) & 63] ?? '';
  }
  return result;
}

function decodeBase64Url(value: string): readonly number[] {
  const bytes: number[] = [];
  let buffer = 0;
  let bitCount = 0;
  for (const character of value) {
    const digit = BASE64URL_ALPHABET.indexOf(character);
    if (digit < 0) {
      throw cursorError();
    }
    buffer = (buffer << 6) | digit;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((buffer >>> bitCount) & 255);
    }
  }
  return bytes;
}

function isRecordWithKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => key in value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cursorError(cause?: unknown): ApplicationError {
  return new ApplicationError('Git line history cursor is invalid.', {
    code: 'invalid-input',
    ...(cause === undefined ? {} : { cause }),
  });
}
