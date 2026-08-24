import { describe, expect, it, vi } from 'vitest';
import {
  createGitReviewSessionCommands,
  GitReviewSessionCommand,
  type GitReviewSessionCommandAction,
  type GitReviewSessionCommandTarget,
} from './git-review-session-command';

const COMMANDS: readonly {
  readonly action: GitReviewSessionCommandAction;
  readonly id: string;
  readonly method: keyof GitReviewSessionCommandTarget;
}[] = [
  {
    action: 'start',
    id: 'vscodeToolboxNamewta.gitReview.start',
    method: 'start',
  },
  {
    action: 'previous',
    id: 'vscodeToolboxNamewta.gitReview.previous',
    method: 'previous',
  },
  {
    action: 'next',
    id: 'vscodeToolboxNamewta.gitReview.next',
    method: 'next',
  },
  {
    action: 'markReviewedAndNext',
    id: 'vscodeToolboxNamewta.gitReview.markReviewedAndNext',
    method: 'markReviewedAndNext',
  },
  {
    action: 'retry',
    id: 'vscodeToolboxNamewta.gitReview.retry',
    method: 'retry',
  },
  {
    action: 'skip',
    id: 'vscodeToolboxNamewta.gitReview.skip',
    method: 'skip',
  },
  {
    action: 'refresh',
    id: 'vscodeToolboxNamewta.gitReview.refresh',
    method: 'refresh',
  },
  {
    action: 'end',
    id: 'vscodeToolboxNamewta.gitReview.end',
    method: 'end',
  },
  {
    action: 'stageItem',
    id: 'vscodeToolboxNamewta.gitReview.stageItem',
    method: 'stageItem',
  },
  {
    action: 'unstageItem',
    id: 'vscodeToolboxNamewta.gitReview.unstageItem',
    method: 'unstageItem',
  },
  {
    action: 'discardItem',
    id: 'vscodeToolboxNamewta.gitReview.discardItem',
    method: 'discardItem',
  },
];

describe('Git Review 会话命令', () => {
  it.each(COMMANDS)('映射 $action 到公开命令并调用 $method', async (definition) => {
    const target = createTarget();
    const command = new GitReviewSessionCommand(definition.action, target);

    await command.execute();

    expect(command.id).toBe(definition.id);
    expect(target[definition.method]).toHaveBeenCalledTimes(1);
  });

  it('创建全部会话和条目命令', () => {
    const commands = createGitReviewSessionCommands(createTarget());

    expect(commands.map((command) => command.id)).toEqual(
      COMMANDS.map((definition) => definition.id),
    );
  });

  it('仅向启动命令转发 VS Code Source Control 上下文', async () => {
    const target = createTarget();
    const command = new GitReviewSessionCommand('start', target);
    const sourceControl = { id: 'git', label: 'Git' };

    await command.execute(sourceControl);

    expect(target.start).toHaveBeenCalledWith(sourceControl);
  });

  it('拒绝未验证的 VS Code 命令参数', () => {
    const target = createTarget();
    const command = new GitReviewSessionCommand('next', target);

    expect(() => command.execute({ invalid: true })).toThrowError(
      'Git Review command input is invalid.',
    );
    expect(target.next).not.toHaveBeenCalled();
  });
});

function createTarget(): GitReviewSessionCommandTarget & {
  readonly start: ReturnType<typeof vi.fn>;
  readonly previous: ReturnType<typeof vi.fn>;
  readonly next: ReturnType<typeof vi.fn>;
  readonly markReviewedAndNext: ReturnType<typeof vi.fn>;
  readonly retry: ReturnType<typeof vi.fn>;
  readonly skip: ReturnType<typeof vi.fn>;
  readonly refresh: ReturnType<typeof vi.fn>;
  readonly end: ReturnType<typeof vi.fn>;
  readonly stageItem: ReturnType<typeof vi.fn>;
  readonly unstageItem: ReturnType<typeof vi.fn>;
  readonly discardItem: ReturnType<typeof vi.fn>;
} {
  return {
    start: vi
      .fn<(...args: readonly unknown[]) => Promise<void>>()
      .mockResolvedValue(undefined),
    previous: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    next: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    markReviewedAndNext: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    retry: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    skip: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    refresh: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    end: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    stageItem: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    unstageItem: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    discardItem: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}
