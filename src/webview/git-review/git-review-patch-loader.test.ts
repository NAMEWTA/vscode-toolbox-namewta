import { describe, expect, it, vi } from 'vitest';
import type { ToolResult } from '../../core/contracts';
import type { GitReviewItemPatch } from '../../core/domains/git-review/public-api';
import type { ToolMessageClient } from '../platform/webview-message-client';
import { GitReviewPatchLoader } from './git-review-patch-loader';

describe('GitReviewPatchLoader', () => {
  it('limits patch reads to two and cancels all remaining work on dispose', async () => {
    const resolvers: ((result: ToolResult<GitReviewItemPatch>) => void)[] = [];
    const execute = vi.fn(
      () =>
        new Promise<ToolResult<GitReviewItemPatch>>((resolve) => {
          resolvers.push(resolve);
        }),
    ) as unknown as ToolMessageClient['execute'];
    const loader = new GitReviewPatchLoader({ execute }, 2);

    const first = loader.load(input('first.ts'));
    const second = loader.load(input('second.ts'));
    const third = loader.load(input('third.ts'));
    expect(execute).toHaveBeenCalledTimes(2);

    resolvers[0]?.(emptyPatch());
    await expect(first).resolves.toEqual(emptyPatch());
    expect(execute).toHaveBeenCalledTimes(3);

    loader.dispose();
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    await expect(third).rejects.toMatchObject({ name: 'AbortError' });
  });
});

function input(path: string): {
  readonly itemId: string;
  readonly contentIdentity: string;
} {
  return { itemId: `unstaged:${path}`, contentIdentity: 'a'.repeat(64) };
}

function emptyPatch(): ToolResult<GitReviewItemPatch> {
  return {
    ok: true,
    data: { kind: 'patch', additions: 0, deletions: 0, hunks: [] },
  };
}
