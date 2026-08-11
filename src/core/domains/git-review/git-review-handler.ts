import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import type { ToolHandler } from '../../orchestration/tool-handler';
import type {
  GitReviewItemContent,
  GitReviewItemContentInput,
  GitReviewSessionSnapshot,
  GitReviewStartInput,
} from './git-review-model';
import type {
  GitReviewItemActionInput,
  GitReviewItemPatch,
} from './git-review-patch-model';
import type { GitReviewSessionService } from './git-review-session-service';

const START_COMMAND = 'gitReview.start' as const;
const PREVIOUS_COMMAND = 'gitReview.previous' as const;
const NEXT_COMMAND = 'gitReview.next' as const;
const MARK_REVIEWED_AND_NEXT_COMMAND = 'gitReview.markReviewedAndNext' as const;
const RETRY_COMMAND = 'gitReview.retry' as const;
const SKIP_COMMAND = 'gitReview.skip' as const;
const REFRESH_COMMAND = 'gitReview.refresh' as const;
const END_COMMAND = 'gitReview.end' as const;
const MARK_STALE_COMMAND = 'gitReview.markStale' as const;
const GET_ITEM_CONTENT_COMMAND = 'gitReview.getItemContent' as const;
const GET_ITEM_PATCH_COMMAND = 'gitReview.getItemPatch' as const;
const STAGE_ITEM_COMMAND = 'gitReview.stageItem' as const;
const UNSTAGE_ITEM_COMMAND = 'gitReview.unstageItem' as const;
const DISCARD_ITEM_COMMAND = 'gitReview.discardItem' as const;

export class GitReviewStartHandler implements ToolHandler<typeof START_COMMAND> {
  public readonly command = START_COMMAND;

  public constructor(private readonly sessionService: GitReviewSessionService) {}

  public execute(
    input: GitReviewStartInput,
    context: ToolExecutionContext,
  ): Promise<GitReviewSessionSnapshot> {
    return executeAction(context, () =>
      this.sessionService.start(input, context.signal),
    );
  }
}

export class GitReviewPreviousHandler implements ToolHandler<typeof PREVIOUS_COMMAND> {
  public readonly command = PREVIOUS_COMMAND;

  public constructor(private readonly sessionService: GitReviewSessionService) {}

  public execute(
    _input: Record<string, never>,
    context: ToolExecutionContext,
  ): Promise<GitReviewSessionSnapshot> {
    return executeAction(context, () => this.sessionService.previous());
  }
}

export class GitReviewNextHandler implements ToolHandler<typeof NEXT_COMMAND> {
  public readonly command = NEXT_COMMAND;

  public constructor(private readonly sessionService: GitReviewSessionService) {}

  public execute(
    _input: Record<string, never>,
    context: ToolExecutionContext,
  ): Promise<GitReviewSessionSnapshot> {
    return executeAction(context, () => this.sessionService.next());
  }
}

export class GitReviewMarkReviewedAndNextHandler
  implements ToolHandler<typeof MARK_REVIEWED_AND_NEXT_COMMAND>
{
  public readonly command = MARK_REVIEWED_AND_NEXT_COMMAND;

  public constructor(private readonly sessionService: GitReviewSessionService) {}

  public execute(
    _input: Record<string, never>,
    context: ToolExecutionContext,
  ): Promise<GitReviewSessionSnapshot> {
    return executeAction(context, () => this.sessionService.markReviewedAndNext());
  }
}

export class GitReviewRetryHandler implements ToolHandler<typeof RETRY_COMMAND> {
  public readonly command = RETRY_COMMAND;

  public constructor(private readonly sessionService: GitReviewSessionService) {}

  public execute(
    _input: Record<string, never>,
    context: ToolExecutionContext,
  ): Promise<GitReviewSessionSnapshot> {
    return executeAction(context, () => this.sessionService.retry());
  }
}

export class GitReviewSkipHandler implements ToolHandler<typeof SKIP_COMMAND> {
  public readonly command = SKIP_COMMAND;

  public constructor(private readonly sessionService: GitReviewSessionService) {}

  public execute(
    _input: Record<string, never>,
    context: ToolExecutionContext,
  ): Promise<GitReviewSessionSnapshot> {
    return executeAction(context, () => this.sessionService.skip());
  }
}

export class GitReviewRefreshHandler implements ToolHandler<typeof REFRESH_COMMAND> {
  public readonly command = REFRESH_COMMAND;

  public constructor(private readonly sessionService: GitReviewSessionService) {}

  public execute(
    _input: Record<string, never>,
    context: ToolExecutionContext,
  ): Promise<GitReviewSessionSnapshot> {
    return executeAction(context, () => this.sessionService.refresh(context.signal));
  }
}

export class GitReviewEndHandler implements ToolHandler<typeof END_COMMAND> {
  public readonly command = END_COMMAND;

  public constructor(private readonly sessionService: GitReviewSessionService) {}

  public execute(
    _input: Record<string, never>,
    context: ToolExecutionContext,
  ): Promise<GitReviewSessionSnapshot> {
    return executeAction(context, () => this.sessionService.end());
  }
}

export class GitReviewMarkStaleHandler
  implements ToolHandler<typeof MARK_STALE_COMMAND>
{
  public readonly command = MARK_STALE_COMMAND;

  public constructor(private readonly sessionService: GitReviewSessionService) {}

  public execute(
    _input: Record<string, never>,
    context: ToolExecutionContext,
  ): Promise<GitReviewSessionSnapshot> {
    return executeAction(context, () => this.sessionService.markStale());
  }
}

export class GitReviewGetItemContentHandler
  implements ToolHandler<typeof GET_ITEM_CONTENT_COMMAND>
{
  public readonly command = GET_ITEM_CONTENT_COMMAND;

  public constructor(private readonly sessionService: GitReviewSessionService) {}

  public execute(
    input: GitReviewItemContentInput,
    context: ToolExecutionContext,
  ): Promise<GitReviewItemContent> {
    return executeAction(context, () =>
      this.sessionService.getItemContent(input, context.signal),
    );
  }
}

export class GitReviewGetItemPatchHandler
  implements ToolHandler<typeof GET_ITEM_PATCH_COMMAND>
{
  public readonly command = GET_ITEM_PATCH_COMMAND;

  public constructor(private readonly sessionService: GitReviewSessionService) {}

  public execute(
    input: GitReviewItemActionInput,
    context: ToolExecutionContext,
  ): Promise<GitReviewItemPatch> {
    return executeAction(context, () =>
      this.sessionService.getItemPatch(input, context.signal),
    );
  }
}

export class GitReviewStageItemHandler
  implements ToolHandler<typeof STAGE_ITEM_COMMAND>
{
  public readonly command = STAGE_ITEM_COMMAND;

  public constructor(private readonly sessionService: GitReviewSessionService) {}

  public execute(
    input: GitReviewItemActionInput,
    context: ToolExecutionContext,
  ): Promise<GitReviewSessionSnapshot> {
    return executeAction(context, () =>
      this.sessionService.stageItem(input, context.signal),
    );
  }
}

export class GitReviewUnstageItemHandler
  implements ToolHandler<typeof UNSTAGE_ITEM_COMMAND>
{
  public readonly command = UNSTAGE_ITEM_COMMAND;

  public constructor(private readonly sessionService: GitReviewSessionService) {}

  public execute(
    input: GitReviewItemActionInput,
    context: ToolExecutionContext,
  ): Promise<GitReviewSessionSnapshot> {
    return executeAction(context, () =>
      this.sessionService.unstageItem(input, context.signal),
    );
  }
}

export class GitReviewDiscardItemHandler
  implements ToolHandler<typeof DISCARD_ITEM_COMMAND>
{
  public readonly command = DISCARD_ITEM_COMMAND;

  public constructor(private readonly sessionService: GitReviewSessionService) {}

  public execute(
    input: GitReviewItemActionInput,
    context: ToolExecutionContext,
  ): Promise<GitReviewSessionSnapshot> {
    return executeAction(context, () =>
      this.sessionService.discardItem(input, context.signal),
    );
  }
}

function executeAction<TResult>(
  context: ToolExecutionContext,
  action: () => TResult | Promise<TResult>,
): Promise<TResult> {
  try {
    throwIfCancelled(context);
    return Promise.resolve(action());
  } catch (error: unknown) {
    return Promise.reject(toError(error));
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('The Git Review command failed.');
}

function throwIfCancelled(context: ToolExecutionContext): void {
  if (context.signal.aborted) {
    const error = new Error('The Git Review request was cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}
