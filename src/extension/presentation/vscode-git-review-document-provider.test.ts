import { describe, expect, it, vi } from 'vitest';
import type { GitReviewItem } from '../../core/domains/git-review/public-api';
import type { ToolboxGateway } from '../../core/orchestration/public-api';
import { VscodeGitReviewDocumentProvider } from './vscode-git-review-document-provider';

vi.mock('vscode', () => ({
  Uri: {
    parse: (value: string) => ({
      toString: (): string => value,
    }),
  },
  l10n: { t: (value: string): string => value },
}));

describe('VS Code Git Review 文档 Provider', () => {
  it('释放后拒绝全部 Review 文档请求', async () => {
    const provider = new VscodeGitReviewDocumentProvider({
      execute: vi.fn(),
    } as unknown as ToolboxGateway);
    const uri = provider.createItemUri(
      createItem('unstaged:src/main.ts', 'src/main.ts', 'a'),
      'after',
      'unstaged/src/main.ts',
    );

    provider.dispose();

    await expect(provider.provideTextDocumentContent(uri)).rejects.toThrow(
      'Git Review content is no longer available.',
    );
  });

  it('延迟读取 item 内容并在两侧共享一次 Gateway 请求，clear 后旧 token 失效', async () => {
    const execute = vi.fn().mockResolvedValue({
      ok: true,
      data: { kind: 'text', before: 'HEAD', after: 'worktree' },
    });
    const provider = new VscodeGitReviewDocumentProvider({
      execute,
    } as unknown as ToolboxGateway);
    const item = createItem('unstaged:src/main.ts', 'src/main.ts', 'a');
    const before = provider.createItemUri(item, 'before', 'unstaged/src/main.ts');
    const after = provider.createItemUri(item, 'after', 'unstaged/src/main.ts');

    await expect(
      Promise.all([
        provider.provideTextDocumentContent(before),
        provider.provideTextDocumentContent(after),
      ]),
    ).resolves.toEqual(['HEAD', 'worktree']);
    expect(execute).toHaveBeenCalledTimes(1);

    provider.clear();
    await expect(provider.provideTextDocumentContent(before)).rejects.toThrow(
      'Git Review content is no longer available.',
    );
  });

  it('刷新代际拒绝旧 lazy 请求把迟到内容写回 cache', async () => {
    let settle: ((value: unknown) => void) | undefined;
    const execute = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    const provider = new VscodeGitReviewDocumentProvider({
      execute,
    } as unknown as ToolboxGateway);
    const item = createItem('unstaged:src/late.ts', 'src/late.ts', 'b');
    const uri = provider.createItemUri(item, 'after', 'unstaged/src/late.ts');
    const pending = provider.provideTextDocumentContent(uri);

    provider.clear();
    settle?.({
      ok: true,
      data: { kind: 'text', before: 'old', after: 'late' },
    });

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

function createItem(
  itemId: string,
  path: string,
  identityCharacter: string,
): GitReviewItem {
  return {
    itemId,
    layer: 'unstaged' as const,
    path,
    contentIdentity: identityCharacter.repeat(64),
    change: 'modified' as const,
    presentation: 'text' as const,
    reviewState: 'unreviewed' as const,
  };
}
