import { describe, expect, it, vi } from 'vitest';
import type { GitReviewChangeDescriptor, GitReviewPort } from './git-review-port';
import { GitReviewSessionService } from './git-review-session-service';

type ExpectedReviewItem = {
  readonly path: string;
  readonly reviewState: 'unreviewed' | 'reviewed' | 'skipped';
};

describe('GitReviewSessionService', () => {
  it(
    'creates a stable path-sorted queue without treating navigation as review',
    createsStablePathSortedQueue,
  );
  it(
    'orders case, Unicode and renamed paths deterministically without losing the prior path',
    ordersSpecialPathsDeterministically,
  );
  it(
    'only changes item state through explicit review or skip actions and ends with a summary',
    completesAfterExplicitActions,
  );
  it(
    'keeps the stale queue stable and only preserves treatment for unchanged identities',
    preservesStateAcrossRefresh,
  );
  it(
    'cancels an in-flight inventory request when the session ends',
    cancelsRequestOnEnd,
  );
  it(
    'cancels in-flight work and remains idempotent when disposed',
    disposesSessionService,
  );
  it(
    'reads content only for an item whose path and content identity still match the session',
    readsMatchingItemContent,
  );
  it('rejects malformed content returned from the Port', rejectsInvalidItemContent);
  it(
    'keeps the current queue observable while a refresh is pending',
    keepsQueueDuringRefresh,
  );
  it(
    'requires explicit replacement before it discards an unfinished session',
    requiresReplacement,
  );
  it(
    'rejects malformed or duplicate Port descriptors without creating a session',
    rejectsInvalidDescriptors,
  );
  it(
    'keeps staged and unstaged items for the same path independently addressable',
    keepsLayeredItemsForSamePath,
  );
  it(
    'does not call the Port when a refresh has already been cancelled',
    avoidsCancelledRefresh,
  );
});

async function createsStablePathSortedQueue(): Promise<void> {
  const port = createPort();
  port.listChanges.mockResolvedValue([
    change({ path: 'zeta.ts', contentIdentity: 'z'.repeat(64) }),
    change({ path: 'alpha.ts', contentIdentity: 'a'.repeat(64) }),
  ]);
  const service = new GitReviewSessionService(port);

  const created = await service.start(
    { repositoryRoot: '/workspace/repository', replace: false },
    { aborted: false },
  );
  const navigated = service.next();
  const returned = service.previous();

  expect(created).toMatchObject(
    activeSnapshot('alpha.ts', [
      item('alpha.ts', 'unreviewed'),
      item('zeta.ts', 'unreviewed'),
    ]),
  );
  expect(navigated).toMatchObject(
    activeSnapshot('zeta.ts', [
      item('alpha.ts', 'unreviewed'),
      item('zeta.ts', 'unreviewed'),
    ]),
  );
  expect(returned).toMatchObject(
    activeSnapshot('alpha.ts', [
      item('alpha.ts', 'unreviewed'),
      item('zeta.ts', 'unreviewed'),
    ]),
  );
}

async function ordersSpecialPathsDeterministically(): Promise<void> {
  const port = createPort();
  port.listChanges.mockResolvedValue([
    change({ path: 'zeta.ts', contentIdentity: 'z'.repeat(64) }),
    change({ path: 'éclair.ts', contentIdentity: 'e'.repeat(64) }),
    {
      ...change({ path: 'renamed.ts', contentIdentity: 'r'.repeat(64) }),
      change: 'renamed',
      previousPath: 'before-rename.ts',
    },
    change({ path: 'Alpha.ts', contentIdentity: 'a'.repeat(64) }),
  ]);
  const service = new GitReviewSessionService(port);

  const snapshot = await startSession(service);

  expect(snapshot).toMatchObject({
    state: 'active',
    session: {
      currentItemPath: 'Alpha.ts',
      items: [
        item('Alpha.ts', 'unreviewed'),
        expect.objectContaining({
          path: 'renamed.ts',
          previousPath: 'before-rename.ts',
          reviewState: 'unreviewed',
        }),
        item('zeta.ts', 'unreviewed'),
        item('éclair.ts', 'unreviewed'),
      ],
    },
  });
}

async function completesAfterExplicitActions(): Promise<void> {
  const port = createPort();
  port.listChanges.mockResolvedValue([
    change({ path: 'alpha.ts', contentIdentity: 'a'.repeat(64) }),
    change({ path: 'beta.ts', contentIdentity: 'b'.repeat(64) }),
  ]);
  const service = new GitReviewSessionService(port);

  await startSession(service);
  const afterReview = service.markReviewedAndNext();
  const completed = service.skip();

  expect(afterReview).toMatchObject(
    activeSnapshot('beta.ts', [
      item('alpha.ts', 'reviewed'),
      item('beta.ts', 'unreviewed'),
    ]),
  );
  expect(completed).toEqual({
    state: 'completed',
    summary: { total: 2, reviewed: 1, skipped: 1 },
  });
  expect(service.getSnapshot()).toEqual({ state: 'inactive' });
}

async function preservesStateAcrossRefresh(): Promise<void> {
  const port = createPort();
  port.listChanges
    .mockResolvedValueOnce([
      change({ path: 'alpha.ts', contentIdentity: 'a'.repeat(64) }),
      change({ path: 'beta.ts', contentIdentity: 'b'.repeat(64) }),
      change({ path: 'gamma.ts', contentIdentity: 'c'.repeat(64) }),
    ])
    .mockResolvedValueOnce([
      change({ path: 'alpha.ts', contentIdentity: 'a'.repeat(64) }),
      change({ path: 'beta.ts', contentIdentity: 'd'.repeat(64) }),
      change({ path: 'gamma.ts', contentIdentity: 'c'.repeat(64) }),
    ]);
  const service = new GitReviewSessionService(port);

  await startSession(service);
  service.markReviewedAndNext();
  service.markReviewedAndNext();
  const stale = service.markStale();
  const refreshed = await service.refresh({ aborted: false });

  expect(stale).toMatchObject({
    state: 'stale',
    session: {
      currentItemPath: 'gamma.ts',
      items: [
        item('alpha.ts', 'reviewed'),
        item('beta.ts', 'reviewed'),
        item('gamma.ts', 'unreviewed'),
      ],
    },
  });
  expect(refreshed).toMatchObject({
    state: 'active',
    session: {
      currentItemPath: 'gamma.ts',
      items: [
        item('alpha.ts', 'reviewed'),
        item('beta.ts', 'unreviewed'),
        item('gamma.ts', 'unreviewed'),
      ],
    },
  });
}

async function cancelsRequestOnEnd(): Promise<void> {
  const port = createPort();
  port.listChanges.mockImplementation(
    (
      _repositoryRoot: string,
      signal: { addEventListener?: (type: 'abort', listener: () => void) => void },
    ) =>
      new Promise((_, reject: (reason: Error) => void) => {
        signal.addEventListener?.('abort', () => {
          const error = new Error('cancelled');
          error.name = 'AbortError';
          reject(error);
        });
      }),
  );
  const service = new GitReviewSessionService(port);

  const pending = startSession(service);
  const ended = service.end();

  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(ended).toEqual({ state: 'inactive' });
  expect(service.getSnapshot()).toEqual({ state: 'inactive' });
}

async function disposesSessionService(): Promise<void> {
  const port = createPort();
  port.listChanges.mockImplementation(
    (
      _repositoryRoot: string,
      signal: { addEventListener?: (type: 'abort', listener: () => void) => void },
    ) =>
      new Promise((_, reject: (reason: Error) => void) => {
        signal.addEventListener?.('abort', () => {
          const error = new Error('cancelled');
          error.name = 'AbortError';
          reject(error);
        });
      }),
  );
  const service = new GitReviewSessionService(port);

  const pending = startSession(service);
  service.dispose();
  service.dispose();

  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await expect(startSession(service)).rejects.toMatchObject({ name: 'AbortError' });
  expect(service.getSnapshot()).toEqual({ state: 'inactive' });
}

async function readsMatchingItemContent(): Promise<void> {
  const port = createPort();
  const descriptor = change({ path: 'src/main.ts', contentIdentity: 'a'.repeat(64) });
  port.listChanges.mockResolvedValue([descriptor]);
  port.readItemContent.mockResolvedValue({
    kind: 'text',
    before: 'before',
    after: 'after',
  });
  const service = new GitReviewSessionService(port);

  await startSession(service);

  await expect(
    service.getItemContent(
      { path: 'src/main.ts', contentIdentity: 'a'.repeat(64) },
      { aborted: false },
    ),
  ).resolves.toEqual({ kind: 'text', before: 'before', after: 'after' });
  await expect(
    service.getItemContent(
      { path: 'src/main.ts', contentIdentity: 'b'.repeat(64) },
      { aborted: false },
    ),
  ).rejects.toMatchObject({ code: 'invalid-input' });
  const actualRequest: unknown = port.readItemContent.mock.calls[0]?.[0];
  expect(actualRequest).toEqual({
    repositoryRoot: '/workspace/repository',
    item: {
      ...descriptor,
      itemId: 'unstaged:src/main.ts',
      layer: 'unstaged',
    },
  });
}

async function rejectsInvalidItemContent(): Promise<void> {
  const port = createPort();
  port.listChanges.mockResolvedValue([
    change({ path: 'src/main.ts', contentIdentity: 'a'.repeat(64) }),
  ]);
  port.readItemContent.mockResolvedValue({ kind: 'text', before: 'before', after: 7 });
  const service = new GitReviewSessionService(port);

  await startSession(service);

  await expect(
    service.getItemContent(
      { path: 'src/main.ts', contentIdentity: 'a'.repeat(64) },
      { aborted: false },
    ),
  ).rejects.toMatchObject({ code: 'internal-error' });
}

async function keepsQueueDuringRefresh(): Promise<void> {
  const port = createPort();
  const refreshed = createDeferred<readonly GitReviewChangeDescriptor[]>();
  port.listChanges
    .mockResolvedValueOnce([
      change({ path: 'alpha.ts', contentIdentity: 'a'.repeat(64) }),
    ])
    .mockReturnValueOnce(refreshed.promise);
  const service = new GitReviewSessionService(port);

  await startSession(service);
  const pending = service.refresh({ aborted: false });

  expect(service.getSnapshot()).toMatchObject({
    state: 'refreshing',
    session: { currentItemPath: 'alpha.ts' },
  });

  refreshed.resolve([change({ path: 'alpha.ts', contentIdentity: 'a'.repeat(64) })]);
  await expect(pending).resolves.toMatchObject({ state: 'active' });
}

async function requiresReplacement(): Promise<void> {
  const port = createPort();
  port.listChanges
    .mockResolvedValueOnce([
      change({ path: 'alpha.ts', contentIdentity: 'a'.repeat(64) }),
    ])
    .mockResolvedValueOnce([
      change({ path: 'beta.ts', contentIdentity: 'b'.repeat(64) }),
    ]);
  const service = new GitReviewSessionService(port);

  await startSession(service, '/workspace/first');

  await expect(startSession(service, '/workspace/second')).rejects.toMatchObject({
    code: 'invalid-input',
  });
  expect(service.getSnapshot()).toMatchObject({
    state: 'active',
    session: { repositoryRoot: '/workspace/first' },
  });

  await expect(startSession(service, '/workspace/second', true)).resolves.toMatchObject(
    {
      state: 'active',
      session: { repositoryRoot: '/workspace/second', currentItemPath: 'beta.ts' },
    },
  );
}

async function rejectsInvalidDescriptors(): Promise<void> {
  const port = createPort();
  port.listChanges.mockResolvedValue([
    {
      path: '../secret.txt',
      contentIdentity: 'a'.repeat(64),
      change: 'modified',
      presentation: 'text',
    },
  ]);
  const service = new GitReviewSessionService(port);

  await expect(startSession(service)).rejects.toMatchObject({ code: 'internal-error' });
  expect(service.getSnapshot()).toEqual({ state: 'inactive' });

  port.listChanges.mockResolvedValue([
    change({ path: 'duplicate.ts', contentIdentity: 'a'.repeat(64) }),
    change({ path: 'duplicate.ts', contentIdentity: 'b'.repeat(64) }),
  ]);

  await expect(startSession(service)).rejects.toMatchObject({ code: 'internal-error' });
  expect(service.getSnapshot()).toEqual({ state: 'inactive' });
}

async function keepsLayeredItemsForSamePath(): Promise<void> {
  const port = createPort();
  port.listChanges.mockResolvedValue([
    {
      ...change({ path: 'same.ts', contentIdentity: 'a'.repeat(64) }),
      itemId: 'staged:same.ts',
      layer: 'staged',
    },
    {
      ...change({ path: 'same.ts', contentIdentity: 'b'.repeat(64) }),
      itemId: 'unstaged:same.ts',
      layer: 'unstaged',
    },
  ]);

  const snapshot = await startSession(new GitReviewSessionService(port));

  expect(snapshot).toMatchObject({
    state: 'active',
    session: {
      currentItemId: 'staged:same.ts',
      items: [
        expect.objectContaining({ itemId: 'staged:same.ts', layer: 'staged' }),
        expect.objectContaining({ itemId: 'unstaged:same.ts', layer: 'unstaged' }),
      ],
    },
  });
}

async function avoidsCancelledRefresh(): Promise<void> {
  const port = createPort();
  port.listChanges.mockResolvedValue([
    change({ path: 'alpha.ts', contentIdentity: 'a'.repeat(64) }),
  ]);
  const service = new GitReviewSessionService(port);

  await startSession(service);

  await expect(service.refresh({ aborted: true })).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(port.listChanges).toHaveBeenCalledTimes(1);
}

function activeSnapshot(
  currentItemPath: string,
  items: readonly ExpectedReviewItem[],
): object {
  return {
    state: 'active',
    session: {
      repositoryRoot: '/workspace/repository',
      currentItemPath,
      items,
      progress: {
        total: items.length,
        reviewed: items.filter((entry) => entry.reviewState === 'reviewed').length,
        skipped: items.filter((entry) => entry.reviewState === 'skipped').length,
        remaining: items.filter((entry) => entry.reviewState === 'unreviewed').length,
      },
    },
  };
}

function item(
  path: string,
  reviewState: 'unreviewed' | 'reviewed' | 'skipped',
): ExpectedReviewItem {
  return { path, reviewState };
}

function createPort(): GitReviewPort & {
  readonly listChanges: ReturnType<typeof vi.fn>;
  readonly readItemContent: ReturnType<typeof vi.fn>;
  readonly mutateItem: ReturnType<typeof vi.fn>;
} {
  return {
    listChanges: vi.fn(),
    readItemContent: vi.fn(),
    mutateItem: vi.fn(),
  };
}

function change(
  overrides: Pick<GitReviewChangeDescriptor, 'path' | 'contentIdentity'>,
): GitReviewChangeDescriptor {
  return {
    path: overrides.path,
    contentIdentity: overrides.contentIdentity,
    change: 'modified',
    presentation: 'text',
  };
}

function startSession(
  service: GitReviewSessionService,
  repositoryRoot = '/workspace/repository',
  replace = false,
): Promise<unknown> {
  return service.start({ repositoryRoot, replace }, { aborted: false });
}

function createDeferred<TValue>(): {
  readonly promise: Promise<TValue>;
  resolve(value: TValue): void;
} {
  let resolvePromise: ((value: TValue) => void) | undefined;
  const promise = new Promise<TValue>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: (value) => resolvePromise?.(value) };
}
