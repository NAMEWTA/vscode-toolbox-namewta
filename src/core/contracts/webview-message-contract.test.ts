import { describe, expect, it } from 'vitest';
import {
  isExtensionToWebviewMessage,
  isWebviewToExtensionMessage,
} from './webview-message-contract';

describe('Webview message contract', () => {
  it('validates execute and cancellation requests', () => {
    expect(
      isWebviewToExtensionMessage({
        type: 'tool.execute',
        requestId: 'request-1',
        command: 'system.getRuntimeInfo',
        input: {},
      }),
    ).toBe(true);
    expect(
      isWebviewToExtensionMessage({
        type: 'tool.cancel',
        requestId: 'request-1',
      }),
    ).toBe(true);
    expect(
      isWebviewToExtensionMessage({
        type: 'tool.cancel',
        requestId: '',
      }),
    ).toBe(false);
    expect(isWebviewToExtensionMessage('invalid')).toBe(false);
    expect(
      isWebviewToExtensionMessage({
        type: 'gitReview.action',
        action: 'copy-reference',
        itemId: 'unstaged:src/main.ts',
        contentIdentity: 'a'.repeat(64),
        line: 12,
      }),
    ).toBe(true);
    expect(
      isWebviewToExtensionMessage({
        type: 'gitReview.action',
        action: 'discard-without-confirmation',
        itemId: 'unstaged:src/main.ts',
        contentIdentity: 'a'.repeat(64),
      }),
    ).toBe(false);
  });

  it('validates results and capability events', () => {
    expect(
      isExtensionToWebviewMessage({
        type: 'tool.result',
        requestId: 'request-1',
        result: { ok: true, data: {} },
      }),
    ).toBe(true);
    expect(
      isExtensionToWebviewMessage({
        type: 'tool.result',
        requestId: 'request-1',
        result: {
          ok: false,
          error: {
            code: 'timeout',
            message: 'Timed out.',
            retryable: true,
          },
        },
      }),
    ).toBe(true);
    expect(
      isExtensionToWebviewMessage({
        type: 'tool.event',
        event: { type: 'capabilities.changed' },
      }),
    ).toBe(true);
    expect(
      isExtensionToWebviewMessage({
        type: 'tool.result',
        requestId: 'request-1',
        result: { ok: false, error: { message: 'Incomplete' } },
      }),
    ).toBe(false);
  });
});
