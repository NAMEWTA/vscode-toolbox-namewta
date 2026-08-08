import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import type { ToolHandler } from '../../orchestration/tool-handler';
import { ApplicationError } from '../../kernel/application-error';
import {
  isBlameDataComplete,
  type GitBlameDataPort,
} from './git-blame-annotation-model';
import type {
  GitBlameAnnotationsInput,
  GitBlameAnnotationsResult,
} from './git-blame-model';

const GET_ANNOTATIONS_COMMAND = 'gitBlame.getAnnotations' as const;

export class GitBlameHandler implements ToolHandler<typeof GET_ANNOTATIONS_COMMAND> {
  public readonly command = GET_ANNOTATIONS_COMMAND;

  public constructor(private readonly port: GitBlameDataPort) {}

  public async execute(
    input: GitBlameAnnotationsInput,
    context: ToolExecutionContext,
  ): Promise<GitBlameAnnotationsResult> {
    if (context.signal.aborted) {
      throw createAbortError();
    }
    if (input.lineCount === 0) {
      return { status: 'unavailable', reason: 'empty' };
    }
    if (input.lineCount > input.maxLines) {
      return { status: 'unavailable', reason: 'max-lines' };
    }

    const result = await this.port.getAnnotations(input, context.signal);
    if (result.status === 'unavailable') {
      return result;
    }
    if (!isBlameDataComplete(result.lines, input.lineCount)) {
      throw new ApplicationError('Git blame output does not match the document.', {
        code: 'internal-error',
      });
    }
    return {
      status: 'available',
      documentVersion: input.documentVersion,
      lines: result.lines,
      ...(result.remoteUrl === undefined ? {} : { remoteUrl: result.remoteUrl }),
    };
  }
}

function createAbortError(): Error {
  const error = new Error('The Git blame request was cancelled.');
  error.name = 'AbortError';
  return error;
}
