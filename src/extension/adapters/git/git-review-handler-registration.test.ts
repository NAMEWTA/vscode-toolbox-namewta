import { describe, expect, it, vi } from 'vitest';
import type { GitReviewPort } from '../../../core/domains/git-review/public-api';
import {
  DefaultToolboxGateway,
  ToolRegistry,
  type ToolLogger,
} from '../../../core/orchestration/public-api';
import { registerGitReviewHandlers } from './git-review-handler-registration';

describe('Git Review Handler 注册', () => {
  it('只在实际注册全部 Handler 后通过 Gateway 报告并执行能力', async () => {
    const port = createPort();
    port.listChanges.mockResolvedValue([
      {
        path: 'main.ts',
        contentIdentity: 'a'.repeat(64),
        change: 'modified',
        presentation: 'text',
      },
    ]);
    const registry = new ToolRegistry();
    registerGitReviewHandlers(registry, port);
    const gateway = new DefaultToolboxGateway(registry, createLogger());

    expect(gateway.getCapabilities()).toEqual([
      { command: 'gitReview.discardItem', available: true },
      { command: 'gitReview.end', available: true },
      { command: 'gitReview.getItemContent', available: true },
      { command: 'gitReview.markReviewedAndNext', available: true },
      { command: 'gitReview.markStale', available: true },
      { command: 'gitReview.next', available: true },
      { command: 'gitReview.previous', available: true },
      { command: 'gitReview.refresh', available: true },
      { command: 'gitReview.retry', available: true },
      { command: 'gitReview.skip', available: true },
      { command: 'gitReview.stageItem', available: true },
      { command: 'gitReview.start', available: true },
      { command: 'gitReview.unstageItem', available: true },
    ]);
    await expect(
      gateway.execute('gitReview.start', {
        repositoryRoot: '/workspace/repository',
        replace: false,
      }),
    ).resolves.toMatchObject({
      ok: true,
      data: { state: 'active', session: { currentItemPath: 'main.ts' } },
    });
  });

  it('在仓库没有变更时通过 Gateway 拒绝创建空会话', async () => {
    const port = createPort();
    port.listChanges.mockResolvedValue([]);
    const registry = new ToolRegistry();
    registerGitReviewHandlers(registry, port);
    const gateway = new DefaultToolboxGateway(registry, createLogger());

    await expect(
      gateway.execute('gitReview.start', {
        repositoryRoot: '/workspace/repository',
        replace: false,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'capability-unavailable' },
    });
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

function createLogger(): ToolLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}
