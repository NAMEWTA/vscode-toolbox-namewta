import type {
  ToolCapability,
  ToolCommandId,
  ToolCommandInput,
  ToolCommandOutput,
} from './tool-command-contract';
import type { ToolResult } from './tool-result-contract';

export type VscodeToolboxNamewtaExtensionApi = {
  readonly apiVersion: 1;

  execute<TCommand extends ToolCommandId>(
    command: TCommand,
    input: ToolCommandInput<TCommand>,
  ): Promise<ToolResult<ToolCommandOutput<TCommand>>>;

  getCapabilities(): readonly ToolCapability[];
};
