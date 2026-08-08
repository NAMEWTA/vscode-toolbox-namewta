import type {
  ToolCommandId,
  ToolCommandInput,
  ToolCommandOutput,
} from '../contracts/tool-command-contract';
import type { ToolExecutionContext } from './tool-execution-context';

export type ToolHandler<TCommand extends ToolCommandId> = {
  readonly command: TCommand;

  execute(
    input: ToolCommandInput<TCommand>,
    context: ToolExecutionContext,
  ): Promise<ToolCommandOutput<TCommand>>;
};
