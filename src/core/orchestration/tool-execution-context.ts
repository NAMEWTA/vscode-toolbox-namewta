export type ToolExecutionSource = 'extension-command' | 'extension-api' | 'webview';

export type CancellationSignal = {
  readonly aborted: boolean;
};

export type ToolLogger = {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(
    message: string,
    error?: unknown,
    context?: Readonly<Record<string, unknown>>,
  ): void;
};

export type ToolExecutionContext = {
  readonly signal: CancellationSignal;
  readonly requestId: string;
  readonly source: ToolExecutionSource;
  readonly logger: ToolLogger;
};
