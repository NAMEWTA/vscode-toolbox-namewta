import * as vscode from 'vscode';
import {
  GitReviewDocumentStore,
  GIT_REVIEW_DOCUMENT_SCHEME,
} from './git-review-document-uri';

export class VscodeGitReviewDocumentProvider
  implements vscode.TextDocumentContentProvider, vscode.Disposable
{
  readonly #store = new GitReviewDocumentStore();
  #isDisposed = false;

  public createTextUris(
    before: string,
    after: string,
  ): {
    readonly before: vscode.Uri;
    readonly after: vscode.Uri;
  } {
    this.assertAvailable();
    this.#store.clear();
    const documents = this.#store.createTextUris(before, after);
    return {
      before: vscode.Uri.parse(documents.before, true),
      after: vscode.Uri.parse(documents.after, true),
    };
  }

  public createSummaryUri(summary: string): vscode.Uri {
    this.assertAvailable();
    this.#store.clear();
    return vscode.Uri.parse(this.#store.createSummaryUri(summary), true);
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    this.assertAvailable();
    try {
      return this.#store.resolve(uri.toString(true));
    } catch {
      throw unavailableDocumentError();
    }
  }

  public clear(): void {
    this.#store.clear();
  }

  public dispose(): void {
    this.#isDisposed = true;
    this.#store.clear();
  }

  private assertAvailable(): void {
    if (this.#isDisposed) {
      throw unavailableDocumentError();
    }
  }
}

export { GIT_REVIEW_DOCUMENT_SCHEME };

function unavailableDocumentError(): Error {
  return new Error(vscode.l10n.t('Git Review content is no longer available.'));
}
