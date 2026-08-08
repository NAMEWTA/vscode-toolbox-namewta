import { describe, expect, it, vi } from 'vitest';
import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import { GitHistoricalContentHandler } from './git-historical-content-handler';
import { GIT_EMPTY_TREE_HASH, type GitHistoryPort } from './git-history-model';

describe('GitHistoricalContentHandler', () => {
  it('returns an empty document for an empty-tree descriptor without invoking Git', async () => {
    const port = createPort();
    const handler = new GitHistoricalContentHandler(port);

    await expect(
      handler.execute(
        {
          resource: { repositoryRoot: '/repo', relativePath: 'main.ts' },
          ref: GIT_EMPTY_TREE_HASH,
          path: 'main.ts',
        },
        context(),
      ),
    ).resolves.toEqual({ content: '' });
    expect(port.getHistoricalContent).not.toHaveBeenCalled();
  });
});

function createPort(): GitHistoryPort & {
  readonly getCommitChanges: ReturnType<typeof vi.fn>;
  readonly getHistoricalContent: ReturnType<typeof vi.fn>;
} {
  return { getCommitChanges: vi.fn(), getHistoricalContent: vi.fn() };
}

function context(): ToolExecutionContext {
  return {
    signal: { aborted: false },
    requestId: 'content-test',
    source: 'extension-api',
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}
