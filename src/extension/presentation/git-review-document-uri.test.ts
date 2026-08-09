import { describe, expect, it } from 'vitest';
import {
  decodeGitReviewDocumentUri,
  GitReviewDocumentStore,
} from './git-review-document-uri';

describe('Git Review 文档 URI', () => {
  it('用随机令牌存储前后内容且 URI 不暴露仓库路径', () => {
    const store = new GitReviewDocumentStore(
      () => '11111111-1111-4111-8111-111111111111',
    );
    const documents = store.createTextUris('/private/repository before', 'after');

    expect(documents.before).toBe(
      'vscode-toolbox-namewta-git-review://11111111-1111-4111-8111-111111111111/before',
    );
    expect(documents.before).not.toContain('/private/repository');
    expect(store.resolve(documents.before)).toBe('/private/repository before');
    expect(store.resolve(documents.after)).toBe('after');
  });

  it('验证 URI 结构并拒绝伪造或未知令牌', () => {
    const store = new GitReviewDocumentStore(() => 'token');
    const summary = store.createSummaryUri('Binary file');

    expect(decodeGitReviewDocumentUri(summary)).toEqual({
      token: 'token',
      side: 'summary',
    });
    expect(() => store.resolve('file://token/summary')).toThrowError();
    expect(() =>
      store.resolve('vscode-toolbox-namewta-git-review://unknown/summary'),
    ).toThrowError();
    expect(() =>
      store.resolve('vscode-toolbox-namewta-git-review://token/summary?leak=true'),
    ).toThrowError();
  });

  it('清理后不再提供先前审核项的内容', () => {
    const store = new GitReviewDocumentStore(() => 'token');
    const documents = store.createTextUris('before', 'after');

    store.clear();

    expect(() => store.resolve(documents.before)).toThrowError();
  });
});
