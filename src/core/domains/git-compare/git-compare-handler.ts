import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import type { ToolHandler } from '../../orchestration/tool-handler';
import type {
  GitCompareHistoryInput,
  GitCompareHistoryPage,
  GitCompareInput,
  GitCompareResult,
  GitCompareRevisionInput,
  GitCompareRevisionResult,
} from './git-compare-model';
import type { GitComparePort } from './git-compare-port';

export class GitCompareListCommitsHandler
  implements ToolHandler<'gitCompare.listCommits'>
{
  public readonly command = 'gitCompare.listCommits' as const;

  public constructor(private readonly port: GitComparePort) {}

  public async execute(
    input: GitCompareHistoryInput,
    context: ToolExecutionContext,
  ): Promise<GitCompareHistoryPage> {
    assertActive(context);
    return this.port.listCommits(input, context.signal);
  }
}

export class GitCompareCommitsHandler
  implements ToolHandler<'gitCompare.compareCommits'>
{
  public readonly command = 'gitCompare.compareCommits' as const;

  public constructor(private readonly port: GitComparePort) {}

  public async execute(
    input: GitCompareInput,
    context: ToolExecutionContext,
  ): Promise<GitCompareResult> {
    assertActive(context);
    const result = await this.port.compareCommits(input, context.signal);
    return {
      base: input.base,
      target: input.target,
      changes: result.changes,
      stats: result.stats,
    };
  }
}

export class GitCompareRevisionContentHandler
  implements ToolHandler<'gitCompare.getRevisionContent'>
{
  public readonly command = 'gitCompare.getRevisionContent' as const;

  public constructor(private readonly port: GitComparePort) {}

  public async execute(
    input: GitCompareRevisionInput,
    context: ToolExecutionContext,
  ): Promise<GitCompareRevisionResult> {
    assertActive(context);
    return this.port.getRevisionContent(input, context.signal);
  }
}

function assertActive(context: ToolExecutionContext): void {
  if (context.signal.aborted) {
    const error = new Error('The Git comparison request was cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}
