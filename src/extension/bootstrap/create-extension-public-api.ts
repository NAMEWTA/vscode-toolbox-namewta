import type {
  ToolCommandId,
  ToolCommandInput,
  VscodeToolboxNamewtaExtensionApi,
} from '../../core/contracts';
import type { ToolboxGateway } from '../../core/orchestration/public-api';

export function createExtensionPublicApi(
  gateway: ToolboxGateway,
): VscodeToolboxNamewtaExtensionApi {
  return {
    apiVersion: 1,
    execute: <TCommand extends ToolCommandId>(
      command: TCommand,
      input: ToolCommandInput<TCommand>,
    ) => gateway.execute(command, input, { source: 'extension-api' }),
    getCapabilities: () => gateway.getCapabilities(),
  };
}
