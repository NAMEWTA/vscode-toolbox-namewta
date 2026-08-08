import type * as vscode from 'vscode';
import {
  isToolCommandId,
  isToolCommandInput,
  isWebviewToExtensionMessage,
  type ExtensionToWebviewMessage,
  type ToolResult,
} from '../../core/contracts';
import type { ToolboxGateway, ToolLogger } from '../../core/orchestration/public-api';

export class VscodeWebviewMessageAdapter implements vscode.Disposable {
  readonly #disposable: vscode.Disposable;
  readonly #controllers = new Map<string, AbortController>();

  public constructor(
    private readonly webview: vscode.Webview,
    private readonly gateway: ToolboxGateway,
    private readonly logger: ToolLogger,
  ) {
    this.#disposable = webview.onDidReceiveMessage((message: unknown) => {
      void this.handleMessage(message);
    });
  }

  public dispose(): void {
    this.#disposable.dispose();
    for (const controller of this.#controllers.values()) {
      controller.abort();
    }
    this.#controllers.clear();
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isWebviewToExtensionMessage(message)) {
      this.logger.warn('Ignored an invalid Webview message.');
      return;
    }

    if (message.type === 'tool.cancel') {
      this.#controllers.get(message.requestId)?.abort();
      return;
    }

    if (!isToolCommandId(message.command)) {
      await this.postResult(
        message.requestId,
        createFailure('not-found', 'The requested tool command is not available.'),
      );
      return;
    }

    if (!isToolCommandInput(message.command, message.input)) {
      await this.postResult(
        message.requestId,
        createFailure('invalid-input', 'The tool request input is invalid.'),
      );
      return;
    }

    this.#controllers.get(message.requestId)?.abort();
    const controller = new AbortController();
    this.#controllers.set(message.requestId, controller);

    try {
      const result = await this.gateway.execute(message.command, message.input, {
        requestId: message.requestId,
        signal: controller.signal,
        source: 'webview',
      });
      await this.postResult(message.requestId, result);
    } finally {
      if (this.#controllers.get(message.requestId) === controller) {
        this.#controllers.delete(message.requestId);
      }
    }
  }

  private async postResult(
    requestId: string,
    result: ToolResult<unknown>,
  ): Promise<void> {
    const response: ExtensionToWebviewMessage = {
      type: 'tool.result',
      requestId,
      result,
    };
    await this.webview.postMessage(response);
  }
}

function createFailure(
  code: 'not-found' | 'invalid-input',
  message: string,
): ToolResult<never> {
  return {
    ok: false,
    error: { code, message, retryable: false },
  };
}
