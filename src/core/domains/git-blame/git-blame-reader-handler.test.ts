import { describe, expect, it, vi } from 'vitest';
import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import type { GitBlameDataPort } from './git-blame-annotation-model';
import { GitBlameReaderHandler } from './git-blame-reader-handler';

describe('GitBlameReaderHandler', () => {
  it('builds a reader model from available blame data', async () => {
    const port = createPort({
      status: 'available',
      lines: [blameLine(1)],
      remoteUrl: 'https://github.com/example/repo.git',
    });
    const handler = new GitBlameReaderHandler(port);
    await expect(handler.execute(input(), context())).resolves.toMatchObject({
      generation: 4,
      sourceLine: 1,
      remoteUrl: 'https://github.com/example/repo.git',
      lineCount: 1,
    });
    expect(port.getAnnotationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ contents: 'source' }),
      expect.anything(),
    );
  });

  it('rejects empty, oversized, unavailable, mismatched and cancelled requests', async () => {
    const port = createPort({ status: 'unavailable', reason: 'untracked' });
    const handler = new GitBlameReaderHandler(port);
    await expect(
      handler.execute({ ...input(), lineCount: 0, sourceText: '' }, context()),
    ).rejects.toMatchObject({ code: 'capability-unavailable' });
    await expect(
      handler.execute({ ...input(), lineCount: 101, maxLines: 100 }, context()),
    ).rejects.toMatchObject({ code: 'capability-unavailable' });
    await expect(handler.execute(input(), context())).rejects.toMatchObject({
      code: 'not-found',
    });
    const mismatch = new GitBlameReaderHandler(
      createPort({ status: 'available', lines: [] }),
    );
    await expect(mismatch.execute(input(), context())).rejects.toMatchObject({
      code: 'internal-error',
    });
    await expect(
      handler.execute(input(), { ...context(), signal: { aborted: true } }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

function input(): {
  readonly resource: { readonly repositoryRoot: string; readonly relativePath: string };
  readonly sourceUri: string;
  readonly revision: string;
  readonly documentVersion: number;
  readonly lineCount: number;
  readonly ignoreWhitespace: boolean;
  readonly maxLines: number;
  readonly sourceText: string;
  readonly generation: number;
  readonly sourceLine: number;
} {
  return {
    resource: { repositoryRoot: '/workspace/repo', relativePath: 'main.ts' },
    sourceUri: 'file:///workspace/repo/main.ts',
    revision: 'HEAD',
    documentVersion: 2,
    lineCount: 1,
    ignoreWhitespace: false,
    maxLines: 20_000,
    sourceText: 'source',
    generation: 4,
    sourceLine: 1,
  } as const;
}

function blameLine(line: number): {
  readonly line: number;
  readonly commit: string;
  readonly author: string;
  readonly email: string;
  readonly authoredAt: number;
  readonly summary: string;
} {
  return {
    line,
    commit: 'a'.repeat(40),
    author: 'Alice',
    email: 'alice@example.com',
    authoredAt: 1_700_000_000,
    summary: 'Initial',
  } as const;
}

function createPort(
  result: Awaited<ReturnType<GitBlameDataPort['getAnnotations']>>,
): GitBlameDataPort & { readonly getAnnotationsMock: ReturnType<typeof vi.fn> } {
  const getAnnotations = vi.fn().mockResolvedValue(result);
  return { getAnnotations, getAnnotationsMock: getAnnotations };
}

function context(): ToolExecutionContext {
  return {
    signal: { aborted: false },
    requestId: 'reader-handler',
    source: 'extension-api',
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}
