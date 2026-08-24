import type { ToolResult } from './tool-result-contract';
import {
  isGitBlameReaderModel,
  type GitBlameReaderModel,
} from '../domains/git-blame/git-blame-reader-model';

export type GitBlameReaderWebviewAction =
  | {
      readonly type: 'gitBlameReader.openSource';
      readonly generation: number;
      readonly line: number;
    }
  | { readonly type: 'gitBlameReader.refresh'; readonly generation: number }
  | {
      readonly type: 'gitBlameReader.copy';
      readonly generation: number;
      readonly format: string;
      readonly line?: number;
      readonly blockId?: string;
    }
  | {
      readonly type: 'gitBlameReader.commitAction';
      readonly generation: number;
      readonly blockId: string;
      readonly action: 'open-remote' | 'open-previous';
    };

export type WebviewToExtensionMessage =
  | {
      readonly type: 'tool.execute';
      readonly requestId: string;
      readonly command: string;
      readonly input: unknown;
    }
  | {
      readonly type: 'tool.cancel';
      readonly requestId: string;
    }
  | GitBlameReaderWebviewAction;

export type ExtensionToWebviewMessage =
  | {
      readonly type: 'tool.result';
      readonly requestId: string;
      readonly result: ToolResult<unknown>;
    }
  | {
      readonly type: 'tool.event';
      readonly event: ToolEvent;
    }
  | {
      readonly type: 'gitBlameReader.model';
      readonly model: GitBlameReaderModel;
    }
  | {
      readonly type: 'gitBlameReader.state';
      readonly state:
        | 'loading'
        | 'ready'
        | 'stale'
        | 'failed'
        | 'unavailable'
        | 'disposed';
      readonly generation: number;
      readonly message?: string;
    };

export type ToolEvent = {
  readonly type: 'capabilities.changed';
};

export function isWebviewToExtensionMessage(
  value: unknown,
): value is WebviewToExtensionMessage {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.type === 'gitBlameReader.openSource' ||
    value.type === 'gitBlameReader.refresh' ||
    value.type === 'gitBlameReader.copy' ||
    value.type === 'gitBlameReader.commitAction'
  ) {
    return isGitBlameReaderAction(value);
  }
  if (!isRequestId(value.requestId)) {
    return false;
  }

  if (value.type === 'tool.cancel') {
    return true;
  }

  return (
    value.type === 'tool.execute' &&
    typeof value.command === 'string' &&
    'input' in value
  );
}

export function isExtensionToWebviewMessage(
  value: unknown,
): value is ExtensionToWebviewMessage {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }

  if (value.type === 'tool.result') {
    return isRequestId(value.requestId) && isToolResult(value.result);
  }

  if (value.type === 'gitBlameReader.model') return isGitBlameReaderModel(value.model);
  if (value.type === 'gitBlameReader.state') return isGitBlameReaderState(value);

  return (
    value.type === 'tool.event' &&
    isRecord(value.event) &&
    value.event.type === 'capabilities.changed'
  );
}

function isGitBlameReaderState(value: Record<string, unknown>): boolean {
  return (
    isGeneration(value.generation) &&
    typeof value.state === 'string' &&
    GIT_BLAME_READER_STATES.has(value.state) &&
    (value.message === undefined || typeof value.message === 'string')
  );
}

const GIT_BLAME_READER_STATES = new Set([
  'loading',
  'ready',
  'stale',
  'failed',
  'unavailable',
  'disposed',
]);

// eslint-disable-next-line complexity
function isGitBlameReaderAction(value: Record<string, unknown>): boolean {
  if (!isGeneration(value.generation)) return false;
  if (value.type === 'gitBlameReader.openSource') {
    return (
      Object.keys(value).every(
        (key) => key === 'type' || key === 'generation' || key === 'line',
      ) && isPositiveLine(value.line)
    );
  }
  if (value.type === 'gitBlameReader.refresh') return Object.keys(value).length === 2;
  if (value.type === 'gitBlameReader.commitAction') {
    return (
      Object.keys(value).every(
        (key) =>
          key === 'type' ||
          key === 'generation' ||
          key === 'blockId' ||
          key === 'action',
      ) &&
      typeof value.blockId === 'string' &&
      value.blockId.length > 0 &&
      value.blockId.length <= 256 &&
      !value.blockId.includes('\0') &&
      (value.action === 'open-remote' || value.action === 'open-previous')
    );
  }
  return (
    Object.keys(value).every(
      (key) =>
        key === 'type' ||
        key === 'generation' ||
        key === 'format' ||
        key === 'line' ||
        key === 'blockId',
    ) &&
    typeof value.format === 'string' &&
    [
      'code',
      'line-with-blame',
      'commit-sha',
      'commit-info',
      'block-code',
      'block-with-blame',
      'all-code',
      'all-with-blame',
    ].includes(value.format) &&
    (value.line === undefined || isPositiveLine(value.line)) &&
    (value.blockId === undefined ||
      (typeof value.blockId === 'string' &&
        value.blockId.length > 0 &&
        value.blockId.length <= 256 &&
        !value.blockId.includes('\0')))
  );
}

function isGeneration(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 2_000_000_000;
}

function isPositiveLine(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 10_000_000;
}

function isToolResult(value: unknown): value is ToolResult<unknown> {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false;
  }

  if (value.ok) {
    return 'data' in value;
  }

  return (
    isRecord(value.error) &&
    isToolErrorCode(value.error.code) &&
    typeof value.error.message === 'string' &&
    typeof value.error.retryable === 'boolean' &&
    (value.error.details === undefined || isRecord(value.error.details))
  );
}

function isToolErrorCode(value: unknown): boolean {
  return (
    value === 'invalid-input' ||
    value === 'capability-unavailable' ||
    value === 'not-found' ||
    value === 'permission-denied' ||
    value === 'cancelled' ||
    value === 'timeout' ||
    value === 'internal-error'
  );
}

function isRequestId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
