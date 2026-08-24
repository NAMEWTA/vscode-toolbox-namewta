import { describe, expect, it } from 'vitest';
import type {
  GitReviewItem,
  GitReviewSession,
} from '../../core/domains/git-review/public-api';
import {
  createGitReviewNativeChanges,
  gitReviewInventoryIdentity,
} from './git-review-native-changes';

describe('Git Review 原生 Changes 资源', () => {
  it('按 layer/path 映射 added、deleted、renamed 和 conflict 的两侧', () => {
    const session = createSession([
      item('staged', 'added.ts', 'added'),
      item('unstaged', 'deleted.ts', 'deleted'),
      item('staged', 'new.ts', 'renamed'),
      item('conflict', 'conflicted.ts', 'conflicted'),
    ]);

    expect(createGitReviewNativeChanges(session)).toEqual([
      {
        labelPath: 'staged/added.ts',
        modified: { item: session.items[0], side: 'after' },
      },
      {
        labelPath: 'unstaged/deleted.ts',
        original: { item: session.items[1], side: 'before' },
      },
      {
        labelPath: 'staged/new.ts',
        original: { item: session.items[2], side: 'before' },
        modified: { item: session.items[2], side: 'after' },
      },
      {
        labelPath: 'conflict/conflicted.ts',
        modified: { item: session.items[3], side: 'after' },
      },
    ]);
  });

  it('审核状态变化不改变库存 identity，内容代际变化会改变', () => {
    const first = item('unstaged', 'main.ts', 'modified');
    const reviewed = { ...first, reviewState: 'reviewed' as const };
    const refreshed = { ...first, contentIdentity: 'b'.repeat(64) };

    expect(gitReviewInventoryIdentity(createSession([first]))).toBe(
      gitReviewInventoryIdentity(createSession([reviewed])),
    );
    expect(gitReviewInventoryIdentity(createSession([first]))).not.toBe(
      gitReviewInventoryIdentity(createSession([refreshed])),
    );
  });
});

function createSession(items: readonly GitReviewItem[]): GitReviewSession {
  const current = items[0];
  if (current === undefined) throw new Error('测试需要至少一个审核项。');
  return {
    repositoryRoot: '/repo',
    currentItemId: current.itemId,
    currentItemPath: current.path,
    items,
    progress: { total: items.length, reviewed: 0, skipped: 0, remaining: items.length },
  };
}

function item(
  layer: GitReviewItem['layer'],
  path: string,
  change: GitReviewItem['change'],
): GitReviewItem {
  return {
    itemId: `${layer}:${path}`,
    layer,
    path,
    contentIdentity: 'a'.repeat(64),
    change,
    presentation: 'text',
    reviewState: 'unreviewed',
  };
}
