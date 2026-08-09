import { describe, expect, it, vi } from 'vitest';
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
  it('只保留当前项的只读文档内容', () => {
    const provider = new VscodeGitReviewDocumentProvider();
    const first = provider.createTextUris('before', 'after');
    const summary = provider.createSummaryUri('Binary file');

    expect(provider.provideTextDocumentContent(summary)).toBe('Binary file');
    expect(() => provider.provideTextDocumentContent(first.before)).toThrowError(
      'Git Review content is no longer available.',
    );
  });

  it('释放后拒绝全部 Review 文档请求', () => {
    const provider = new VscodeGitReviewDocumentProvider();
    const documents = provider.createTextUris('before', 'after');

    provider.dispose();

    expect(() => provider.provideTextDocumentContent(documents.after)).toThrowError(
      'Git Review content is no longer available.',
    );
  });
});
