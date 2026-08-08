import { describe, expect, it, vi } from 'vitest';
import type { GitBlameAnnotationsResult } from '../../core/domains/git-blame/public-api';
import {
  GitBlameAnnotationController,
  type GitBlameAnnotationLoader,
  type GitBlameAnnotationRenderer,
  type GitBlameConfiguration,
  type GitBlameDocumentSnapshot,
} from './git-blame-annotation-controller';

describe('GitBlameAnnotationController', () => {
  it('does not load Git when line count exceeds maxLines', async () => {
    const loader = vi.fn<GitBlameAnnotationLoader>();
    const renderer = createRenderer();
    const controller = new GitBlameAnnotationController(loader, renderer);

    await controller.show(document(201), config(200));

    expect(loader).not.toHaveBeenCalled();
    expect(controller.getState('file:///repo/main.ts')).toBe('unavailable');
    expect(renderer.clear).toHaveBeenCalledWith('file:///repo/main.ts');
  });

  it('allows only the latest generation to render', async () => {
    const pending: ((value: GitBlameAnnotationsResult) => void)[] = [];
    const loader = vi.fn<GitBlameAnnotationLoader>(
      () => new Promise((resolve) => pending.push(resolve)),
    );
    const renderer = createRenderer();
    const controller = new GitBlameAnnotationController(loader, renderer);

    const first = controller.show(document(1), config());
    const second = controller.show({ ...document(1), version: 2 }, config());
    pending[0]?.(available(1));
    pending[1]?.(available(2));
    await Promise.all([first, second]);

    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenCalledWith(
      expect.objectContaining({ version: 2 }),
      expect.any(Array),
      expect.any(Object),
      undefined,
    );
  });

  it('clears data and aborts pending work on hide and dispose', async () => {
    const loader = vi.fn<GitBlameAnnotationLoader>(
      (_document, _config, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(abortError()), { once: true });
        }),
    );
    const renderer = createRenderer();
    const controller = new GitBlameAnnotationController(loader, renderer);
    const pending = controller.show(document(1), config());

    controller.hide('file:///repo/main.ts');
    await pending;
    controller.dispose();

    expect(controller.getState('file:///repo/main.ts')).toBe('disabled');
    expect(renderer.clear).toHaveBeenCalledWith('file:///repo/main.ts');
    expect(renderer.dispose).toHaveBeenCalled();
  });

  it('maps content changes in memory without loading Git again', async () => {
    const loader = vi.fn<GitBlameAnnotationLoader>().mockResolvedValue(available(1));
    const renderer = createRenderer();
    const controller = new GitBlameAnnotationController(loader, renderer);
    await controller.show(document(1), config());

    controller.applyContentChanges(
      'file:///repo/main.ts',
      [
        {
          startLine: 0,
          endLine: 0,
          startCharacter: 1,
          endCharacter: 1,
          insertedLineBreakCount: 0,
          insertedTextLength: 1,
          insertedTextEndsWithLineBreak: false,
        },
      ],
      2,
      1,
    );

    expect(loader).toHaveBeenCalledTimes(1);
    expect(controller.getState('file:///repo/main.ts')).toBe('dirty');
    expect(renderer.render).toHaveBeenLastCalledWith(
      expect.objectContaining({ version: 2 }),
      [expect.objectContaining({ commit: '0'.repeat(40) })],
      expect.any(Object),
      undefined,
    );
  });

  it('exposes only current committed line identities and invalidates them on refresh', async () => {
    const loader = vi
      .fn<GitBlameAnnotationLoader>()
      .mockResolvedValueOnce({ ...available(1), remoteUrl: 'git@github.com:a/b.git' })
      .mockResolvedValueOnce(available(2));
    const controller = new GitBlameAnnotationController(loader, createRenderer());
    await controller.show(document(1), config());

    const first = controller.getLineIdentity('file:///repo/main.ts', 1);
    expect(first).toMatchObject({
      generation: 1,
      blame: { commit: 'a'.repeat(40) },
      remoteUrl: 'git@github.com:a/b.git',
    });

    await controller.show({ ...document(1), version: 2 }, config());
    expect(controller.getLineIdentity('file:///repo/main.ts', 1)?.generation).not.toBe(
      first?.generation,
    );
    controller.hide('file:///repo/main.ts');
    expect(controller.getLineIdentity('file:///repo/main.ts', 1)).toBeUndefined();
  });
});

function document(lineCount: number): GitBlameDocumentSnapshot {
  return { key: 'file:///repo/main.ts', version: 1, lineCount };
}

function config(maxLines = 20_000): GitBlameConfiguration {
  return {
    dateFormatStyle: 'Y/M/D' as const,
    authorNameStyle: 'full' as const,
    mergeCommitLines: false,
    highlightCurrentCommit: false,
    ignoreWhitespace: false,
    maxLines,
  };
}

function available(
  documentVersion: number,
): Extract<GitBlameAnnotationsResult, { readonly status: 'available' }> {
  return {
    status: 'available',
    documentVersion,
    lines: [
      {
        line: 1,
        commit: 'a'.repeat(40),
        author: 'Alice',
        email: 'alice@example.com',
        authoredAt: 1_700_000_000,
        summary: 'initial',
      },
    ],
  };
}

function createRenderer(): GitBlameAnnotationRenderer & {
  readonly render: ReturnType<typeof vi.fn>;
  readonly clear: ReturnType<typeof vi.fn>;
  readonly dispose: ReturnType<typeof vi.fn>;
} {
  return { render: vi.fn(), clear: vi.fn(), dispose: vi.fn() };
}

function abortError(): Error {
  const error = new Error('cancelled');
  error.name = 'AbortError';
  return error;
}
