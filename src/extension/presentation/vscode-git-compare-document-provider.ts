import * as vscode from 'vscode';
import {
  GIT_COMPARE_EMPTY_TREE_HASH,
  type GitCompareFileChange,
  type GitCompareRevisionInput,
} from '../../core/domains/git-compare/public-api';
import type { ToolboxGateway } from '../../core/orchestration/public-api';
import {
  GitCompareDocumentStore,
  GIT_COMPARE_DOCUMENT_SCHEME,
} from './git-compare-document-uri';

export class VscodeGitCompareDocumentProvider
  implements vscode.TextDocumentContentProvider, vscode.Disposable
{
  readonly #store = new GitCompareDocumentStore();
  readonly #activeRequests = new Set<AbortController>();
  #isDisposed = false;

  public constructor(private readonly gateway: ToolboxGateway) {}

  public createRevisionUri(input: GitCompareRevisionInput): vscode.Uri {
    this.assertAvailable();
    return vscode.Uri.parse(this.#store.createRevisionUri(input), true);
  }

  public createSummaryUri(summary: string): vscode.Uri {
    this.assertAvailable();
    return vscode.Uri.parse(this.#store.createSummaryUri(summary), true);
  }

  public async provideTextDocumentContent(
    uri: vscode.Uri,
    cancellationToken: vscode.CancellationToken,
  ): Promise<string> {
    this.assertAvailable();
    let entry: ReturnType<GitCompareDocumentStore['resolve']>;
    try {
      entry = this.#store.resolve(uri.toString(true));
    } catch {
      throw unavailableError();
    }
    if (entry.kind === 'summary') return entry.summary;
    const controller = new AbortController();
    this.#activeRequests.add(controller);
    const cancellation = cancellationToken.onCancellationRequested(() =>
      controller.abort(),
    );
    try {
      const result = await this.gateway.execute(
        'gitCompare.getRevisionContent',
        entry.input,
        {
          signal: controller.signal,
          source: 'extension-command',
        },
      );
      if (!result.ok) return summaryForResult('missing');
      if (result.data.kind !== 'text') return summaryForResult(result.data.reason);
      return result.data.content;
    } finally {
      cancellation.dispose();
      this.#activeRequests.delete(controller);
    }
  }

  public async openChangeDiff(
    resourceRoot: string,
    base: string,
    target: string,
    change: GitCompareFileChange,
  ): Promise<void> {
    const before = {
      repositoryRoot: resourceRoot,
      ref: change.status === 'added' ? GIT_COMPARE_EMPTY_TREE_HASH : base,
      path: change.previousPath ?? change.path,
    };
    const after = {
      repositoryRoot: resourceRoot,
      ref: change.status === 'deleted' ? GIT_COMPARE_EMPTY_TREE_HASH : target,
      path: change.path,
    };
    if (change.contentKind !== 'text') {
      await vscode.window.showTextDocument(
        this.createSummaryUri(
          [
            vscode.l10n.t('Git comparison file'),
            vscode.l10n.t('Path: {0}', change.path),
            vscode.l10n.t('Change: {0}', change.status),
            summaryForResult(
              change.contentKind === 'binary'
                ? 'binary'
                : change.contentKind === 'submodule'
                  ? 'submodule'
                  : 'too-large',
            ),
          ].join('\n'),
        ),
        { preview: true },
      );
      return;
    }
    await vscode.commands.executeCommand(
      'vscode.diff',
      this.createRevisionUri(before),
      this.createRevisionUri(after),
      vscode.l10n.t('Git comparison: {0}', change.path),
      { preview: true },
    );
  }

  public dispose(): void {
    this.#isDisposed = true;
    for (const request of this.#activeRequests) request.abort();
    this.#activeRequests.clear();
    this.#store.clear();
  }

  private assertAvailable(): void {
    if (this.#isDisposed) throw unavailableError();
  }
}

export { GIT_COMPARE_DOCUMENT_SCHEME };

function summaryForResult(
  reason: 'binary' | 'submodule' | 'too-large' | 'missing' | 'unavailable',
): string {
  switch (reason) {
    case 'binary':
      return vscode.l10n.t('This file is binary and cannot be shown as a text diff.');
    case 'submodule':
      return vscode.l10n.t(
        'This file is a submodule and cannot be shown as a text diff.',
      );
    case 'too-large':
      return vscode.l10n.t('This file is too large to display as text.');
    case 'missing':
      return vscode.l10n.t('This revision file is no longer available.');
    case 'unavailable':
      return vscode.l10n.t('This comparison file is unavailable.');
  }
}

function unavailableError(): Error {
  return new Error(vscode.l10n.t('Git comparison content is no longer available.'));
}
