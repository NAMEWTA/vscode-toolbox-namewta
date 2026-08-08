import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import type { ToolHandler } from '../../orchestration/tool-handler';
import { COPY_REFERENCE_COPY_COMMAND } from './copy-reference-command';
import { formatCopyReference } from './copy-reference-formatter';
import type {
  ClipboardPort,
  CopyReferenceFormatter,
  CopyReferenceInput,
} from './copy-reference-model';

export class CopyReferenceHandler
  implements ToolHandler<typeof COPY_REFERENCE_COPY_COMMAND>
{
  public readonly command = COPY_REFERENCE_COPY_COMMAND;

  public constructor(
    private readonly clipboard: ClipboardPort,
    private readonly formatter: CopyReferenceFormatter = formatCopyReference,
  ) {}

  public async execute(
    input: CopyReferenceInput,
    context: ToolExecutionContext,
  ): Promise<string> {
    if (context.signal.aborted) {
      throw createAbortError();
    }

    const reference = this.formatter(input);
    await this.clipboard.writeText(reference);
    return reference;
  }
}

function createAbortError(): Error {
  const error = new Error('The copy reference request was cancelled.');
  error.name = 'AbortError';
  return error;
}
