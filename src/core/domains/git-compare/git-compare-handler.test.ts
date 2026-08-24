import { describe, expect, it, vi } from 'vitest';
import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import {
  GitCompareCommitsHandler,
  GitCompareListCommitsHandler,
  GitCompareResolveRevisionHandler,
  GitCompareRevisionContentHandler,
  GitCompareSearchCommitsHandler,
} from './git-compare-handler';
import type { GitComparePort } from './git-compare-port';

const base = 'a'.repeat(40);
const target = 'b'.repeat(40);
const input = { repositoryRoot: '/repo' };

describe('Git compare handlers', () => {
  it('delegates history, revision resolution, comparison and content through the port', async () => {
    const port = createPort();
    port.listCommits.mockResolvedValue({ commits: [], complete: true });
    port.compareCommits.mockResolvedValue({
      changes: [],
      stats: { files: 0, additions: 0, deletions: 0 },
    });
    port.getRevisionContent.mockResolvedValue({ kind: 'text', content: 'code' });
    port.resolveRevision.mockResolvedValue({
      sha: base,
      parents: [],
      author: 'Alice',
      authoredAt: 1_700_000_000_000,
      subject: 'Initial',
    });
    port.searchCommits.mockResolvedValue({ matches: [] });
    const context = createContext();
    await expect(
      new GitCompareListCommitsHandler(port).execute({ ...input, limit: 10 }, context),
    ).resolves.toEqual({ commits: [], complete: true });
    await expect(
      new GitCompareSearchCommitsHandler(port).execute(
        { ...input, query: 'feature', limit: 10 },
        context,
      ),
    ).resolves.toEqual({ matches: [] });
    await expect(
      new GitCompareCommitsHandler(port).execute({ ...input, base, target }, context),
    ).resolves.toMatchObject({ base, target, stats: { files: 0 } });
    await expect(
      new GitCompareResolveRevisionHandler(port).execute(
        { ...input, revision: 'aaaa' },
        context,
      ),
    ).resolves.toMatchObject({ sha: base, subject: 'Initial' });
    await expect(
      new GitCompareRevisionContentHandler(port).execute(
        { ...input, ref: base, path: 'main.ts' },
        context,
      ),
    ).resolves.toEqual({ kind: 'text', content: 'code' });
    expect(port.listCommits).toHaveBeenCalledOnce();
    expect(port.searchCommits).toHaveBeenCalledOnce();
    expect(port.compareCommits).toHaveBeenCalledOnce();
    expect(port.resolveRevision).toHaveBeenCalledOnce();
    expect(port.getRevisionContent).toHaveBeenCalledOnce();
  });

  it('rejects all operations before invoking the port when cancelled', async () => {
    const port = createPort();
    const context = createContext(true);
    await expect(
      new GitCompareListCommitsHandler(port).execute({ ...input, limit: 10 }, context),
    ).rejects.toMatchObject({ name: 'AbortError' });
    await expect(
      new GitCompareSearchCommitsHandler(port).execute(
        { ...input, query: 'feature', limit: 10 },
        context,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    await expect(
      new GitCompareCommitsHandler(port).execute({ ...input, base, target }, context),
    ).rejects.toMatchObject({ name: 'AbortError' });
    await expect(
      new GitCompareResolveRevisionHandler(port).execute(
        { ...input, revision: 'aaaa' },
        context,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    await expect(
      new GitCompareRevisionContentHandler(port).execute(
        { ...input, ref: base, path: 'main.ts' },
        context,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(port.listCommits).not.toHaveBeenCalled();
    expect(port.searchCommits).not.toHaveBeenCalled();
    expect(port.compareCommits).not.toHaveBeenCalled();
    expect(port.resolveRevision).not.toHaveBeenCalled();
    expect(port.getRevisionContent).not.toHaveBeenCalled();
  });
});

function createPort(): GitComparePort & {
  readonly listCommits: ReturnType<typeof vi.fn>;
  readonly searchCommits: ReturnType<typeof vi.fn>;
  readonly compareCommits: ReturnType<typeof vi.fn>;
  readonly resolveRevision: ReturnType<typeof vi.fn>;
  readonly getRevisionContent: ReturnType<typeof vi.fn>;
} {
  return {
    listCommits: vi.fn(),
    searchCommits: vi.fn(),
    compareCommits: vi.fn(),
    resolveRevision: vi.fn(),
    getRevisionContent: vi.fn(),
  };
}

function createContext(aborted = false): ToolExecutionContext {
  return {
    signal: { aborted },
    requestId: 'compare-test',
    source: 'extension-api',
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}
