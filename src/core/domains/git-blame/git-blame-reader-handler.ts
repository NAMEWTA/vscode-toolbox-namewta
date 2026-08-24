import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import type { ToolHandler } from '../../orchestration/tool-handler';
import { ApplicationError } from '../../kernel/application-error';
import type { GitBlameDataPort } from './git-blame-annotation-model';
import {
  buildGitBlameReaderModel,
  type GitBlameReaderModel,
} from './git-blame-reader-model';
import type { GitBlameReaderModelInput } from '../../contracts/tool-command-contract';

const GET_READER_MODEL_COMMAND = 'gitBlame.getReaderModel' as const;

export class GitBlameReaderHandler
  implements ToolHandler<typeof GET_READER_MODEL_COMMAND>
{
  public readonly command = GET_READER_MODEL_COMMAND;

  public constructor(private readonly port: GitBlameDataPort) {}

  // eslint-disable-next-line complexity
  public async execute(
    input: GitBlameReaderModelInput,
    context: ToolExecutionContext,
  ): Promise<GitBlameReaderModel> {
    if (context.signal.aborted) throw createAbortError();
    if (input.lineCount === 0 || input.sourceText.length === 0) {
      throw new ApplicationError('The Reader requires a non-empty source file.', {
        code: 'capability-unavailable',
      });
    }
    if (input.lineCount > input.maxLines) {
      throw new ApplicationError(
        'The source file exceeds the configured Reader limit.',
        {
          code: 'capability-unavailable',
        },
      );
    }
    const result = await this.port.getAnnotations(
      {
        resource: input.resource,
        ...(input.revision === 'HEAD' ? {} : { ref: input.revision }),
        ...(input.revision === 'HEAD' ? { contents: input.sourceText } : {}),
        ignoreWhitespace: input.ignoreWhitespace,
        includeRevisionNumbers: false,
      },
      context.signal,
    );
    if (result.status !== 'available') {
      throw new ApplicationError('Git blame is unavailable for this source file.', {
        code: result.reason === 'untracked' ? 'not-found' : 'capability-unavailable',
        details: { reason: result.reason },
      });
    }
    try {
      const model = buildGitBlameReaderModel({
        sourceUri: input.sourceUri,
        resource: input.resource,
        revision: input.revision,
        documentVersion: input.documentVersion,
        generation: input.generation,
        sourceLine: input.sourceLine,
        ...(result.remoteUrl === undefined ? {} : { remoteUrl: result.remoteUrl }),
        sourceText: input.sourceText,
        blameLines: result.lines,
      });
      if (
        model.lineCount !== input.lineCount &&
        !(model.hasFinalNewline && model.lineCount + 1 === input.lineCount)
      ) {
        throw new Error('The source document line count changed.');
      }
      return model;
    } catch (error: unknown) {
      throw new ApplicationError('Git blame output does not match the source file.', {
        code: 'internal-error',
        cause: error,
      });
    }
  }
}

function createAbortError(): Error {
  const error = new Error('The Git blame Reader request was cancelled.');
  error.name = 'AbortError';
  return error;
}
