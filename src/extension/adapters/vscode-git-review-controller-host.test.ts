import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolLogger } from '../../core/orchestration/public-api';
import { VscodeGitReviewControllerHost } from './vscode-git-review-controller-host';

const vscodeState = vi.hoisted(() => ({
  showErrorMessage: vi.fn(),
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
}));

vi.mock('vscode', () => ({
  l10n: {
    t: (message: string, ...values: readonly unknown[]): string =>
      values.reduce<string>(
        (text, value, index) => text.replace(`{${String(index)}}`, String(value)),
        message,
      ),
  },
  window: vscodeState,
}));

beforeEach(() => {
  vscodeState.showErrorMessage.mockResolvedValue(undefined);
  vscodeState.showInformationMessage.mockResolvedValue(undefined);
  vscodeState.showWarningMessage.mockResolvedValue(undefined);
});

describe('VS Code Git Review 反馈宿主', () => {
  it('用确认选项控制替换和结束', async () => {
    const logger = createLogger();
    const host = new VscodeGitReviewControllerHost(logger, vi.fn());
    vscodeState.showWarningMessage
      .mockResolvedValueOnce('Replace')
      .mockResolvedValueOnce(undefined);

    await expect(host.confirmReplace()).resolves.toBe(true);
    await expect(host.confirmEnd()).resolves.toBe(false);
  });

  it('只有明确确认后才允许放弃指定文件的工作树变更', async () => {
    const host = new VscodeGitReviewControllerHost(createLogger(), vi.fn());
    vscodeState.showWarningMessage.mockResolvedValueOnce('Discard Changes');

    await expect(host.confirmDiscard('src/main.ts')).resolves.toBe(true);
    expect(vscodeState.showWarningMessage).toHaveBeenCalledWith(
      'Discard all working tree changes in src/main.ts? This cannot be undone.',
      { modal: true },
      'Discard Changes',
    );
  });

  it('用结构化错误记录失败且允许打开日志', async () => {
    const logger = createLogger();
    const showLog = vi.fn();
    const host = new VscodeGitReviewControllerHost(logger, showLog);
    vscodeState.showErrorMessage.mockResolvedValue('Open Log');

    await host.reportFailure({
      code: 'capability-unavailable',
      message: '/private/repository must not be logged',
      retryable: true,
    });

    expect(logger.error).toHaveBeenCalledWith('Git Review action failed.', undefined, {
      code: 'capability-unavailable',
      retryable: true,
    });
    expect(vscodeState.showErrorMessage).toHaveBeenCalledWith(
      'Git Review is unavailable for the current repository.',
      'Open Log',
    );
    expect(showLog).toHaveBeenCalledTimes(1);
  });

  it('为结构化空变更原因显示可行动提示', async () => {
    const host = new VscodeGitReviewControllerHost(createLogger(), vi.fn());

    await host.reportFailure({
      code: 'capability-unavailable',
      message: 'No changes.',
      retryable: false,
      details: { reason: 'no-changes' },
    });

    expect(vscodeState.showErrorMessage).toHaveBeenCalledWith(
      'No Git changes are available to review.',
      'Open Log',
    );
  });

  it('显示 stale 提示和区分状态的完成总结', async () => {
    const host = new VscodeGitReviewControllerHost(createLogger(), vi.fn());

    await host.showStale();
    await host.showSummary({ total: 4, reviewed: 3, skipped: 1 });

    expect(vscodeState.showWarningMessage).toHaveBeenCalledWith(
      'Git Review queue is stale. Refresh it before continuing.',
    );
    expect(vscodeState.showInformationMessage).toHaveBeenCalledWith(
      'Git Review complete: 3 reviewed, 1 skipped, 4 total.',
    );
  });
});

function createLogger(): ToolLogger & {
  readonly debug: ReturnType<typeof vi.fn>;
  readonly info: ReturnType<typeof vi.fn>;
  readonly warn: ReturnType<typeof vi.fn>;
  readonly error: ReturnType<typeof vi.fn>;
} {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}
