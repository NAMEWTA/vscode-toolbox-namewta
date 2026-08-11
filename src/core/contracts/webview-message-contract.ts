import type { ToolResult } from './tool-result-contract';
import { type GitReviewSessionSnapshot } from '../domains/git-review/git-review-model';
import { isGitReviewSessionSnapshot } from '../domains/git-review/git-review-session-snapshot-contract';

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
  | GitReviewWebviewAction;

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

  if (value.type === 'gitReview.action') {
    return isGitReviewWebviewAction(value);
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

  if (value.type === 'gitReview.snapshot') {
    return isGitReviewSessionSnapshot(value.snapshot);
  }
  if (value.type === 'gitReview.focus') {
    return isItemId(value.itemId);
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
