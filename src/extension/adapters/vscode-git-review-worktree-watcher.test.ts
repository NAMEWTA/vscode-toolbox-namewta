import { describe, expect, it, vi } from 'vitest';
import {
  VscodeGitReviewWorktreeWatcher,
  type GitReviewWorktreeFileWatcher,
  type GitReviewWorktreeWatcherHost,
} from './vscode-git-review-worktree-watcher';

vi.mock('vscode', () => ({ workspace: {} }));

describe('VS Code Git Review 工作树监听器', () => {
  it('将创建、修改和删除事件转为同一个 stale 回调并在释放时取消订阅', async () => {
    const watch = createWatcher();
    const host: GitReviewWorktreeWatcherHost = {
      createWatcher: vi.fn(() => watch),
    };
    const onChange = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const watcher = new VscodeGitReviewWorktreeWatcher(
      '/workspace/repository',
      onChange,
      host,
    );

    await watch.triggerAll();
    watcher.dispose();

    expect(onChange).toHaveBeenCalledTimes(3);
    expect(watch.dispose).toHaveBeenCalledTimes(1);
    expect(watch.subscriptionDisposals).toHaveBeenCalledTimes(3);
  });

  it('拒绝不安全的仓库根路径', () => {
    expect(
      () =>
        new VscodeGitReviewWorktreeWatcher(
          '../repository',
          vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
          { createWatcher: vi.fn() },
        ),
    ).toThrowError('Git Review repository root is invalid.');
  });
});

function createWatcher(): GitReviewWorktreeFileWatcher & {
  readonly dispose: ReturnType<typeof vi.fn>;
  readonly subscriptionDisposals: ReturnType<typeof vi.fn>;
  readonly triggerAll: () => Promise<void>;
} {
  const listeners: (() => void)[] = [];
  const subscriptionDisposals = vi.fn();
  const addListener = (listener: () => void): { dispose(): void } => {
    listeners.push(listener);
    return { dispose: subscriptionDisposals };
  };
  return {
    onDidCreate: addListener,
    onDidChange: addListener,
    onDidDelete: addListener,
    dispose: vi.fn(),
    subscriptionDisposals,
    triggerAll: async (): Promise<void> => {
      for (const listener of listeners) {
        listener();
      }
      await Promise.resolve();
    },
  };
}
