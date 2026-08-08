import type { ToolCapability } from '../../contracts/tool-command-contract';
import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import type { ToolHandler } from '../../orchestration/tool-handler';
import { SYSTEM_GET_RUNTIME_INFO_COMMAND } from './system-info-command';
import type { RuntimeInfo, RuntimeInfoPort } from './system-info-model';

export class SystemInfoHandler
  implements ToolHandler<typeof SYSTEM_GET_RUNTIME_INFO_COMMAND>
{
  public readonly command = SYSTEM_GET_RUNTIME_INFO_COMMAND;

  public constructor(
    private readonly runtimeInfoPort: RuntimeInfoPort,
    private readonly readCapabilities: () => readonly ToolCapability[],
  ) {}

  public execute(
    _input: Record<string, never>,
    context: ToolExecutionContext,
  ): Promise<RuntimeInfo> {
    if (context.signal.aborted) {
      throw createAbortError();
    }

    const snapshot = this.runtimeInfoPort.readRuntimeInfo();

    return Promise.resolve({
      ...snapshot,
      apiVersion: 1,
      capabilities: this.readCapabilities(),
    });
  }
}

function createAbortError(): Error {
  const error = new Error('The runtime info request was cancelled.');
  error.name = 'AbortError';
  return error;
}
