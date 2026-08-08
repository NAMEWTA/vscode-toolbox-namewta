import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import type { ToolHandler } from '../../orchestration/tool-handler';
import type { GitCommitChangesInput, GitCommitChangesResult } from './git-blame-model';
import type { GitHistoryPort } from './git-history-model';

const GET_COMMIT_CHANGES_COMMAND = 'gitBlame.getCommitChanges' as const;

export class GitCommitChangesHandler
  implements ToolHandler<typeof GET_COMMIT_CHANGES_COMMAND>
{
  public readonly command = GET_COMMIT_CHANGES_COMMAND;

  public constructor(private readonly port: GitHistoryPort) {}

  public execute(
    input: GitCommitChangesInput,
    context: ToolExecutionContext,
  ): Promise<GitCommitChangesResult> {
    if (context.signal.aborted) {
      return Promise.reject(createAbortError());
    }
    return this.port.getCommitChanges(input, context.signal);
  }
}

function createAbortError(): Error {
  const error = new Error('The Git commit changes request was cancelled.');
  error.name = 'AbortError';
  return error;
}
