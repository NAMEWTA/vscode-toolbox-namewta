import { describe, expect, it, vi } from 'vitest';
import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import {
  GitCopyCommitHashHandler,
  type GitCommitHashClipboardPort,
} from './git-copy-commit-hash-handler';

const hash = 'a'.repeat(40);

describe('GitCopyCommitHashHandler', () => {
  it('writes the validated full hash and returns it', async () => {
    const writeText = vi.fn<GitCommitHashClipboardPort['writeText']>();
    const handler = new GitCopyCommitHashHandler({ writeText });

    await expect(handler.execute({ hash }, context(false))).resolves.toBe(hash);
    expect(writeText).toHaveBeenCalledWith(hash);
  });

  it('does not touch the clipboard after cancellation', async () => {
    const writeText = vi.fn<GitCommitHashClipboardPort['writeText']>();
    const handler = new GitCopyCommitHashHandler({ writeText });

    await expect(handler.execute({ hash }, context(true))).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(writeText).not.toHaveBeenCalled();
  });
});

function context(aborted: boolean): ToolExecutionContext {
  return {
    signal: { aborted },
    requestId: 'copy-hash-test',
    source: 'extension-command',
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}
