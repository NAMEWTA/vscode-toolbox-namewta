import { randomUUID } from 'node:crypto';
import {
  isGitReference,
  isRepositoryRelativePath,
  type ExecutableGitResource,
  type GitHistoricalDocument,
} from '../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../core/kernel/application-error';

const HISTORICAL_SCHEME = 'vscode-toolbox-namewta-git:';

export class GitRepositoryTokenRegistry {
  readonly #resources = new Map<string, ExecutableGitResource>();
  readonly #tokensByRoot = new Map<string, string>();

  public constructor(private readonly createToken: () => string = randomUUID) {}

  public register(resource: ExecutableGitResource): string {
    const existing = this.#tokensByRoot.get(resource.repositoryRoot);
    if (existing !== undefined) {
      return existing;
    }
    const token = this.createToken();
    if (!/^[A-Za-z\d-]{1,64}$/u.test(token)) {
      throw invalidUriError();
    }
    this.#resources.set(token, resource);
    this.#tokensByRoot.set(resource.repositoryRoot, token);
    return token;
  }

  public resolve(token: string): ExecutableGitResource {
    const resource = this.#resources.get(token);
    if (resource === undefined) {
      throw invalidUriError();
    }
    return resource;
  }

  public clear(): void {
    this.#resources.clear();
    this.#tokensByRoot.clear();
  }
}

export function encodeHistoricalDocumentUri(
  repositoryToken: string,
  document: GitHistoricalDocument,
): string {
  if (!/^[A-Za-z\d-]{1,64}$/u.test(repositoryToken)) {
    throw invalidUriError();
  }
  return `${HISTORICAL_SCHEME}//${repositoryToken}/${encodeSegment(document.ref)}/${encodeSegment(document.path)}`;
}

export function decodeHistoricalDocumentUri(
  uri: string,
  registry: GitRepositoryTokenRegistry,
): GitHistoricalDocument {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch (error: unknown) {
    throw invalidUriError(error);
  }
  if (!isOwnedHistoricalUri(parsed)) {
    throw invalidUriError();
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length !== 2) {
    throw invalidUriError();
  }
  const ref = decodeSegment(segments[0]);
  const path = decodeSegment(segments[1]);
  if (!isGitReference(ref) || !isRepositoryRelativePath(path)) {
    throw invalidUriError();
  }
  return { resource: registry.resolve(parsed.hostname), ref, path };
}

function isOwnedHistoricalUri(uri: URL): boolean {
  return (
    uri.protocol === HISTORICAL_SCHEME &&
    uri.username === '' &&
    uri.password === '' &&
    uri.port === '' &&
    uri.search === '' &&
    uri.hash === ''
  );
}

function encodeSegment(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeSegment(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    throw invalidUriError();
  }
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    if (encodeSegment(decoded) !== value) {
      throw invalidUriError();
    }
    return decoded;
  } catch (error: unknown) {
    if (error instanceof ApplicationError) {
      throw error;
    }
    throw invalidUriError(error);
  }
}

function invalidUriError(cause?: unknown): ApplicationError {
  return new ApplicationError('Historical document URI is invalid.', {
    code: 'invalid-input',
    ...(cause === undefined ? {} : { cause }),
  });
}
