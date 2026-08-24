import * as vscode from 'vscode';
import type {
  GitReviewItem,
  GitReviewItemContent,
} from '../../core/domains/git-review/public-api';
import type { ToolboxGateway } from '../../core/orchestration/public-api';
import { createGitReviewSummaryText } from './git-review-summary-text';
import {
  GitReviewDocumentStore,
  GIT_REVIEW_DOCUMENT_SCHEME,
} from './git-review-document-uri';

type ContentRequest = {
  readonly controller: AbortController;
  readonly promise: Promise<GitReviewItemContent>;
};

export class VscodeGitReviewDocumentProvider
  implements vscode.TextDocumentContentProvider, vscode.Disposable
{
  readonly #store = new GitReviewDocumentStore();
  readonly #content = new Map<string, GitReviewItemContent>();
  readonly #requests = new Map<string, ContentRequest>();
  #generation = 1;
  #isDisposed = false;

  public constructor(private readonly gateway?: ToolboxGateway) {}

  public createItemUri(
    item: GitReviewItem,
    side: 'before' | 'after',
    displayPath: string,
  ): vscode.Uri {
    this.assertAvailable();
    return vscode.Uri.parse(this.#store.createItemUri(item, side, displayPath), true);
  }

  public async provideTextDocumentContent(
    uri: vscode.Uri,
    cancellationToken?: vscode.CancellationToken,
  ): Promise<string> {
    this.assertAvailable();
    let entry: ReturnType<GitReviewDocumentStore['resolve']>;
    try {
      entry = this.#store.resolve(uri.toString(true));
    } catch {
      throw unavailableDocumentError();
    }
    if (isCancelled(cancellationToken)) {
      throw cancelledDocumentError();
    }
    const content = await this.loadContent(entry.item);
    if (isCancelled(cancellationToken)) {
      throw cancelledDocumentError();
    }
    return content.kind === 'text'
      ? content[entry.side]
      : createGitReviewSummaryText(entry.item, content.reason);
  }

  public clear(): void {
    this.#generation += 1;
    for (const request of this.#requests.values()) request.controller.abort();
    this.#requests.clear();
    this.#content.clear();
    this.#store.clear();
  }

  public dispose(): void {
    if (this.#isDisposed) return;
    this.#isDisposed = true;
    this.clear();
  }

  private async loadContent(item: GitReviewItem): Promise<GitReviewItemContent> {
    const key = `${item.itemId}\0${item.contentIdentity}`;
    const cached = this.#content.get(key);
    if (cached !== undefined) return cached;
    const existing = this.#requests.get(key);
    if (existing !== undefined) return existing.promise;
    if (this.gateway === undefined) throw unavailableDocumentError();
    const generation = this.#generation;
    const controller = new AbortController();
    const promise = this.requestContent(item, controller).finally(() => {
      if (this.#requests.get(key)?.controller === controller) {
        this.#requests.delete(key);
      }
    });
    this.#requests.set(key, { controller, promise });
    const content = await promise;
    if (generation !== this.#generation) throw cancelledDocumentError();
    this.#content.set(key, content);
    return content;
  }

  private async requestContent(
    item: GitReviewItem,
    controller: AbortController,
  ): Promise<GitReviewItemContent> {
    const result = await this.gateway?.execute(
      'gitReview.getItemContent',
      { path: item.path, contentIdentity: item.contentIdentity },
      { signal: controller.signal, source: 'extension-command' },
    );
    return result?.ok === true
      ? result.data
      : { kind: 'summary', reason: 'unavailable' };
  }

  private assertAvailable(): void {
    if (this.#isDisposed) throw unavailableDocumentError();
  }
}

export { GIT_REVIEW_DOCUMENT_SCHEME };

function unavailableDocumentError(): Error {
  return new Error(vscode.l10n.t('Git Review content is no longer available.'));
}

function cancelledDocumentError(): Error {
  const error = unavailableDocumentError();
  error.name = 'AbortError';
  return error;
}

function isCancelled(token: vscode.CancellationToken | undefined): boolean {
  return token?.isCancellationRequested === true;
}
