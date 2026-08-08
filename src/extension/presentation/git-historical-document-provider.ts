import * as vscode from 'vscode';
import type { GitHistoricalDocument } from '../../core/domains/git-blame/public-api';
import type { ToolboxGateway } from '../../core/orchestration/public-api';
import {
  GitRepositoryTokenRegistry,
  decodeHistoricalDocumentUri,
  encodeHistoricalDocumentUri,
} from './git-historical-document-uri';

export class GitHistoricalDocumentProvider
  implements vscode.TextDocumentContentProvider, vscode.Disposable
{
  readonly #registry = new GitRepositoryTokenRegistry();
  readonly #activeRequests = new Set<AbortController>();
  #isDisposed = false;

  public constructor(private readonly gateway: ToolboxGateway) {}

  public createUri(document: GitHistoricalDocument): vscode.Uri {
    const token = this.#registry.register(document.resource);
    return vscode.Uri.parse(encodeHistoricalDocumentUri(token, document), true);
  }

  public async provideTextDocumentContent(
    uri: vscode.Uri,
    cancellationToken: vscode.CancellationToken,
  ): Promise<string> {
    if (this.#isDisposed) {
      throw unavailableError();
    }
    let input: GitHistoricalDocument;
    try {
      input = decodeHistoricalDocumentUri(uri.toString(true), this.#registry);
    } catch {
      throw unavailableError();
    }
    const controller = new AbortController();
    this.#activeRequests.add(controller);
    const cancellation = cancellationToken.onCancellationRequested(() =>
      controller.abort(),
    );
    try {
      const result = await this.gateway.execute(
        'gitBlame.getHistoricalContent',
        input,
        {
          signal: controller.signal,
          source: 'extension-command',
        },
      );
      if (!result.ok) {
        throw unavailableError();
      }
      return result.data.content;
    } finally {
      cancellation.dispose();
      this.#activeRequests.delete(controller);
    }
  }

  public async openDiff(
    before: GitHistoricalDocument,
    after: GitHistoricalDocument,
    title: string,
  ): Promise<void> {
    await vscode.commands.executeCommand(
      'vscode.diff',
      this.createUri(before),
      this.createUri(after),
      title,
      { preview: true },
    );
  }

  public dispose(): void {
    this.#isDisposed = true;
    for (const request of this.#activeRequests) {
      request.abort();
    }
    this.#activeRequests.clear();
    this.#registry.clear();
  }
}

function unavailableError(): Error {
  return new Error(
    vscode.l10n.t('Git Blame could not be loaded. See the output log for details.'),
  );
}
