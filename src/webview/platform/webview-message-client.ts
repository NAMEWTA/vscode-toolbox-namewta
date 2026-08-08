import {
  isExtensionToWebviewMessage,
  type ExtensionToWebviewMessage,
  type ToolCommandId,
  type ToolCommandInput,
  type ToolCommandOutput,
  type ToolResult,
  type WebviewToExtensionMessage,
} from '../../core/contracts';

export type MessageEventLike = { readonly data: unknown };
export type MessageListener = (event: MessageEventLike) => void;

export type WebviewTransport = {
  postMessage(message: unknown): void;
  addMessageListener(listener: MessageListener): void;
  removeMessageListener(listener: MessageListener): void;
};

export type ToolMessageClient = {
  execute<TCommand extends ToolCommandId>(
    command: TCommand,
    input: ToolCommandInput<TCommand>,
    signal?: AbortSignal,
  ): Promise<ToolResult<ToolCommandOutput<TCommand>>>;
};

export type WebviewMessageClientOptions = {
  readonly requestTimeoutMs: number;
  readonly onInvalidMessage?: (message: unknown) => void;
};

type PendingRequest = {
  readonly resolve: (result: ToolResult<unknown>) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
  readonly abortCleanup: (() => void) | undefined;
};

export class WebviewMessageClient implements ToolMessageClient {
  readonly #pending = new Map<string, PendingRequest>();
  readonly #messageListener: MessageListener;
  #isDisposed = false;

  public constructor(
    private readonly transport: WebviewTransport,
    private readonly options: WebviewMessageClientOptions,
  ) {
    this.#messageListener = (event) => this.handleMessage(event.data);
    transport.addMessageListener(this.#messageListener);
  }

  public execute<TCommand extends ToolCommandId>(
    command: TCommand,
    input: ToolCommandInput<TCommand>,
    signal?: AbortSignal,
  ): Promise<ToolResult<ToolCommandOutput<TCommand>>> {
    if (this.#isDisposed) {
      return Promise.reject(new Error('The Webview message client is disposed.'));
    }

    const requestId = createRequestId();
    const message: WebviewToExtensionMessage = {
      type: 'tool.execute',
      requestId,
      command,
      input,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cancelPending(
          requestId,
          createTimeoutError(this.options.requestTimeoutMs),
        );
      }, this.options.requestTimeoutMs);

      const abortListener = (): void => {
        this.cancelPending(requestId, createAbortError());
      };

      if (signal?.aborted === true) {
        clearTimeout(timeout);
        reject(createAbortError());
        return;
      }

      signal?.addEventListener('abort', abortListener, { once: true });
      this.#pending.set(requestId, {
        resolve: (result) => resolve(result as ToolResult<ToolCommandOutput<TCommand>>),
        reject,
        timeout,
        abortCleanup:
          signal === undefined
            ? undefined
            : () => signal.removeEventListener('abort', abortListener),
      });
      this.transport.postMessage(message);
    });
  }

  public dispose(): void {
    if (this.#isDisposed) {
      return;
    }

    this.#isDisposed = true;
    this.transport.removeMessageListener(this.#messageListener);
    for (const [requestId, pending] of this.#pending) {
      clearTimeout(pending.timeout);
      pending.abortCleanup?.();
      this.transport.postMessage({ type: 'tool.cancel', requestId });
      pending.reject(
        new Error('The Webview was disposed before the request completed.'),
      );
    }
    this.#pending.clear();
  }

  private handleMessage(message: unknown): void {
    if (!isExtensionToWebviewMessage(message)) {
      this.options.onInvalidMessage?.(message);
      return;
    }

    if (message.type === 'tool.result') {
      this.resolvePending(message);
    }
  }

  private resolvePending(
    message: Extract<ExtensionToWebviewMessage, { type: 'tool.result' }>,
  ): void {
    const pending = this.#pending.get(message.requestId);
    if (pending === undefined) {
      return;
    }

    clearTimeout(pending.timeout);
    pending.abortCleanup?.();
    this.#pending.delete(message.requestId);
    pending.resolve(message.result);
  }

  private cancelPending(requestId: string, error: Error): void {
    const pending = this.#pending.get(requestId);
    if (pending === undefined) {
      return;
    }

    clearTimeout(pending.timeout);
    pending.abortCleanup?.();
    this.#pending.delete(requestId);
    this.transport.postMessage({ type: 'tool.cancel', requestId });
    pending.reject(error);
  }
}

export function createWindowTransport(api: {
  postMessage(message: unknown): void;
}): WebviewTransport {
  const browserListeners = new Map<MessageListener, (event: MessageEvent) => void>();

  return {
    postMessage: (message) => api.postMessage(message),
    addMessageListener: (listener) => {
      const browserListener = (event: MessageEvent): void => listener(event);
      browserListeners.set(listener, browserListener);
      window.addEventListener('message', browserListener);
    },
    removeMessageListener: (listener) => {
      const browserListener = browserListeners.get(listener);
      if (browserListener !== undefined) {
        window.removeEventListener('message', browserListener);
        browserListeners.delete(listener);
      }
    },
  };
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `webview-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createAbortError(): Error {
  const error = new Error('The Webview tool request was cancelled.');
  error.name = 'AbortError';
  return error;
}

function createTimeoutError(timeoutMs: number): Error {
  return new Error(`The tool request timed out after ${timeoutMs}ms.`);
}
