import { describe, expect, it, vi } from 'vitest';
import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import { GitCommitChangesHandler } from './git-commit-changes-handler';
import type { GitHistoryPort } from './git-history-model';

describe('GitCommitChangesHandler', () => {
  it('returns ordered descriptors from the History Port', async () => {
    const expected = { changes: [] };
    const port = createPort();
    port.getCommitChanges.mockResolvedValue(expected);
    const handler = new GitCommitChangesHandler(port);

    await expect(
      handler.execute(
        {
          resource: { repositoryRoot: '/repo', relativePath: 'main.ts' },
          commit: 'a'.repeat(40),
        },
        context(),
      ),
    ).resolves.toBe(expected);
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
    requestId: 'history-test',
    source: 'extension-api',
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}
