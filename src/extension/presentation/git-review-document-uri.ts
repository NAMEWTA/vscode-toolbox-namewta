import { randomUUID } from 'node:crypto';
import {
  isGitReviewItemContentInput,
  type GitReviewItem,
} from '../../core/domains/git-review/public-api';
import { ApplicationError } from '../../core/kernel/application-error';

export const GIT_REVIEW_DOCUMENT_SCHEME = 'vscode-toolbox-namewta-git-review';

export type GitReviewDocumentEntry = {
  readonly kind: 'item';
  readonly item: GitReviewItem;
  readonly side: 'before' | 'after';
};

type StoredEntry = GitReviewDocumentEntry & { readonly displayPath: string };

export class GitReviewDocumentStore {
  readonly #entries = new Map<string, StoredEntry>();

  public constructor(private readonly createToken: () => string = randomUUID) {}

  public createItemUri(
    item: GitReviewItem,
    side: 'before' | 'after',
    displayPath: string,
  ): string {
    if (
      !isGitReviewItemContentInput({
        path: item.path,
        contentIdentity: item.contentIdentity,
      }) ||
      !isDisplayPath(displayPath)
    ) {
      throw unavailableDocumentError();
    }
    return this.createEntry({ kind: 'item', item, side }, displayPath);
  }

  public resolve(uri: string): GitReviewDocumentEntry {
    const parsed = parseUri(uri);
    const entry = this.#entries.get(parsed.token);
    if (entry === undefined || entry.displayPath !== parsed.displayPath) {
      throw unavailableDocumentError();
    }
    return { kind: 'item', item: entry.item, side: entry.side };
  }

  public clear(): void {
    this.#entries.clear();
  }

  private createEntry(entry: GitReviewDocumentEntry, displayPath: string): string {
    const token = this.createToken();
    if (!/^[a-z\d][a-z\d-]{0,63}$/u.test(token) || !isDisplayPath(displayPath)) {
      throw unavailableDocumentError();
    }
    this.#entries.set(token, { ...entry, displayPath });
    return `${GIT_REVIEW_DOCUMENT_SCHEME}://${token}/${encodePath(displayPath)}`;
  }
}

export function decodeGitReviewDocumentUri(uri: string): {
  readonly token: string;
  readonly displayPath: string;
} {
  return parseUri(uri);
}

function parseUri(uri: string): {
  readonly token: string;
  readonly displayPath: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch (error: unknown) {
    throw unavailableDocumentError(error);
  }
  if (!isReviewDocumentUrl(parsed)) throw unavailableDocumentError();
  let displayPath: string;
  try {
    displayPath = parsed.pathname
      .slice(1)
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');
  } catch (error: unknown) {
    throw unavailableDocumentError(error);
  }
  if (!isDisplayPath(displayPath)) throw unavailableDocumentError();
  return { token: parsed.hostname, displayPath };
}

function isReviewDocumentUrl(parsed: URL): boolean {
  return (
    parsed.protocol === `${GIT_REVIEW_DOCUMENT_SCHEME}:` &&
    parsed.username === '' &&
    parsed.password === '' &&
    parsed.port === '' &&
    parsed.search === '' &&
    parsed.hash === '' &&
    /^[a-z\d][a-z\d-]{0,63}$/u.test(parsed.hostname)
  );
}

function isDisplayPath(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 4_096 &&
    !value.includes('\0') &&
    !value.startsWith('/') &&
    value
      .split('/')
      .every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  );
}

function encodePath(value: string): string {
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function unavailableDocumentError(cause?: unknown): ApplicationError {
  return new ApplicationError('Git Review document is unavailable.', {
    code: 'capability-unavailable',
    ...(cause === undefined ? {} : { cause }),
  });
}
