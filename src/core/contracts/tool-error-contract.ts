export type ToolErrorCode =
  | 'invalid-input'
  | 'capability-unavailable'
  | 'not-found'
  | 'permission-denied'
  | 'cancelled'
  | 'timeout'
  | 'internal-error';

export type ToolError = {
  readonly code: ToolErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
};
