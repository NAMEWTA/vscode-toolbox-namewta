import * as vscode from 'vscode';
import {
  type GitCompareRevisionInput,
  type GitCompareResult,
} from '../../core/domains/git-compare/public-api';
import type { ToolboxGateway } from '../../core/orchestration/public-api';
import {
  GitCompareDocumentStore,
  GIT_COMPARE_DOCUMENT_SCHEME,
} from './git-compare-document-uri';
import {
  createGitCompareNativeChanges,
  type GitCompareNativeDocument,
} from './git-compare-native-changes';
import { VscodeNativeChangesPresenter } from './vscode-native-changes-presenter';

export class VscodeGitCompareDocumentProvider
  implements vscode.TextDocumentContentProvider, vscode.Disposable
{
  readonly #store = new GitCompareDocumentStore();
  readonly #activeRequests = new Set<AbortController>();
  #isDisposed = false;

  public constructor(
    private readonly gateway: ToolboxGateway,
    private readonly nativeChanges = new VscodeNativeChangesPresenter(),
  ) {}

  public createRevisionUri(input: GitCompareRevisionInput): vscode.Uri {
    this.assertAvailable();
    return vscode.Uri.parse(this.#store.createRevisionUri(input), true);
  }

  public createSummaryUri(summary: string, displayPath: string): vscode.Uri {
    this.assertAvailable();
    return vscode.Uri.parse(this.#store.createSummaryUri(summary, displayPath), true);
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

  public async openComparison(
    repositoryRoot: string,
    result: GitCompareResult,
  ): Promise<void> {
    if (result.changes.length === 0) {
      await vscode.window.showInformationMessage(
        vscode.l10n.t(
          'No changes between {0} and {1}.',
          result.base.slice(0, 8),
          result.target.slice(0, 8),
        ),
      );
      return;
    }
    const resources = createGitCompareNativeChanges(repositoryRoot, result).map(
      (change) =>
        [
          vscode.Uri.joinPath(
            vscode.Uri.file(repositoryRoot),
            ...change.labelPath.split('/'),
          ),
          change.original === undefined
            ? undefined
            : this.createNativeDocumentUri(change.original),
          change.modified === undefined
            ? undefined
            : this.createNativeDocumentUri(change.modified),
        ] as const,
    );
    await this.nativeChanges.open(
      vscode.l10n.t(
        'Git comparison {0} → {1} · {2} files · +{3} -{4}',
        result.base.slice(0, 8),
        result.target.slice(0, 8),
        result.stats.files,
        result.stats.additions,
        result.stats.deletions,
      ),
      resources,
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

  private createNativeDocumentUri(document: GitCompareNativeDocument): vscode.Uri {
    if (document.kind === 'revision') return this.createRevisionUri(document.input);
    return this.createSummaryUri(
      [
        vscode.l10n.t('Git comparison file'),
        vscode.l10n.t('Endpoint: {0}', document.endpoint.slice(0, 8)),
        vscode.l10n.t('Path: {0}', document.path),
        vscode.l10n.t('Change: {0}', document.status),
        summaryForResult(document.contentKind),
      ].join('\n'),
      document.path,
    );
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
