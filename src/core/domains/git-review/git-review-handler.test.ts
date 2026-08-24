import { describe, expect, it, vi } from 'vitest';
import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import {
  GitReviewGetItemContentHandler,
  GitReviewNextHandler,
  GitReviewStartHandler,
} from './git-review-handler';
import type { GitReviewPort } from './git-review-port';
import { GitReviewSessionService } from './git-review-session-service';

describe('Git Review handlers', () => {
  it('routes typed commands through the session service and Port', async () => {
    const port = createPort();
    port.listChanges.mockResolvedValue([
      {
        path: 'alpha.ts',
        contentIdentity: 'a'.repeat(64),
        change: 'modified',
        presentation: 'text',
      },
      {
        path: 'beta.ts',
        contentIdentity: 'b'.repeat(64),
        change: 'modified',
        presentation: 'text',
      },
    ]);
    port.readItemContent.mockResolvedValue({
      kind: 'text',
      before: 'before',
      after: 'after',
    });
    const service = new GitReviewSessionService(port);

    const created = await new GitReviewStartHandler(service).execute(
      { repositoryRoot: '/workspace/repository', replace: false },
      context(),
    );
    const navigated = await new GitReviewNextHandler(service).execute({}, context());
    const content = await new GitReviewGetItemContentHandler(service).execute(
      { path: 'beta.ts', contentIdentity: 'b'.repeat(64) },
      context(),
    );

    expect(created).toMatchObject({
      state: 'active',
      session: { currentItemPath: 'alpha.ts' },
    });
    expect(navigated).toMatchObject({
      state: 'active',
      session: { currentItemPath: 'beta.ts' },
    });
    expect(content).toEqual({ kind: 'text', before: 'before', after: 'after' });
  });

  it('rejects a cancelled command before it can mutate an inactive session', async () => {
    const handler = new GitReviewNextHandler(new GitReviewSessionService(createPort()));

    await expect(handler.execute({}, context(true))).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('returns a rejected Promise for a cancelled start without invoking the Port', async () => {
    const port = createPort();
    const handler = new GitReviewStartHandler(new GitReviewSessionService(port));

    await expect(
      handler.execute(
        { repositoryRoot: '/workspace/repository', replace: false },
        context(true),
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(port.listChanges).not.toHaveBeenCalled();
  });
});

function createPort(): GitReviewPort & {
  readonly listChanges: ReturnType<typeof vi.fn>;
  readonly readItemContent: ReturnType<typeof vi.fn>;
} {
  return {
    listChanges: vi.fn(),
    readItemContent: vi.fn(),
    mutateItem: vi.fn(),
  };
}

function context(aborted = false): ToolExecutionContext {
  return {
    signal: { aborted },
    requestId: 'git-review-handler-test',
    source: 'extension-api',
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}
