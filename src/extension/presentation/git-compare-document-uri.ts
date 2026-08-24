import { randomUUID } from 'node:crypto';
import {
  isFullCommitHash,
  isRepositoryRelativePath,
  type GitCompareRevisionInput,
} from '../../core/domains/git-compare/public-api';
import { ApplicationError } from '../../core/kernel/application-error';

export const GIT_COMPARE_DOCUMENT_SCHEME = 'vscode-toolbox-namewta-git-compare';

type DocumentEntry =
  | { readonly kind: 'revision'; readonly input: GitCompareRevisionInput }
  | { readonly kind: 'summary'; readonly summary: string };

type StoredDocumentEntry = DocumentEntry & { readonly displayPath: string };

export class GitCompareDocumentStore {
  readonly #entries = new Map<string, StoredDocumentEntry>();

  public constructor(private readonly createToken: () => string = randomUUID) {}

  public createRevisionUri(input: GitCompareRevisionInput): string {
    this.assertRevision(input);
    return this.createEntry({ kind: 'revision', input }, input.path);
  }

  public createSummaryUri(summary: string, displayPath: string): string {
    if (
      summary.length === 0 ||
      summary.length > 100_000 ||
      summary.includes('\0') ||
      !isRepositoryRelativePath(displayPath)
    ) {
      throw invalidUriError();
    }
    return this.createEntry({ kind: 'summary', summary }, displayPath);
  }

  public resolve(uri: string): DocumentEntry {
    const parsed = parseUri(uri);
    const entry = this.#entries.get(parsed.token);
    if (entry === undefined || entry.displayPath !== parsed.displayPath) {
      throw invalidUriError();
    }
    if (entry.kind === 'revision') return { kind: entry.kind, input: entry.input };
    return { kind: entry.kind, summary: entry.summary };
  }

  public clear(): void {
    this.#entries.clear();
  }

  private createEntry(entry: DocumentEntry, displayPath: string): string {
    const token = this.createToken();
    if (!/^[a-z\d][a-z\d-]{0,63}$/u.test(token)) throw invalidUriError();
    this.#entries.set(token, { ...entry, displayPath });
    return `${GIT_COMPARE_DOCUMENT_SCHEME}://${token}/${encodePath(displayPath)}`;
  }

  private assertRevision(input: GitCompareRevisionInput): void {
    if (
      !isFullCommitHash(input.ref) ||
      !isRepositoryRelativePath(input.path) ||
      input.repositoryRoot.length === 0
    ) {
      throw invalidUriError();
    }
  }
}

function parseUri(uri: string): {
  readonly token: string;
  readonly displayPath: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch (error: unknown) {
    throw invalidUriError(error);
  }
  if (
    parsed.protocol !== `${GIT_COMPARE_DOCUMENT_SCHEME}:` ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    throw invalidUriError();
  }
  if (!/^[a-z\d][a-z\d-]{0,63}$/u.test(parsed.hostname)) {
    throw invalidUriError();
  }
  let displayPath: string;
  try {
    displayPath = parsed.pathname
      .slice(1)
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');
  } catch (error: unknown) {
    throw invalidUriError(error);
  }
  if (!isRepositoryRelativePath(displayPath)) throw invalidUriError();
  return { token: parsed.hostname, displayPath };
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function invalidUriError(cause?: unknown): ApplicationError {
  return new ApplicationError('Git comparison document URI is invalid.', {
    code: 'invalid-input',
    ...(cause === undefined ? {} : { cause }),
  });
}
