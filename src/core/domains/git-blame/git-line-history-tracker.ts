import { ApplicationError } from '../../kernel/application-error';
import type { GitCancellationSignal } from './git-blame-port';
import type { GitLineHistoryInput, GitLineHistoryPage } from './git-blame-model';
import {
  decodeGitLineHistoryCursor,
  encodeGitLineHistoryCursor,
  hashGitLineHistoryLocator,
  hashGitLineHistoryResource,
  type GitLineHistoryCursorState,
  type GitLineHistoryLocator,
  type GitLineHistoryPort,
} from './git-line-history-model';

export class GitLineHistoryTracker {
  public constructor(private readonly port: GitLineHistoryPort) {}

  public async getPage(
    input: GitLineHistoryInput,
    signal: GitCancellationSignal,
  ): Promise<GitLineHistoryPage> {
    const state = createState(input);
    const visited = new Set(state.visited);
    const entries: GitLineHistoryPage['entries'][number][] = [];
    let current = state.current;
    let complete = false;

    while (entries.length < input.limit) {
      assertNotCancelled(signal);
      const currentHash = hashGitLineHistoryLocator(current);
      if (visited.has(currentHash)) {
        complete = true;
        break;
      }
      visited.add(currentHash);
      const step = await this.port.getLineHistoryStep(input.resource, current, signal);
      entries.push(step.entry);
      if (step.previous === undefined) {
        complete = true;
        break;
      }
      current = step.previous;
      if (visited.has(hashGitLineHistoryLocator(current))) {
        complete = true;
        break;
      }
    }

    if (complete) {
      return { entries, complete: true };
    }
    const nextCursor = tryEncodeCursor({
      resourceHash: state.resourceHash,
      origin: state.origin,
      current,
      visited: [...visited],
    });
    return nextCursor === undefined
      ? { entries, complete: true }
      : { entries, complete: false, nextCursor };
  }
}

function createState(input: GitLineHistoryInput): GitLineHistoryCursorState {
  const origin: GitLineHistoryLocator = {
    ref: input.ref,
    path: input.path,
    line: input.line,
  };
  const resourceHash = hashGitLineHistoryResource(input.resource);
  if (input.cursor === undefined) {
    return { resourceHash, origin, current: origin, visited: [] };
  }
  const state = decodeGitLineHistoryCursor(input.cursor);
  if (state.resourceHash !== resourceHash || !isSameLocator(state.origin, origin)) {
    throw new ApplicationError('Git line history cursor does not match the request.', {
      code: 'invalid-input',
    });
  }
  return state;
}

function tryEncodeCursor(state: GitLineHistoryCursorState): string | undefined {
  try {
    return encodeGitLineHistoryCursor(state);
  } catch (error: unknown) {
    if (error instanceof ApplicationError && error.code === 'invalid-input') {
      return undefined;
    }
    throw error;
  }
}

function isSameLocator(
  first: GitLineHistoryLocator,
  second: GitLineHistoryLocator,
): boolean {
  return (
    first.ref === second.ref && first.path === second.path && first.line === second.line
  );
}

function assertNotCancelled(signal: GitCancellationSignal): void {
  if (signal.aborted) {
    const error = new Error('The Git line history request was cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}
