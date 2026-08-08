import {
  isToolCommandId,
  isToolCommandInput,
  type ToolCapability,
  type ToolCommandId,
  type ToolCommandInput,
  type ToolCommandOutput,
} from '../contracts/tool-command-contract';
import type { ToolError } from '../contracts/tool-error-contract';
import type { ToolResult } from '../contracts/tool-result-contract';
import { ApplicationError } from '../kernel/application-error';
import type { ToolExecutionContext, ToolLogger } from './tool-execution-context';
import type { ToolRegistry } from './tool-registry';

const ACTIVE_SIGNAL = Object.freeze({ aborted: false });

export type ToolboxGateway = {
  execute<TCommand extends ToolCommandId>(
    command: TCommand,
    input: ToolCommandInput<TCommand>,
    context?: Partial<ToolExecutionContext>,
  ): Promise<ToolResult<ToolCommandOutput<TCommand>>>;

  getCapabilities(): readonly ToolCapability[];
};

export class DefaultToolboxGateway implements ToolboxGateway {
  public constructor(
    private readonly registry: ToolRegistry,
    private readonly logger: ToolLogger,
  ) {}

  public async execute<TCommand extends ToolCommandId>(
    command: TCommand,
    input: ToolCommandInput<TCommand>,
    context: Partial<ToolExecutionContext> = {},
  ): Promise<ToolResult<ToolCommandOutput<TCommand>>> {
    const executionContext = this.createExecutionContext(context);

    if (!isToolCommandId(command)) {
      return {
        ok: false,
        error: {
          code: 'not-found',
          message: 'The requested tool command is not available.',
          retryable: false,
        },
      };
    }

    if (!isToolCommandInput(command, input)) {
      return {
        ok: false,
        error: {
          code: 'invalid-input',
          message: 'The tool request input is invalid.',
          retryable: false,
        },
      };
    }

    if (executionContext.signal.aborted) {
      return { ok: false, error: createCancelledError() };
    }

    try {
      executionContext.logger.debug('Executing tool command.', {
        command,
        requestId: executionContext.requestId,
        source: executionContext.source,
      });

      const data = await this.registry.execute(command, input, executionContext);
      return { ok: true, data };
    } catch (error: unknown) {
      const toolError = mapToolError(error);
      executionContext.logger.error('Tool command execution failed.', error, {
        command,
        code: toolError.code,
        requestId: executionContext.requestId,
        source: executionContext.source,
      });
      return { ok: false, error: toolError };
    }
  }

  public getCapabilities(): readonly ToolCapability[] {
    return this.registry.getCapabilities();
  }

  private createExecutionContext(
    context: Partial<ToolExecutionContext>,
  ): ToolExecutionContext {
    return {
      signal: context.signal ?? ACTIVE_SIGNAL,
      requestId: context.requestId ?? createRequestId(),
      source: context.source ?? 'extension-api',
      logger: context.logger ?? this.logger,
    };
  }
}

function mapToolError(error: unknown): ToolError {
  if (error instanceof ApplicationError) {
    const baseError: ToolError = {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    };
    return error.details === undefined
      ? baseError
      : { ...baseError, details: error.details };
  }

  if (isAbortError(error)) {
    return createCancelledError();
  }

  return {
    code: 'internal-error',
    message: 'An unexpected error occurred while executing the tool.',
    retryable: false,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function createCancelledError(): ToolError {
  return {
    code: 'cancelled',
    message: 'The tool request was cancelled.',
    retryable: false,
  };
}

function createRequestId(): string {
  return `tool-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
