import { describe, expect, it, vi } from 'vitest';
import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import type { GitLineHistoryPort } from './git-line-history-model';
import { GitLineHistoryHandler } from './git-line-history-handler';

describe('GitLineHistoryHandler', () => {
  it('does not start tracking when execution is already cancelled', async () => {
    const getLineHistoryStep = vi.fn<GitLineHistoryPort['getLineHistoryStep']>();
    const port: GitLineHistoryPort = { getLineHistoryStep };
    const handler = new GitLineHistoryHandler(port);

    await expect(
      handler.execute(
        {
          resource: { repositoryRoot: '/repo', relativePath: 'main.ts' },
          ref: 'HEAD',
          path: 'main.ts',
          line: 1,
          limit: 20,
        },
        context(true),
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(getLineHistoryStep).not.toHaveBeenCalled();
  });
});

function context(aborted: boolean): ToolExecutionContext {
  return {
    signal: { aborted },
    requestId: 'line-history-test',
    source: 'extension-api',
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}
