// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createWindowTransport,
  type MessageListener,
  WebviewMessageClient,
  type WebviewTransport,
} from './webview-message-client';

class FakeTransport implements WebviewTransport {
  public readonly posted: unknown[] = [];
  readonly #listeners = new Set<MessageListener>();

  public postMessage(message: unknown): void {
    this.posted.push(message);
  }

  public addMessageListener(listener: MessageListener): void {
    this.#listeners.add(listener);
  }

  public removeMessageListener(listener: MessageListener): void {
    this.#listeners.delete(listener);
  }

  public emit(message: unknown): void {
    for (const listener of this.#listeners) {
      listener({ data: message });
    }
  }
}

const clients: WebviewMessageClient[] = [];
afterEach(() => {
  for (const client of clients) {
    client.dispose();
  }
  clients.length = 0;
  vi.useRealTimers();
});

function createClient(
  transport: FakeTransport,
  timeoutMs = 1000,
): WebviewMessageClient {
  const client = new WebviewMessageClient(transport, {
    requestTimeoutMs: timeoutMs,
  });
  clients.push(client);
  return client;
}

describe('WebviewMessageClient', () => {
  it('correlates concurrent responses by requestId', async () => {
    const transport = new FakeTransport();
    const client = createClient(transport);
    const first = client.execute('system.getRuntimeInfo', {});
    const second = client.execute('system.getRuntimeInfo', {});
    const firstRequestId = readRequestId(transport.posted[0]);
    const secondRequestId = readRequestId(transport.posted[1]);

    transport.emit({
      type: 'tool.result',
      requestId: secondRequestId,
      result: {
        ok: false,
        error: { code: 'timeout', message: 'second', retryable: true },
      },
    });
    transport.emit({
      type: 'tool.result',
      requestId: firstRequestId,
      result: {
        ok: false,
        error: { code: 'timeout', message: 'first', retryable: true },
      },
    });

    await expect(first).resolves.toMatchObject({ error: { message: 'first' } });
    await expect(second).resolves.toMatchObject({ error: { message: 'second' } });
  });

  it('rejects requests after the timeout', async () => {
    vi.useFakeTimers();
    const transport = new FakeTransport();
    const client = createClient(transport, 50);
    const request = client.execute('system.getRuntimeInfo', {});
    const assertion = expect(request).rejects.toThrow('timed out');

    await vi.advanceTimersByTimeAsync(51);

    await assertion;
  });

  it('rejects pending requests when disposed', async () => {
    const transport = new FakeTransport();
    const client = createClient(transport);
    const request = client.execute('system.getRuntimeInfo', {});

    client.dispose();

    await expect(request).rejects.toThrow('disposed');
  });

  it('cancels an in-flight request through the transport', async () => {
    const transport = new FakeTransport();
    const client = createClient(transport);
    const controller = new AbortController();
    const request = client.execute('system.getRuntimeInfo', {}, controller.signal);
    const requestId = readRequestId(transport.posted[0]);

    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(transport.posted.at(-1)).toEqual({
      type: 'tool.cancel',
      requestId,
    });
  });

  it('rejects new requests after disposal', async () => {
    const transport = new FakeTransport();
    const client = createClient(transport);
    client.dispose();

    await expect(client.execute('system.getRuntimeInfo', {})).rejects.toThrow(
      'disposed',
    );
  });

  it('adapts browser window messages to the transport interface', () => {
    const postMessage = vi.fn();
    const transport = createWindowTransport({ postMessage });
    const listener = vi.fn<MessageListener>();
    transport.addMessageListener(listener);

    transport.postMessage({ type: 'example' });
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'response' },
      }),
    );
    transport.removeMessageListener(listener);
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'ignored' },
      }),
    );

    expect(postMessage).toHaveBeenCalledWith({ type: 'example' });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ data: { type: 'response' } }),
    );
  });

  it('ignores invalid and stale messages', () => {
    const transport = new FakeTransport();
    const onInvalidMessage = vi.fn();
    const client = new WebviewMessageClient(transport, {
      requestTimeoutMs: 1000,
      onInvalidMessage,
    });
    clients.push(client);
    transport.emit({ unexpected: true });
    transport.emit({
      type: 'tool.result',
      requestId: 'stale',
      result: { ok: true, data: {} },
    });

    expect(onInvalidMessage).toHaveBeenCalledOnce();
  });
});

function readRequestId(value: unknown): string {
  if (typeof value !== 'object' || value === null || !('requestId' in value)) {
    throw new Error('Expected a Webview request message.');
  }
  const requestId = value.requestId;
  if (typeof requestId !== 'string') {
    throw new Error('Expected a string requestId.');
  }
  return requestId;
}
