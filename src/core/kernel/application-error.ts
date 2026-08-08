import type { ToolErrorCode } from '../contracts/tool-error-contract';

export type ApplicationErrorOptions = {
  readonly code: ToolErrorCode;
  readonly retryable?: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
};

export class ApplicationError extends Error {
  public readonly code: ToolErrorCode;
  public readonly retryable: boolean;
  public readonly details: Readonly<Record<string, unknown>> | undefined;
  public override readonly cause: unknown;

  public constructor(message: string, options: ApplicationErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'ApplicationError';
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
    this.cause = options.cause;
  }
}
