import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import type { ToolHandler } from '../../orchestration/tool-handler';
import type { GitLineHistoryInput, GitLineHistoryPage } from './git-blame-model';
import type { GitLineHistoryPort } from './git-line-history-model';
import { GitLineHistoryTracker } from './git-line-history-tracker';

const GET_LINE_HISTORY_COMMAND = 'gitBlame.getLineHistory' as const;

export class GitLineHistoryHandler
  implements ToolHandler<typeof GET_LINE_HISTORY_COMMAND>
{
  public readonly command = GET_LINE_HISTORY_COMMAND;
  readonly #tracker: GitLineHistoryTracker;

  public constructor(port: GitLineHistoryPort) {
    this.#tracker = new GitLineHistoryTracker(port);
  }

  public execute(
    input: GitLineHistoryInput,
    context: ToolExecutionContext,
  ): Promise<GitLineHistoryPage> {
    if (context.signal.aborted) {
      return Promise.reject(createAbortError());
    }
    return this.#tracker.getPage(input, context.signal);
  }
}

function createAbortError(): Error {
  const error = new Error('The Git line history request was cancelled.');
  error.name = 'AbortError';
  return error;
}
