import { randomUUID } from 'node:crypto';
import { ApplicationError } from '../../core/kernel/application-error';

export const GIT_REVIEW_DOCUMENT_SCHEME = 'vscode-toolbox-namewta-git-review';

type GitReviewDocumentSide = 'before' | 'after' | 'summary';

type GitReviewDocument = {
  readonly before?: string;
  readonly after?: string;
  readonly summary?: string;
};

const MAX_DOCUMENT_BYTES = 64 * 1_024 * 1_024;

export class GitReviewDocumentStore {
  readonly #documents = new Map<string, GitReviewDocument>();

  public constructor(private readonly createToken: () => string = randomUUID) {}

  public createTextUris(
    before: string,
    after: string,
  ): {
    readonly before: string;
    readonly after: string;
  } {
    validateDocumentContent(before);
    validateDocumentContent(after);
    const token = this.register({ before, after });
    return {
      before: encodeGitReviewDocumentUri(token, 'before'),
      after: encodeGitReviewDocumentUri(token, 'after'),
    };
  }

  public createSummaryUri(summary: string): string {
    validateDocumentContent(summary);
    return encodeGitReviewDocumentUri(this.register({ summary }), 'summary');
  }

  public resolve(uri: string): string {
    const { token, side } = decodeGitReviewDocumentUri(uri);
    const document = this.#documents.get(token);
    const content = document?.[side];
    if (content === undefined) {
      throw unavailableDocumentError();
    }
    return content;
  }

  public clear(): void {
    this.#documents.clear();
  }

  private register(document: GitReviewDocument): string {
    const token = this.createToken();
    if (!isToken(token)) {
      throw unavailableDocumentError();
    }
    this.#documents.set(token, document);
    return token;
  }
}

function encodeGitReviewDocumentUri(
  token: string,
  side: GitReviewDocumentSide,
): string {
  if (!isToken(token)) {
    throw unavailableDocumentError();
  }
  return `${GIT_REVIEW_DOCUMENT_SCHEME}://${token}/${side}`;
}

export function decodeGitReviewDocumentUri(uri: string): {
  readonly token: string;
  readonly side: GitReviewDocumentSide;
} {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch (error: unknown) {
    throw unavailableDocumentError(error);
  }
  if (
    parsed.protocol !== `${GIT_REVIEW_DOCUMENT_SCHEME}:` ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.port !== '' ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    !isToken(parsed.hostname)
  ) {
    throw unavailableDocumentError();
  }
  const side = parsed.pathname.slice(1);
  if (!isDocumentSide(side)) {
    throw unavailableDocumentError();
  }
  return { token: parsed.hostname, side };
}

function validateDocumentContent(content: string): void {
  if (Buffer.byteLength(content, 'utf8') > MAX_DOCUMENT_BYTES) {
    throw unavailableDocumentError();
  }
}

function isToken(value: string): boolean {
  return /^[A-Za-z\d-]{1,64}$/u.test(value);
}

function isDocumentSide(value: string): value is GitReviewDocumentSide {
  return value === 'before' || value === 'after' || value === 'summary';
}

function unavailableDocumentError(cause?: unknown): ApplicationError {
  return new ApplicationError('Git Review document is unavailable.', {
    code: 'capability-unavailable',
    ...(cause === undefined ? {} : { cause }),
  });
}
