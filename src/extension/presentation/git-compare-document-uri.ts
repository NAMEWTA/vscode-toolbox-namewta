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

export class GitCompareDocumentStore {
  readonly #entries = new Map<string, DocumentEntry>();

  public constructor(private readonly createToken: () => string = randomUUID) {}

  public createRevisionUri(input: GitCompareRevisionInput): string {
    this.assertRevision(input);
    return this.createEntry({ kind: 'revision', input }, 'revision');
  }

  public createSummaryUri(summary: string): string {
    if (summary.length === 0 || summary.length > 100_000 || summary.includes('\0')) {
      throw invalidUriError();
    }
    return this.createEntry({ kind: 'summary', summary }, 'summary');
  }

  public resolve(uri: string): DocumentEntry {
    const parsed = parseUri(uri);
    const entry = this.#entries.get(parsed.token);
    if (entry === undefined || entry.kind !== parsed.kind) throw invalidUriError();
    return entry;
  }

  public clear(): void {
    this.#entries.clear();
  }

  private createEntry(entry: DocumentEntry, kind: 'revision' | 'summary'): string {
    const token = this.createToken();
    if (!/^[A-Za-z\d-]{1,64}$/u.test(token)) throw invalidUriError();
    this.#entries.set(token, entry);
    return `${GIT_COMPARE_DOCUMENT_SCHEME}://${token}/${kind}`;
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

function parseUri(uri: string): { readonly token: string; readonly kind: string } {
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
  const kind = parsed.pathname.slice(1);
  if (
    !/^[A-Za-z\d-]{1,64}$/u.test(parsed.hostname) ||
    (kind !== 'revision' && kind !== 'summary')
  ) {
    throw invalidUriError();
  }
  return { token: parsed.hostname, kind };
}

function invalidUriError(cause?: unknown): ApplicationError {
  return new ApplicationError('Git comparison document URI is invalid.', {
    code: 'invalid-input',
    ...(cause === undefined ? {} : { cause }),
  });
}
