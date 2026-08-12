import type { ToolResult } from './tool-result-contract';
import { type GitReviewSessionSnapshot } from '../domains/git-review/git-review-model';
import { isGitReviewSessionSnapshot } from '../domains/git-review/git-review-session-snapshot-contract';
import {
  isGitBlameReaderModel,
  type GitBlameReaderModel,
} from '../domains/git-blame/git-blame-reader-model';

export type GitReviewWebviewAction = {
  readonly type: 'gitReview.action';
  readonly action:
    | 'open-file'
    | 'open-diff'
    | 'copy-reference'
    | 'merge-changes'
    | 'mark-reviewed'
    | 'skip';
  readonly itemId: string;
  readonly contentIdentity: string;
  readonly line?: number;
};

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
      readonly type: 'gitBlameReader.commitDetail';
      readonly generation: number;
      readonly blockId: string;
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
  | GitReviewWebviewAction
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
      readonly type: 'gitReview.snapshot';
      readonly snapshot: GitReviewSessionSnapshot;
    }
  | {
      readonly type: 'gitReview.focus';
      readonly itemId: string;
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

// eslint-disable-next-line complexity
export function isWebviewToExtensionMessage(
  value: unknown,
): value is WebviewToExtensionMessage {
  if (!isRecord(value)) {
    return false;
  }

  if (value.type === 'gitReview.action') {
    return isGitReviewWebviewAction(value);
  }
  if (
    value.type === 'gitBlameReader.openSource' ||
    value.type === 'gitBlameReader.refresh' ||
    value.type === 'gitBlameReader.copy' ||
    value.type === 'gitBlameReader.commitDetail'
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

// eslint-disable-next-line complexity
export function isExtensionToWebviewMessage(
  value: unknown,
): value is ExtensionToWebviewMessage {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }

  if (value.type === 'tool.result') {
    return isRequestId(value.requestId) && isToolResult(value.result);
  }

  if (value.type === 'gitReview.snapshot') {
    return isGitReviewSessionSnapshot(value.snapshot);
  }
  if (value.type === 'gitReview.focus') {
    return isItemId(value.itemId);
  }
  if (value.type === 'gitBlameReader.model') return isGitBlameReaderModel(value.model);
  if (value.type === 'gitBlameReader.state') {
    return (
      isGeneration(value.generation) &&
      (value.state === 'loading' ||
        value.state === 'ready' ||
        value.state === 'stale' ||
        value.state === 'failed' ||
        value.state === 'unavailable' ||
        value.state === 'disposed') &&
      (value.message === undefined || typeof value.message === 'string')
    );
  }

  return (
    value.type === 'tool.event' &&
    isRecord(value.event) &&
    value.event.type === 'capabilities.changed'
  );
}

function isGitReviewWebviewAction(value: Record<string, unknown>): boolean {
  return (
    GIT_REVIEW_ACTIONS.has(String(value.action)) &&
    isItemId(value.itemId) &&
    typeof value.contentIdentity === 'string' &&
    value.contentIdentity.length > 0 &&
    value.contentIdentity.length <= 512 &&
    (value.line === undefined ||
      (Number.isInteger(value.line) &&
        typeof value.line === 'number' &&
        value.line >= 1 &&
        value.line <= 10_000_000))
  );
}

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
  if (value.type === 'gitBlameReader.commitDetail') {
    return (
      Object.keys(value).every(
        (key) => key === 'type' || key === 'generation' || key === 'blockId',
      ) &&
      typeof value.blockId === 'string' &&
      value.blockId.length > 0 &&
      value.blockId.length <= 256 &&
      !value.blockId.includes('\0')
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

const GIT_REVIEW_ACTIONS = new Set([
  'open-file',
  'open-diff',
  'copy-reference',
  'merge-changes',
  'mark-reviewed',
  'skip',
]);

function isItemId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 4_128 &&
    !value.includes('\0')
  );
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
