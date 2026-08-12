import { describe, expect, it, vi } from 'vitest';
import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import { buildGitBlameReaderModel } from './git-blame-reader-model';
import { GitBlameReaderCopyHandler } from './git-blame-reader-copy-handler';

describe('GitBlameReaderCopyHandler', () => {
  it('copies only text derived from the current host session model', async () => {
    const writeText = vi.fn();
    const model = readerModel();
    const handler = new GitBlameReaderCopyHandler(
      { writeText },
      { get: (generation) => (generation === model.generation ? model : undefined) },
      () => true,
    );
    await expect(
      handler.execute({ generation: 3, format: 'all-code' }, context()),
    ).resolves.toBe('trusted source');
    expect(writeText).toHaveBeenCalledWith('trusted source');
  });

  it('rejects stale generations and untrusted workspaces without writing', async () => {
    const writeText = vi.fn();
    const model = readerModel();
    const stale = new GitBlameReaderCopyHandler(
      { writeText },
      { get: () => undefined },
      () => true,
    );
    await expect(
      stale.execute({ generation: 2, format: 'all-code' }, context()),
    ).rejects.toMatchObject({ code: 'not-found' });
    const restricted = new GitBlameReaderCopyHandler(
      { writeText },
      { get: () => model },
      () => false,
    );
    await expect(
      restricted.execute({ generation: 3, format: 'all-code' }, context()),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(writeText).not.toHaveBeenCalled();
  });
});

function readerModel(): ReturnType<typeof buildGitBlameReaderModel> {
  return buildGitBlameReaderModel({
    sourceUri: 'file:///repo/main.ts',
    resource: { repositoryRoot: '/repo', relativePath: 'main.ts' },
    revision: 'HEAD',
    documentVersion: 1,
    generation: 3,
    sourceLine: 1,
    sourceText: 'trusted source',
    blameLines: [
      {
        line: 1,
        commit: 'a'.repeat(40),
        author: 'Alice',
        email: 'alice@example.com',
        authoredAt: 1_700_000_000,
        summary: 'Initial',
      },
    ],
  });
}

function context(): ToolExecutionContext {
  return {
    signal: { aborted: false },
    requestId: 'reader-copy',
    source: 'webview',
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}
