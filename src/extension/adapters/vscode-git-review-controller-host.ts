import * as vscode from 'vscode';
import type { ToolError } from '../../core/contracts/tool-error-contract';
import type { GitReviewSummary } from '../../core/domains/git-review/public-api';
import type { ToolLogger } from '../../core/orchestration/public-api';
import type { GitReviewControllerHost } from '../presentation/git-review-session-controller-contract';

export class VscodeGitReviewControllerHost implements GitReviewControllerHost {
  public constructor(
    private readonly logger: ToolLogger,
    private readonly showLog: () => void,
  ) {}

  public async confirmReplace(): Promise<boolean> {
    const replace = vscode.l10n.t('Replace');
    const selected = await vscode.window.showWarningMessage(
      vscode.l10n.t('A Git Review session is already active. Replace it?'),
      { modal: true },
      replace,
    );
    return selected === replace;
  }

  public async confirmEnd(): Promise<boolean> {
    const end = vscode.l10n.t('End Review');
    const selected = await vscode.window.showWarningMessage(
      vscode.l10n.t(
        'End the current Git Review session? Unreviewed items will remain unreviewed.',
      ),
      { modal: true },
      end,
    );
    return selected === end;
  }

  public async reportFailure(error: ToolError): Promise<void> {
    this.logger.error('Git Review action failed.', undefined, {
      code: error.code,
      retryable: error.retryable,
    });
    const openLog = vscode.l10n.t('Open Log');
    const selected = await vscode.window.showErrorMessage(
      failureMessage(error),
      openLog,
    );
    if (selected === openLog) {
      this.showLog();
    }
  }

  public async showStale(): Promise<void> {
    await vscode.window.showWarningMessage(
      vscode.l10n.t('Git Review queue is stale. Refresh it before continuing.'),
    );
  }

  public async showSummary(summary: GitReviewSummary): Promise<void> {
    await vscode.window.showInformationMessage(
      vscode.l10n.t(
        'Git Review complete: {0} reviewed, {1} skipped, {2} total.',
        summary.reviewed,
        summary.skipped,
        summary.total,
      ),
    );
  }
}

function failureMessage(error: ToolError): string {
  switch (error.code) {
    case 'permission-denied':
      return vscode.l10n.t('Git Review requires a trusted workspace.');
    case 'capability-unavailable':
      if (error.details?.reason === 'no-changes') {
        return vscode.l10n.t('No Git changes are available to review.');
      }
      return vscode.l10n.t('Git Review is unavailable for the current repository.');
    case 'timeout':
      return vscode.l10n.t('Git Review timed out. Try again.');
    case 'not-found':
      return vscode.l10n.t('No Git Review session is active.');
    case 'invalid-input':
      return vscode.l10n.t('Git Review command input is invalid.');
    case 'cancelled':
      return vscode.l10n.t('Git Review was cancelled.');
    case 'internal-error':
      return vscode.l10n.t('Git Review failed. See the output log for details.');
  }
}
