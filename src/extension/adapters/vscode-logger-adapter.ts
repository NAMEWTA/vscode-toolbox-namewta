import * as vscode from 'vscode';
import type { ToolLogger } from '../../core/orchestration/public-api';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_WEIGHT: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class VscodeLoggerAdapter implements ToolLogger, vscode.Disposable {
  readonly #channel: vscode.OutputChannel;

  public constructor(private readonly configurationSection: string) {
    this.#channel = vscode.window.createOutputChannel('vscode-toolbox-namewta');
  }

  public debug(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.write('debug', message, context);
  }

  public info(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.write('info', message, context);
  }

  public warn(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.write('warn', message, context);
  }

  public error(
    message: string,
    error?: unknown,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    const errorContext = error === undefined ? {} : serializeError(error);
    this.write('error', message, { ...context, ...errorContext });
  }

  public show(): void {
    this.#channel.show(true);
  }

  public dispose(): void {
    this.#channel.dispose();
  }

  private write(
    level: LogLevel,
    message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    if (!this.shouldWrite(level)) {
      return;
    }

    const contextText =
      context === undefined || Object.keys(context).length === 0
        ? ''
        : ` ${safeStringify(context)}`;
    this.#channel.appendLine(
      `${new Date().toISOString()} [${level.toUpperCase()}] ${message}${contextText}`,
    );
  }

  private shouldWrite(level: LogLevel): boolean {
    const configuredLevel = vscode.workspace
      .getConfiguration(this.configurationSection)
      .get<LogLevel>('logging.level', 'info');
    return LOG_LEVEL_WEIGHT[level] >= LOG_LEVEL_WEIGHT[configuredLevel];
  }
}

function serializeError(error: unknown): Readonly<Record<string, unknown>> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      cause: error.cause instanceof Error ? error.cause.message : error.cause,
    };
  }

  return { errorValue: String(error) };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable-context]';
  }
}
