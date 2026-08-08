import { describe, expect, it, vi } from 'vitest';
import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import { CopyReferenceHandler } from './copy-reference-handler';
import type { ClipboardPort, CopyReferenceInput } from './copy-reference-model';

describe('CopyReferenceHandler', () => {
  it('writes the formatted reference and returns the exact written text', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();
    const handler = new CopyReferenceHandler({ writeText } satisfies ClipboardPort);

    const result = await handler.execute(input(), context());

    expect(result).toBe('`src/main.ts:1`');
    expect(writeText).toHaveBeenCalledWith(result);
  });

  it('does not write when execution was already cancelled', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();
    const handler = new CopyReferenceHandler({ writeText } satisfies ClipboardPort);

    await expect(
      handler.execute(input(), { ...context(), signal: { aborted: true } }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(writeText).not.toHaveBeenCalled();
  });
});

function input(): CopyReferenceInput {
  return {
    mode: 'relative',
    source: {
      kind: 'editor',
      resource: {
        scheme: 'file',
        authority: '',
        path: '/workspace/src/main.ts',
        absolute: '/workspace/src/main.ts',
      },
      selection: {
        anchor: { line: 0, character: 0 },
        active: { line: 0, character: 0 },
      },
    },
    workspaceFolders: [
      {
        scheme: 'file',
        authority: '',
        path: '/workspace',
        absolute: '/workspace',
      },
    ],
  };
}

function context(): ToolExecutionContext {
  return {
    signal: { aborted: false },
    requestId: 'copy-test',
    source: 'extension-command',
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}
