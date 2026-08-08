import type { ToolResult } from './tool-result-contract';

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
    };

export type ExtensionToWebviewMessage =
  | {
      readonly type: 'tool.result';
      readonly requestId: string;
      readonly result: ToolResult<unknown>;
    }
  | {
      readonly type: 'tool.event';
      readonly event: ToolEvent;
    };

export type ToolEvent = {
  readonly type: 'capabilities.changed';
};

export function isWebviewToExtensionMessage(
  value: unknown,
): value is WebviewToExtensionMessage {
  if (!isRecord(value) || !isRequestId(value.requestId)) {
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

  return (
    value.type === 'tool.event' &&
    isRecord(value.event) &&
    value.event.type === 'capabilities.changed'
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
