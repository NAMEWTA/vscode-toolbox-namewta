import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import type { ToolHandler } from '../../orchestration/tool-handler';
import type {
  GitHistoricalContentInput,
  GitHistoricalContentResult,
} from './git-blame-model';
import { GIT_EMPTY_TREE_HASH, type GitHistoryPort } from './git-history-model';

const GET_HISTORICAL_CONTENT_COMMAND = 'gitBlame.getHistoricalContent' as const;

export class GitHistoricalContentHandler
  implements ToolHandler<typeof GET_HISTORICAL_CONTENT_COMMAND>
{
  public readonly command = GET_HISTORICAL_CONTENT_COMMAND;

  public constructor(private readonly port: GitHistoryPort) {}

  public execute(
    input: GitHistoricalContentInput,
    context: ToolExecutionContext,
  ): Promise<GitHistoricalContentResult> {
    if (context.signal.aborted) {
      return Promise.reject(createAbortError());
    }
    if (input.ref === GIT_EMPTY_TREE_HASH) {
      return Promise.resolve({ content: '' });
    }
    return this.port.getHistoricalContent(input, context.signal);
  }
}

function createAbortError(): Error {
  const error = new Error('The historical content request was cancelled.');
  error.name = 'AbortError';
  return error;
}
