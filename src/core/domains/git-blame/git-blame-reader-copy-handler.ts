import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import type { ToolHandler } from '../../orchestration/tool-handler';
import type { ClipboardPort } from '../copy-reference/public-api';
import type { GitBlameReaderCopyInput } from '../../contracts/tool-command-contract';
import { ApplicationError } from '../../kernel/application-error';
import {
  formatGitBlameReaderCopy,
  isValidGitBlameReaderCopyRequest,
  type GitBlameReaderCopyRequest,
} from './git-blame-reader-model';

const COPY_READER_COMMAND = 'gitBlame.copyReader' as const;

export type GitBlameReaderSessionModelPort = {
  get(generation: number): GitBlameReaderCopyRequest['model'] | undefined;
};

export class GitBlameReaderCopyHandler
  implements ToolHandler<typeof COPY_READER_COMMAND>
{
  public readonly command = COPY_READER_COMMAND;

  public constructor(
    private readonly clipboard: ClipboardPort,
    private readonly models: GitBlameReaderSessionModelPort,
    private readonly isWorkspaceTrusted: () => boolean,
  ) {}

  public async execute(
    input: GitBlameReaderCopyInput,
    context: ToolExecutionContext,
  ): Promise<string> {
    if (context.signal.aborted) throw createAbortError();
    if (!this.isWorkspaceTrusted()) {
      throw new ApplicationError('Git Blame Reader requires a trusted workspace.', {
        code: 'permission-denied',
      });
    }
    const model = this.models.get(input.generation);
    if (model === undefined) {
      throw new ApplicationError(
        'The requested Reader session is no longer available.',
        {
          code: 'not-found',
        },
      );
    }
    const request: GitBlameReaderCopyRequest = {
      model,
      format: input.format,
      ...(input.line === undefined ? {} : { line: input.line }),
      ...(input.blockId === undefined ? {} : { blockId: input.blockId }),
    };
    if (!isValidGitBlameReaderCopyRequest(request)) {
      throw new ApplicationError('The requested Reader copy target is invalid.', {
        code: 'invalid-input',
      });
    }
    const text = formatGitBlameReaderCopy(request);
    await this.clipboard.writeText(text);
    return text;
  }
}

function createAbortError(): Error {
  const error = new Error('The Reader copy request was cancelled.');
  error.name = 'AbortError';
  return error;
}
