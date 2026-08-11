import * as vscode from 'vscode';
import type { GitReviewSessionSnapshot } from '../../core/domains/git-review/public-api';
import { getGitReviewSession } from './git-review-session-snapshot';

export class VscodeGitReviewStatusBar implements vscode.Disposable {
  readonly #item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );

  public render(snapshot: GitReviewSessionSnapshot): void {
    const session = getGitReviewSession(snapshot);
    if (session === undefined) {
      this.#item.hide();
      return;
    }
    const currentIndex = session.items.findIndex(
      (item) => item.itemId === session.currentItemId,
    );
    const position = currentIndex < 0 ? 0 : currentIndex + 1;
    const { progress } = session;
    const staleSuffix =
      snapshot.state === 'stale' ? ` - ${vscode.l10n.t('Refresh required')}` : '';
    this.#item.name = vscode.l10n.t('Git Review progress');
    this.#item.text = vscode.l10n.t(
      'Git Review: {0}/{1}, {2} remaining{3}',
      position,
      progress.total,
      progress.remaining,
      staleSuffix,
    );
    this.#item.tooltip = vscode.l10n.t(
      'Git Review: {0} reviewed, {1} skipped, {2} remaining',
      progress.reviewed,
      progress.skipped,
      progress.remaining,
    );
    this.#item.accessibilityInformation = { label: this.#item.text };
    this.#item.show();
  }

  public dispose(): void {
    this.#item.dispose();
  }
}
