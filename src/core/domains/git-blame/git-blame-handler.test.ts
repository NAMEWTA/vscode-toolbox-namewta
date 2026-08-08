import { describe, expect, it, vi } from 'vitest';
import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import type { GitBlameAnnotationsInput } from './git-blame-model';
import { GitBlameHandler } from './git-blame-handler';
import type { GitBlameDataPort } from './git-blame-annotation-model';

describe('GitBlameHandler', () => {
  it('returns max-lines without invoking the Git Port', async () => {
    const port = createPort();
    const handler = new GitBlameHandler(port);

    await expect(
      handler.execute({ ...input(), lineCount: 201, maxLines: 200 }, context()),
    ).resolves.toEqual({ status: 'unavailable', reason: 'max-lines' });
    expect(port.getAnnotations).not.toHaveBeenCalled();
  });

  it('binds available lines to the requested document version', async () => {
    const lines = [
      {
        line: 1,
        commit: 'a'.repeat(40),
        author: 'Alice',
        email: 'alice@example.com',
        authoredAt: 1_700_000_000,
        summary: 'initial',
      },
    ];
    const port = createPort({ status: 'available', lines });
    const handler = new GitBlameHandler(port);

    await expect(handler.execute(input(), context())).resolves.toEqual({
      status: 'available',
      documentVersion: 7,
      lines,
    });
  });

  it('accepts the terminal empty line that VS Code includes in document lineCount', async () => {
    const lines = [
      {
        line: 1,
        commit: 'a'.repeat(40),
        author: 'Alice',
        email: 'alice@example.com',
        authoredAt: 1_700_000_000,
        summary: 'initial',
      },
    ];
    const handler = new GitBlameHandler(createPort({ status: 'available', lines }));

    await expect(
      handler.execute({ ...input(), lineCount: 2 }, context()),
    ).resolves.toMatchObject({ status: 'available', lines });
  });

  it('rejects a partial line list instead of returning mismatched blame data', async () => {
    const port = createPort({ status: 'available', lines: [] });
    const handler = new GitBlameHandler(port);

    await expect(handler.execute(input(), context())).rejects.toMatchObject({
      code: 'internal-error',
    });
  });
});

function input(): GitBlameAnnotationsInput {
  return {
    resource: { repositoryRoot: '/workspace/repo', relativePath: 'main.ts' },
    documentVersion: 7,
    lineCount: 1,
    ignoreWhitespace: false,
    maxLines: 20_000,
  };
}

function createPort(
  result: Awaited<ReturnType<GitBlameDataPort['getAnnotations']>> = {
    status: 'unavailable',
    reason: 'untracked',
  },
): GitBlameDataPort & { readonly getAnnotations: ReturnType<typeof vi.fn> } {
  return { getAnnotations: vi.fn().mockResolvedValue(result) };
}

function context(): ToolExecutionContext {
  return {
    signal: { aborted: false },
    requestId: 'blame-test',
    source: 'extension-api',
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}
