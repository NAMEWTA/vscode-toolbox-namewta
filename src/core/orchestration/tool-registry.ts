import type {
  ToolCapability,
  ToolCommandId,
  ToolCommandInput,
  ToolCommandOutput,
} from '../contracts/tool-command-contract';
import { ApplicationError } from '../kernel/application-error';
import type { ToolExecutionContext } from './tool-execution-context';
import type { ToolHandler } from './tool-handler';

type RegisteredExecutor = (
  input: unknown,
  context: ToolExecutionContext,
) => Promise<unknown>;

export class ToolRegistry {
  readonly #executors = new Map<ToolCommandId, RegisteredExecutor>();

  public register<TCommand extends ToolCommandId>(
    handler: ToolHandler<TCommand>,
  ): void {
    if (this.#executors.has(handler.command)) {
      throw new ApplicationError(
        `Tool command is already registered: ${handler.command}`,
        {
          code: 'invalid-input',
          details: { command: handler.command },
        },
      );
    }

    this.#executors.set(handler.command, (input, context) => {
      // Registry 是唯一允许进行类型擦除的边界。Gateway 会先完成运行时校验，
      // 因此执行到此包装器时，输入已经与命令契约匹配。
      return handler.execute(input as ToolCommandInput<TCommand>, context);
    });
  }

  public async execute<TCommand extends ToolCommandId>(
    command: TCommand,
    input: ToolCommandInput<TCommand>,
    context: ToolExecutionContext,
  ): Promise<ToolCommandOutput<TCommand>> {
    const executor = this.#executors.get(command);

    if (executor === undefined) {
      throw new ApplicationError(`Tool command is not registered: ${command}`, {
        code: 'not-found',
        details: { command },
      });
    }

    return (await executor(input, context)) as ToolCommandOutput<TCommand>;
  }

  public has(command: ToolCommandId): boolean {
    return this.#executors.has(command);
  }

  public getCapabilities(): readonly ToolCapability[] {
    return [...this.#executors.keys()]
      .sort()
      .map((command) => ({ command, available: true }));
  }
}
