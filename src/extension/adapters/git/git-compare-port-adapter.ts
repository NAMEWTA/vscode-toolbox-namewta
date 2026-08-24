/* eslint-disable max-lines */
import {
  GIT_COMPARE_EMPTY_TREE_HASH,
  isFullCommitHash,
  isGitCommitObjectIdPrefix,
  isGitCompareCursor,
  isGitCompareSearchQuery,
  type GitCompareCancellationSignal,
  type GitCompareContentKind,
  type GitCompareCommit,
  type GitCompareFileChange,
  type GitCompareHistoryInput,
  type GitCompareHistoryPage,
  type GitCompareInput,
  type GitComparePort,
  type GitCompareResolveRevisionInput,
  type GitCompareRevisionInput,
  type GitCompareRevisionResult,
  type GitCompareSearchInput,
  type GitCompareSearchMatch,
  type GitCompareSearchResult,
} from '../../../core/domains/git-compare/public-api';
import type {
  GitCommandPort,
  GitCommandResult,
} from '../../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';

const MAX_REVISION_BYTES = 8 * 1_024 * 1_024;
const LOG_LIMIT = 200;
const REF_FORMAT = '%(objectname)%00%(*objectname)%00%(refname:short)%00';

type RawChange = {
  readonly status: GitCompareFileChange['status'];
  readonly path: string;
  readonly previousPath?: string;
  readonly oldMode: string;
  readonly newMode: string;
};

type Numstat = {
  readonly path: string;
  readonly previousPath?: string;
  readonly additions?: number;
  readonly deletions?: number;
  readonly isBinary: boolean;
};

export class GitComparePortAdapter implements GitComparePort {
  public constructor(
    private readonly git: GitCommandPort,
    private readonly isWorkspaceTrusted: () => boolean,
  ) {}

  public async listCommits(
    input: GitCompareHistoryInput,
    signal: GitCompareCancellationSignal,
  ): Promise<GitCompareHistoryPage> {
    this.assertTrusted();
    const head = await this.runNotFound(
      input.repositoryRoot,
      'compare-head',
      ['rev-parse', '--verify', 'HEAD^{commit}'],
      signal,
    );
    const headSha = head.stdout.trim();
    if (!isFullCommitHash(headSha)) {
      throw new ApplicationError('Git HEAD is invalid.', { code: 'internal-error' });
    }
    let offset = 0;
    if (input.cursor !== undefined) {
      if (!isGitCompareCursor(input.cursor)) {
        throw invalidInputError();
      }
      const [cursorHead, cursorOffset] = input.cursor.split('.');
      if (
        cursorHead?.toLowerCase() !== headSha.toLowerCase() ||
        cursorOffset === undefined
      ) {
        throw new ApplicationError('Git history changed. Refresh the history view.', {
          code: 'capability-unavailable',
          retryable: true,
        });
      }
      offset = Number(cursorOffset);
    }
    const limit = Math.min(input.limit, LOG_LIMIT);
    const result = await this.runNotFound(
      input.repositoryRoot,
      'compare-history',
      [
        '--no-pager',
        'log',
        '--topo-order',
        '--no-decorate',
        `--max-count=${limit}`,
        `--skip=${offset}`,
        '--format=%H%x00%P%x00%an%x00%aI%x00%s%x00',
        headSha,
      ],
      signal,
    );
    const commits = parseCommitLog(result.stdout);
    const complete = commits.length < limit;
    return {
      commits,
      complete,
      ...(complete ? {} : { nextCursor: `${headSha}.${offset + commits.length}` }),
    };
  }

  public async searchCommits(
    input: GitCompareSearchInput,
    signal: GitCompareCancellationSignal,
  ): Promise<GitCompareSearchResult> {
    this.assertTrusted();
    if (!isGitCompareSearchQuery(input.query)) throw invalidInputError();
    const limit = Math.min(input.limit, LOG_LIMIT);
    const { matchingRefs, messageCommits } = await this.loadSearchSources(
      input,
      limit,
      signal,
    );
    const messageBySha = toCommitMap(messageCommits);
    const refCommitBySha = await this.loadMissingRefCommits(
      input.repositoryRoot,
      matchingRefs,
      messageBySha,
      limit,
      signal,
    );
    return {
      matches: mergeSearchMatches(
        matchingRefs,
        messageCommits,
        messageBySha,
        refCommitBySha,
        limit,
      ),
    };
  }

  private async loadSearchSources(
    input: GitCompareSearchInput,
    limit: number,
    signal: GitCompareCancellationSignal,
  ): Promise<{
    readonly messageCommits: readonly GitCompareCommit[];
    readonly matchingRefs: ReadonlyMap<string, readonly string[]>;
  }> {
    const [messageResult, refResult] = await Promise.all([
      this.runNotFound(
        input.repositoryRoot,
        'compare-search-messages',
        [
          '--no-pager',
          'log',
          '--all',
          '--topo-order',
          '--no-decorate',
          '--regexp-ignore-case',
          '--fixed-strings',
          `--grep=${input.query}`,
          `--max-count=${limit}`,
          '--format=%H%x00%P%x00%an%x00%aI%x00%s%x00',
        ],
        signal,
      ),
      this.runNotFound(
        input.repositoryRoot,
        'compare-search-refs',
        ['for-each-ref', `--format=${REF_FORMAT}`],
        signal,
      ),
    ]);
    return {
      messageCommits: parseCommitLog(messageResult.stdout),
      matchingRefs: parseMatchingRefs(refResult.stdout, input.query),
    };
  }

  private async loadMissingRefCommits(
    repositoryRoot: string,
    matchingRefs: ReadonlyMap<string, readonly string[]>,
    messageBySha: ReadonlyMap<string, GitCompareCommit>,
    limit: number,
    signal: GitCompareCancellationSignal,
  ): Promise<ReadonlyMap<string, GitCompareCommit>> {
    const missingRefShas = [...matchingRefs.keys()].filter(
      (sha) => !messageBySha.has(sha),
    );
    if (missingRefShas.length === 0) return new Map();
    const result = await this.runNotFound(
      repositoryRoot,
      'compare-search-ref-metadata',
      [
        '--no-pager',
        'show',
        '-s',
        '--no-decorate',
        '--format=%H%x00%P%x00%an%x00%aI%x00%s%x00',
        '--end-of-options',
        ...missingRefShas.slice(0, limit),
      ],
      signal,
    );
    return toCommitMap(parseCommitLog(result.stdout));
  }

  public async resolveRevision(
    input: GitCompareResolveRevisionInput,
    signal: GitCompareCancellationSignal,
  ): Promise<GitCompareCommit> {
    this.assertTrusted();
    if (!isGitCommitObjectIdPrefix(input.revision)) {
      throw invalidInputError();
    }
    const resolved = await this.runNotFound(
      input.repositoryRoot,
      'compare-resolve-revision',
      ['rev-parse', '--verify', '--end-of-options', `${input.revision}^{commit}`],
      signal,
    );
    const sha = resolved.stdout.trim();
    if (!isFullCommitHash(sha)) {
      throw new ApplicationError('Resolved Git revision is invalid.', {
        code: 'internal-error',
      });
    }
    const metadata = await this.runNotFound(
      input.repositoryRoot,
      'compare-revision-metadata',
      [
        '--no-pager',
        'show',
        '-s',
        '--no-decorate',
        '--format=%H%x00%P%x00%an%x00%aI%x00%s%x00',
        sha,
      ],
      signal,
    );
    const [commit] = parseCommitLog(metadata.stdout);
    if (commit === undefined || commit.sha.toLowerCase() !== sha.toLowerCase()) {
      throw new ApplicationError('Resolved Git commit metadata is invalid.', {
        code: 'internal-error',
      });
    }
    return commit;
  }

  // eslint-disable-next-line max-lines-per-function
  public async compareCommits(
    input: GitCompareInput,
    signal: GitCompareCancellationSignal,
  ): Promise<{
    readonly changes: readonly GitCompareFileChange[];
    readonly stats: {
      readonly files: number;
      readonly additions: number;
      readonly deletions: number;
    };
  }> {
    this.assertTrusted();
    const raw = await this.runNotFound(
      input.repositoryRoot,
      'compare-raw',
      [
        '--no-pager',
        '-c',
        'core.quotePath=false',
        'diff',
        '--raw',
        '-z',
        '-M',
        '--no-ext-diff',
        '--no-textconv',
        input.base,
        input.target,
        '--',
      ],
      signal,
    );
    const numstat = await this.runNotFound(
      input.repositoryRoot,
      'compare-numstat',
      [
        '--no-pager',
        '-c',
        'core.quotePath=false',
        'diff',
        '--numstat',
        '-z',
        '-M',
        '--no-ext-diff',
        '--no-textconv',
        input.base,
        input.target,
        '--',
      ],
      signal,
    );
    const rawChanges = parseRawChanges(raw.stdout);
    const statsByPath = parseNumstat(numstat.stdout);
    const changes = rawChanges.map((change) => {
      const stats = findNumstat(statsByPath, change);
      const contentKind = inferContentKind(change, stats);
      return {
        status: change.status,
        path: change.path,
        ...(change.previousPath === undefined
          ? {}
          : { previousPath: change.previousPath }),
        contentKind,
        ...(stats.additions === undefined ? {} : { additions: stats.additions }),
        ...(stats.deletions === undefined ? {} : { deletions: stats.deletions }),
      };
    });
    return {
      changes,
      stats: {
        files: changes.length,
        additions: changes.reduce(
          (total, change) => total + (change.additions ?? 0),
          0,
        ),
        deletions: changes.reduce(
          (total, change) => total + (change.deletions ?? 0),
          0,
        ),
      },
    };
  }

  public async getRevisionContent(
    input: GitCompareRevisionInput,
    signal: GitCompareCancellationSignal,
  ): Promise<GitCompareRevisionResult> {
    this.assertTrusted();
    if (input.ref === GIT_COMPARE_EMPTY_TREE_HASH) {
      return { kind: 'text', content: '' };
    }
    try {
      const result = await this.git.run({
        operation: 'compare-revision-content',
        cwd: input.repositoryRoot,
        args: ['show', '--format=', '--no-ext-diff', `${input.ref}:${input.path}`],
        signal,
        maxOutputBytes: MAX_REVISION_BYTES,
      });
      if (result.stdout.includes('\0') || result.stdout.includes('\uFFFD')) {
        return { kind: 'summary', reason: 'binary' };
      }
      return { kind: 'text', content: result.stdout };
    } catch (error: unknown) {
      if (
        error instanceof ApplicationError &&
        error.code === 'capability-unavailable'
      ) {
        return { kind: 'summary', reason: 'too-large' };
      }
      if (isGitExitError(error)) {
        return { kind: 'summary', reason: 'missing' };
      }
      throw error;
    }
  }

  private async runNotFound(
    cwd: string,
    operation: string,
    args: readonly string[],
    signal: GitCompareCancellationSignal,
  ): Promise<GitCommandResult> {
    try {
      return await this.git.run({ operation, cwd, args, signal });
    } catch (error: unknown) {
      if (isGitExitError(error)) {
        throw new ApplicationError('The requested Git object was not found.', {
          code: 'not-found',
          cause: error,
        });
      }
      throw error;
    }
  }

  private assertTrusted(): void {
    if (!this.isWorkspaceTrusted()) {
      throw new ApplicationError('Git requires a trusted workspace.', {
        code: 'permission-denied',
      });
    }
  }
}

export function parseCommitLog(stdout: string): readonly {
  readonly sha: string;
  readonly parents: readonly string[];
  readonly author: string;
  readonly authoredAt: number;
  readonly subject: string;
}[] {
  const fields = stdout.split('\0');
  const commits = [] as {
    sha: string;
    parents: readonly string[];
    author: string;
    authoredAt: number;
    subject: string;
  }[];
  for (let index = 0; index + 4 < fields.length; index += 5) {
    const sha = fields[index]?.replace(/^\n/u, '');
    const parentsField = fields[index + 1];
    const author = fields[index + 2];
    const authoredAt = fields[index + 3];
    const subject = fields[index + 4];
    if (
      sha === undefined ||
      parentsField === undefined ||
      author === undefined ||
      authoredAt === undefined ||
      subject === undefined ||
      !isFullCommitHash(sha)
    ) {
      continue;
    }
    const time = Date.parse(authoredAt);
    if (!Number.isFinite(time)) {
      continue;
    }
    commits.push({
      sha,
      parents: parentsField.split(' ').filter(isFullCommitHash),
      author,
      authoredAt: time,
      subject,
    });
  }
  return commits;
}

function toCommitMap(
  commits: readonly GitCompareCommit[],
): ReadonlyMap<string, GitCompareCommit> {
  return new Map(commits.map((commit) => [commit.sha.toLowerCase(), commit] as const));
}

function mergeSearchMatches(
  matchingRefs: ReadonlyMap<string, readonly string[]>,
  messageCommits: readonly GitCompareCommit[],
  messageBySha: ReadonlyMap<string, GitCompareCommit>,
  refCommitBySha: ReadonlyMap<string, GitCompareCommit>,
  limit: number,
): readonly GitCompareSearchMatch[] {
  const matches: GitCompareSearchMatch[] = [];
  const seen = new Set<string>();
  for (const [sha, refs] of matchingRefs) {
    const commit = messageBySha.get(sha) ?? refCommitBySha.get(sha);
    if (commit !== undefined) {
      matches.push({ commit, refs });
      seen.add(sha);
    }
    if (matches.length >= limit) return matches;
  }
  for (const commit of messageCommits) {
    const sha = commit.sha.toLowerCase();
    if (!seen.has(sha)) matches.push({ commit, refs: matchingRefs.get(sha) ?? [] });
    if (matches.length >= limit) break;
  }
  return matches;
}

export function parseMatchingRefs(
  stdout: string,
  query: string,
): ReadonlyMap<string, readonly string[]> {
  const fields = stdout.split('\0');
  const normalizedQuery = query.toLocaleLowerCase('en-US');
  const refsBySha = new Map<string, string[]>();
  for (let index = 0; index + 2 < fields.length; index += 3) {
    const candidate = parseRefCandidate(fields, index);
    if (candidate === undefined || !matchesRef(candidate.ref, normalizedQuery)) {
      continue;
    }
    appendRef(refsBySha, candidate.sha, candidate.ref);
  }
  return refsBySha;
}

function parseRefCandidate(
  fields: readonly string[],
  index: number,
): { readonly sha: string; readonly ref: string } | undefined {
  const objectSha = fields[index]?.trim();
  const peeledSha = fields[index + 1]?.trim();
  const ref = fields[index + 2]?.trim();
  const sha = isFullCommitHash(peeledSha) ? peeledSha : objectSha;
  return isFullCommitHash(sha) && ref !== undefined ? { sha, ref } : undefined;
}

function matchesRef(ref: string, normalizedQuery: string): boolean {
  return (
    ref.length > 0 &&
    ref.length <= 1_024 &&
    ref.toLocaleLowerCase('en-US').includes(normalizedQuery)
  );
}

function appendRef(refsBySha: Map<string, string[]>, sha: string, ref: string): void {
  const key = sha.toLowerCase();
  const refs = refsBySha.get(key) ?? [];
  if (!refs.includes(ref)) refs.push(ref);
  refsBySha.set(key, refs);
}

// Git 的 raw 输出必须按 NUL token 消费，避免特殊路径和 rename 双路径错位。
// eslint-disable-next-line complexity
export function parseRawChanges(stdout: string): readonly RawChange[] {
  const fields = stdout.split('\0');
  const changes: RawChange[] = [];
  let index = 0;
  while (index < fields.length) {
    const metadata = fields[index++];
    if (metadata === undefined || metadata.length === 0) continue;
    const parts = metadata.slice(1).split(' ');
    const statusCode = parts.at(-1);
    const oldMode = parts[0];
    const newMode = parts[1];
    const path = fields[index++];
    if (
      statusCode === undefined ||
      oldMode === undefined ||
      newMode === undefined ||
      path === undefined
    ) {
      break;
    }
    const status = mapStatus(statusCode[0]);
    const renamed = status === 'renamed' || status === 'copied';
    const nextPath = renamed ? fields[index++] : undefined;
    if (renamed && nextPath === undefined) break;
    changes.push({
      status,
      path: nextPath ?? path,
      ...(renamed ? { previousPath: path } : {}),
      oldMode,
      newMode,
    });
  }
  return changes;
}

// eslint-disable-next-line complexity
export function parseNumstat(stdout: string): readonly Numstat[] {
  const fields = stdout.split('\0');
  const values: Numstat[] = [];
  let index = 0;
  while (index < fields.length) {
    const stats = fields[index++];
    if (stats === undefined || stats.length === 0) continue;
    const firstTab = stats.indexOf('\t');
    const secondTab = stats.indexOf('\t', firstTab + 1);
    if (firstTab < 0 || secondTab < 0) continue;
    const additionsText = stats.slice(0, firstTab);
    const deletionsText = stats.slice(firstTab + 1, secondTab);
    const path = stats.slice(secondTab + 1);
    const renamed = path.length === 0;
    const previousPath = renamed ? fields[index++] : undefined;
    const nextPath = renamed ? fields[index++] : undefined;
    if (renamed && (previousPath === undefined || nextPath === undefined)) continue;
    const additionCount = toCount(additionsText);
    const deletionCount = toCount(deletionsText);
    values.push({
      path: nextPath ?? path,
      ...(previousPath === undefined ? {} : { previousPath }),
      isBinary: additionsText === '-' || deletionsText === '-',
      ...(additionCount === undefined ? {} : { additions: additionCount }),
      ...(deletionCount === undefined ? {} : { deletions: deletionCount }),
    });
  }
  return values;
}

function findNumstat(values: readonly Numstat[], change: RawChange): Numstat {
  return (
    values.find(
      (value) =>
        value.path === change.path &&
        (value.previousPath === undefined ||
          value.previousPath === change.previousPath),
    ) ?? { path: change.path, isBinary: false }
  );
}

function inferContentKind(change: RawChange, stats: Numstat): GitCompareContentKind {
  if (change.oldMode === '160000' || change.newMode === '160000') return 'submodule';
  if (stats.isBinary) return 'binary';
  return 'text';
}

function mapStatus(status: string | undefined): GitCompareFileChange['status'] {
  switch (status) {
    case undefined:
      return 'unknown';
    case 'A':
      return 'added';
    case 'C':
      return 'copied';
    case 'D':
      return 'deleted';
    case 'M':
      return 'modified';
    case 'R':
      return 'renamed';
    case 'T':
      return 'type-changed';
    case 'U':
      return 'unmerged';
    default:
      return 'unknown';
  }
}

function toCount(value: string): number | undefined {
  return /^\d+$/u.test(value) ? Number(value) : undefined;
}

function isGitExitError(error: unknown): boolean {
  if (!(error instanceof ApplicationError)) return false;
  if (error.code === 'not-found') return true;
  return error.code === 'internal-error' && typeof error.details?.exitCode === 'number';
}

function invalidInputError(): ApplicationError {
  return new ApplicationError('Git comparison input is invalid.', {
    code: 'invalid-input',
  });
}
