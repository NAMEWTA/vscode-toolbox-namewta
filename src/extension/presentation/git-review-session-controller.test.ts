import { describe, expect, it, vi } from 'vitest';
import type {
  GitReviewItem,
  GitReviewSession,
  GitReviewSessionSnapshot,
} from '../../core/domains/git-review/public-api';
import type { ToolboxGateway } from '../../core/orchestration/public-api';
import { GitReviewSessionController } from './git-review-session-controller';
import type {
  GitReviewControllerHost,
  GitReviewPresentation,
  GitReviewRepositoryResolver,
  GitReviewWatcherFactory,
} from './git-review-session-controller-contract';

describe('Git Review 原生 Changes 定位', () => {
  it('原生 Changes 接管文件呈现时，普通导航不主动读取 Diff 内容', async () => {
    const gateway = createGateway();
    const initial = activeSnapshot('alpha.ts', [item('alpha.ts')]);
    gateway.execute.mockResolvedValueOnce(success(initial));
    const dependencies = createDependencies(gateway);
    dependencies.presentation.focusItem.mockReturnValue(true);
    const controller = new GitReviewSessionController(dependencies);

    await controller.start();

    expect(dependencies.presentation.focusItem).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'unstaged:alpha.ts' }),
    );
    expect(gateway.execute).toHaveBeenCalledTimes(1);
  });
});

describe('Git Review 会话控制器', () => {
  it('启动后投影视图并打开首个文本项，导航不改变处理状态', async () => {
    const gateway = createGateway();
    const initial = activeSnapshot('alpha.ts', [item('alpha.ts'), item('beta.ts')]);
    const navigated = activeSnapshot('beta.ts', [item('alpha.ts'), item('beta.ts')]);
    gateway.execute
      .mockResolvedValueOnce(success(initial))
      .mockResolvedValueOnce(success(navigated));
    const dependencies = createDependencies(gateway);
    const controller = new GitReviewSessionController(dependencies);

    await controller.start();
    await controller.next();

    expect(dependencies.repositoryResolver.resolve).toHaveBeenCalledWith(
      [],
      expect.any(AbortSignal),
    );
    expect(gateway.execute).toHaveBeenNthCalledWith(
      1,
      'gitReview.start',
      { repositoryRoot: '/workspace/repository', replace: false },
      expect.objectContaining({ source: 'extension-command' }),
    );
    expect(gateway.execute).toHaveBeenNthCalledWith(
      2,
      'gitReview.next',
      {},
      expect.objectContaining({ source: 'extension-command' }),
    );
    expect(dependencies.presentation.focusItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'beta.ts', reviewState: 'unreviewed' }),
    );
    expect(dependencies.presentation.render).toHaveBeenLastCalledWith(navigated);
  });

  it('在用户取消替换时保留现有会话且不发出新的 start', async () => {
    const gateway = createGateway();
    const initial = activeSnapshot('alpha.ts', [item('alpha.ts')]);
    gateway.execute.mockResolvedValueOnce(success(initial));
    const dependencies = createDependencies(gateway);
    dependencies.host.confirmReplace.mockResolvedValue(false);
    const controller = new GitReviewSessionController(dependencies);

    await controller.start();
    await controller.start();

    expect(dependencies.host.confirmReplace).toHaveBeenCalledTimes(1);
    expect(gateway.execute).toHaveBeenCalledTimes(1);
    expect(dependencies.presentation.render).toHaveBeenLastCalledWith(initial);
  });

  it('监听工作树变化进入 stale，刷新后保留控制器并重新打开当前项', async () => {
    const gateway = createGateway();
    const initial = activeSnapshot('alpha.ts', [item('alpha.ts')]);
    const stale: GitReviewSessionSnapshot = {
      state: 'stale',
      session: initial.session,
    };
    const refreshed = activeSnapshot('alpha.ts', [item('alpha.ts', 'b'.repeat(64))]);
    gateway.execute
      .mockResolvedValueOnce(success(initial))
      .mockResolvedValueOnce(success(stale))
      .mockResolvedValueOnce(success(refreshed));
    const dependencies = createDependencies(gateway);
    const controller = new GitReviewSessionController(dependencies);

    await controller.start();
    await dependencies.watch.trigger();
    await controller.refresh();

    expect(gateway.execute).toHaveBeenNthCalledWith(
      2,
      'gitReview.markStale',
      {},
      expect.objectContaining({ source: 'extension-command' }),
    );
    expect(gateway.execute).toHaveBeenNthCalledWith(
      3,
      'gitReview.refresh',
      {},
      expect.objectContaining({ source: 'extension-command' }),
    );
    expect(dependencies.host.showStale).toHaveBeenCalledTimes(1);
    expect(dependencies.presentation.focusItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ contentIdentity: 'b'.repeat(64) }),
    );
  });

  it('释放不会清空已投影队列，并取消 watcher', async () => {
    const gateway = createGateway();
    const initial = activeSnapshot('alpha.ts', [item('alpha.ts')]);
    gateway.execute.mockResolvedValueOnce(success(initial));
    const dependencies = createDependencies(gateway);
    const controller = new GitReviewSessionController(dependencies);

    await controller.start();
    controller.dispose();

    expect(dependencies.presentation.render).toHaveBeenCalledWith(initial);
    expect(dependencies.watch.dispose).toHaveBeenCalledTimes(1);
    expect(dependencies.presentation.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('Git Review 会话结束', () => {
  it('取消结束确认时保留当前队列且不发送 end', async () => {
    const gateway = createGateway();
    const initial = activeSnapshot('alpha.ts', [item('alpha.ts')]);
    gateway.execute.mockResolvedValueOnce(success(initial));
    const dependencies = createDependencies(gateway);
    dependencies.host.confirmEnd.mockResolvedValue(false);
    const controller = new GitReviewSessionController(dependencies);

    await controller.start();
    await controller.end();

    expect(dependencies.host.confirmEnd).toHaveBeenCalledTimes(1);
    expect(gateway.execute).toHaveBeenCalledTimes(1);
    expect(dependencies.presentation.render).toHaveBeenLastCalledWith(initial);
  });
});

describe('Git Review 会话替换', () => {
  it('确认替换后先释放旧 watcher 和队列投影，再启动新会话', async () => {
    const gateway = createGateway();
    const initial = activeSnapshot('alpha.ts', [item('alpha.ts')]);
    const replacement = activeSnapshot('beta.ts', [item('beta.ts', 'b'.repeat(64))]);
    gateway.execute
      .mockResolvedValueOnce(success(initial))
      .mockResolvedValueOnce(success(replacement));
    const dependencies = createDependencies(gateway);
    const controller = new GitReviewSessionController(dependencies);

    await controller.start();
    await controller.start();

    expect(dependencies.watch.dispose).toHaveBeenCalledTimes(1);
    expect(dependencies.presentation.render).toHaveBeenNthCalledWith(2, {
      state: 'inactive',
    });
    expect(gateway.execute).toHaveBeenNthCalledWith(
      2,
      'gitReview.start',
      { repositoryRoot: '/workspace/repository', replace: true },
      expect.objectContaining({ source: 'extension-command' }),
    );
  });
});

describe('Git Review 队列选择', () => {
  it('直接跳转只执行普通导航，不改变条目处理状态', async () => {
    const gateway = createGateway();
    const first = activeSnapshot('alpha.ts', [
      item('alpha.ts'),
      item('beta.ts'),
      item('gamma.ts'),
    ]);
    const second = activeSnapshot('beta.ts', first.session.items);
    const third = activeSnapshot('gamma.ts', first.session.items);
    gateway.execute
      .mockResolvedValueOnce(success(first))
      .mockResolvedValueOnce(success(second))
      .mockResolvedValueOnce(success(third));
    const dependencies = createDependencies(gateway);
    const controller = new GitReviewSessionController(dependencies);

    await controller.start();
    await controller.select(first.session.items[2]!);

    expect(gateway.execute).toHaveBeenNthCalledWith(
      2,
      'gitReview.next',
      {},
      expect.objectContaining({ source: 'extension-command' }),
    );
    expect(gateway.execute).toHaveBeenNthCalledWith(
      3,
      'gitReview.next',
      {},
      expect.objectContaining({ source: 'extension-command' }),
    );
    expect(gateway.execute).not.toHaveBeenCalledWith(
      'gitReview.markReviewedAndNext',
      expect.anything(),
      expect.anything(),
    );
    expect(first.session.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'alpha.ts', reviewState: 'unreviewed' }),
        expect.objectContaining({ path: 'gamma.ts', reviewState: 'unreviewed' }),
      ]),
    );
  });
});

describe('Git Review 会话完成', () => {
  it('显示区分处理状态的总结后清理队列投影和 watcher', async () => {
    const gateway = createGateway();
    const initial = activeSnapshot('alpha.ts', [item('alpha.ts')]);
    const summary = { total: 1, reviewed: 1, skipped: 0 };
    gateway.execute
      .mockResolvedValueOnce(success(initial))
      .mockResolvedValueOnce(success({ state: 'completed', summary }));
    const dependencies = createDependencies(gateway);
    const controller = new GitReviewSessionController(dependencies);

    await controller.start();
    await controller.markReviewedAndNext();

    expect(dependencies.host.showSummary).toHaveBeenCalledWith(summary);
    expect(dependencies.presentation.render).toHaveBeenLastCalledWith({
      state: 'inactive',
    });
    expect(dependencies.watch.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('Git Review 队列条目写操作', () => {
  it('只把当前库存中 identity 一致的条目转成 typed Gateway 输入', async () => {
    const gateway = createGateway();
    const initial = activeSnapshot('alpha.ts', [item('alpha.ts')]);
    const refreshed = activeSnapshot('alpha.ts', [item('alpha.ts', 'b'.repeat(64))]);
    gateway.execute
      .mockResolvedValueOnce(success(initial))
      .mockResolvedValueOnce(success(refreshed));
    const dependencies = createDependencies(gateway);
    const controller = new GitReviewSessionController(dependencies);

    await controller.start();
    await controller.stageItem({ item: initial.session.items[0] });

    expect(gateway.execute).toHaveBeenNthCalledWith(
      2,
      'gitReview.stageItem',
      {
        itemId: 'unstaged:alpha.ts',
        contentIdentity: 'a'.repeat(64),
      },
      expect.objectContaining({ source: 'extension-command' }),
    );
    await controller.unstageItem({ item: initial.session.items[0] });
    expect(gateway.execute).toHaveBeenCalledTimes(2);
    expect(dependencies.host.reportFailure).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'invalid-input' }),
    );
  });

  it('用户取消 Discard 时不执行 Git 写操作', async () => {
    const gateway = createGateway();
    const initial = activeSnapshot('alpha.ts', [item('alpha.ts')]);
    gateway.execute.mockResolvedValueOnce(success(initial));
    const dependencies = createDependencies(gateway);
    dependencies.host.confirmDiscard.mockResolvedValue(false);
    const controller = new GitReviewSessionController(dependencies);

    await controller.start();
    await controller.discardItem({ item: initial.session.items[0] });

    expect(dependencies.host.confirmDiscard).toHaveBeenCalledWith('alpha.ts');
    expect(gateway.execute).toHaveBeenCalledTimes(1);
  });
});

function createDependencies(gateway: ToolboxGateway): {
  readonly gateway: ToolboxGateway;
  readonly repositoryResolver: GitReviewRepositoryResolver & {
    readonly resolve: ReturnType<typeof vi.fn>;
  };
  readonly presentation: GitReviewPresentation & {
    readonly render: ReturnType<typeof vi.fn>;
    readonly focusItem: ReturnType<typeof vi.fn>;
    readonly dispose: ReturnType<typeof vi.fn>;
  };
  readonly host: GitReviewControllerHost & {
    readonly confirmReplace: ReturnType<typeof vi.fn>;
    readonly confirmEnd: ReturnType<typeof vi.fn>;
    readonly confirmDiscard: ReturnType<typeof vi.fn>;
    readonly reportFailure: ReturnType<typeof vi.fn>;
    readonly showStale: ReturnType<typeof vi.fn>;
    readonly showSummary: ReturnType<typeof vi.fn>;
  };
  readonly watch: {
    readonly trigger: () => Promise<void>;
    readonly dispose: ReturnType<typeof vi.fn>;
  };
  readonly watcherFactory: GitReviewWatcherFactory;
} {
  const watch = {
    handler: undefined as (() => Promise<void>) | undefined,
    dispose: vi.fn(),
    trigger: async (): Promise<void> => watch.handler?.(),
  };
  const repositoryResolver = {
    resolve: vi
      .fn<GitReviewRepositoryResolver['resolve']>()
      .mockResolvedValue('/workspace/repository'),
  } satisfies GitReviewRepositoryResolver;
  const presentation = {
    render: vi.fn<(snapshot: GitReviewSessionSnapshot) => void>(),
    focusItem: vi.fn<(item: GitReviewItem) => boolean>().mockReturnValue(false),
    dispose: vi.fn<() => void>(),
  } satisfies GitReviewPresentation;
  const host = {
    confirmReplace: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    confirmEnd: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    confirmDiscard: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    reportFailure: vi
      .fn<GitReviewControllerHost['reportFailure']>()
      .mockResolvedValue(undefined),
    showStale: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    showSummary: vi
      .fn<GitReviewControllerHost['showSummary']>()
      .mockResolvedValue(undefined),
  } satisfies GitReviewControllerHost;
  const watcherFactory: GitReviewWatcherFactory = (_root, handler) => {
    watch.handler = handler;
    return watch;
  };
  return {
    gateway,
    repositoryResolver,
    presentation,
    host,
    watch,
    watcherFactory,
  };
}

function createGateway(): ToolboxGateway & {
  readonly execute: ReturnType<typeof vi.fn>;
} {
  return {
    execute: vi.fn(),
    getCapabilities: vi.fn(),
  } as unknown as ToolboxGateway & { readonly execute: ReturnType<typeof vi.fn> };
}

function activeSnapshot(
  currentItemPath: string,
  items: readonly GitReviewItem[],
): { readonly state: 'active'; readonly session: GitReviewSession } {
  return {
    state: 'active',
    session: {
      repositoryRoot: '/workspace/repository',
      currentItemId:
        items.find((candidate) => candidate.path === currentItemPath)?.itemId ?? '',
      currentItemPath,
      items,
      progress: {
        total: items.length,
        reviewed: 0,
        skipped: 0,
        remaining: items.length,
      },
    },
  };
}

function item(path: string, contentIdentity = 'a'.repeat(64)): GitReviewItem {
  return {
    itemId: `unstaged:${path}`,
    layer: 'unstaged',
    path,
    contentIdentity,
    change: 'modified',
    presentation: 'text',
    reviewState: 'unreviewed',
  };
}

function success<TData>(data: TData): { readonly ok: true; readonly data: TData } {
  return { ok: true, data };
}
