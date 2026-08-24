import { describe, expect, it } from 'vitest';
import type { GitReviewItem } from '../../core/domains/git-review/public-api';
import {
  decodeGitReviewDocumentUri,
  GitReviewDocumentStore,
} from './git-review-document-uri';

describe('Git Review 文档 URI', () => {
  it('验证 URI 结构并拒绝伪造或未知令牌', () => {
    const store = new GitReviewDocumentStore(() => 'token');
    const item = createItem();
    const uri = store.createItemUri(item, 'after', 'unstaged/src/main.ts');

    expect(decodeGitReviewDocumentUri(uri)).toEqual({
      token: 'token',
      displayPath: 'unstaged/src/main.ts',
    });
    expect(() => store.resolve('file://token/summary')).toThrowError();
    expect(() =>
      store.resolve('vscode-toolbox-namewta-git-review://unknown/summary'),
    ).toThrowError();
    expect(() =>
      store.resolve('vscode-toolbox-namewta-git-review://token/summary?leak=true'),
    ).toThrowError();
  });

  it('item URI 显示 layer/path 且不暴露仓库和 content identity', () => {
    const store = new GitReviewDocumentStore(() => 'item-token');
    const item = createItem();

    const uri = store.createItemUri(item, 'before', 'staged/src/main.ts');

    expect(uri).toBe(
      'vscode-toolbox-namewta-git-review://item-token/staged/src/main.ts',
    );
    expect(uri).not.toContain(item.contentIdentity);
    expect(store.resolve(uri)).toEqual({ kind: 'item', item, side: 'before' });
  });

  it('清理后不再提供先前审核项的内容', () => {
    const store = new GitReviewDocumentStore(() => 'token');
    const uri = store.createItemUri(createItem(), 'before', 'staged/src/main.ts');

    store.clear();

    expect(() => store.resolve(uri)).toThrowError();
  });
});

function createItem(): GitReviewItem {
  return {
    itemId: 'staged:src/main.ts',
    layer: 'staged' as const,
    path: 'src/main.ts',
    contentIdentity: 'a'.repeat(64),
    change: 'modified' as const,
    presentation: 'text' as const,
    reviewState: 'unreviewed' as const,
  };
}
