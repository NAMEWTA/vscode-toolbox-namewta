import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import type { ToolHandler } from '../../orchestration/tool-handler';
import type { GitCopyCommitHashInput } from './git-blame-model';

const COPY_COMMIT_HASH_COMMAND = 'gitBlame.copyCommitHash' as const;

export type GitCommitHashClipboardPort = {
  writeText(text: string): Promise<void>;
};

export class GitCopyCommitHashHandler
  implements ToolHandler<typeof COPY_COMMIT_HASH_COMMAND>
{
  public readonly command = COPY_COMMIT_HASH_COMMAND;

  public constructor(private readonly clipboard: GitCommitHashClipboardPort) {}

  public async execute(
    input: GitCopyCommitHashInput,
    context: ToolExecutionContext,
  ): Promise<string> {
    if (context.signal.aborted) {
      throw createAbortError();
    }
    await this.clipboard.writeText(input.hash);
    return input.hash;
  }
}

function createAbortError(): Error {
  const error = new Error('The copy commit hash request was cancelled.');
  error.name = 'AbortError';
  return error;
}
