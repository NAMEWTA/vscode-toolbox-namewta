import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitBlameReaderModel } from '../../core/domains/git-blame/public-api';
import { GitBlameReaderController } from './git-blame-reader-controller';

const vscodeState = vi.hoisted(() => ({
  receive: undefined as ((message: unknown) => void) | undefined,
  postMessage: vi.fn(() => Promise.resolve(true)),
  showErrorMessage: vi.fn(),
  document: undefined as unknown,
}));

vi.mock('vscode', () => ({
  ViewColumn: { Active: 1 },
  l10n: { t: (value: string): string => value },
  Uri: {
    joinPath: (base: { toString(): string }, ...parts: readonly string[]) =>
      uri(`${base.toString()}/${parts.join('/')}`),
    parse: (value: string) => uri(value),
  },
  workspace: {
    getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }),
    onDidChangeTextDocument: listener,
    onDidSaveTextDocument: listener,
    get textDocuments(): readonly unknown[] {
      return [vscodeState.document];
    },
  },
  window: {
    get activeTextEditor(): unknown {
      return { document: vscodeState.document, selection: { active: { line: 0 } } };
    },
    createWebviewPanel: () => panel(),
    showErrorMessage: vscodeState.showErrorMessage,
    showInformationMessage: vi.fn(),
  },
  env: { language: 'en', clipboard: {}, openExternal: vi.fn() },
}));

beforeEach(() => {
  vscodeState.receive = undefined;
  vscodeState.postMessage.mockClear();
  vscodeState.showErrorMessage.mockClear();
  vscodeState.document = document();
});

describe('GitBlameReaderController', () => {
  it('keeps refresh loading and failure states on the visible generation', async () => {
    const gateway = {
      execute: vi
        .fn()
        .mockResolvedValueOnce({ ok: true, data: model() })
        .mockResolvedValueOnce({
          ok: false,
          error: {
            code: 'internal-error',
            message: 'failed',
            retryable: false,
          },
        }),
    };
    const controller = new GitBlameReaderController(
      uri('file:///extension') as never,
      gateway as never,
      { error: vi.fn() } as never,
      { set: vi.fn(), get: vi.fn(), clear: vi.fn() } as never,
      {} as never,
      {
        resolve: vi.fn().mockResolvedValue({
          repositoryRoot: '/repo',
          relativePath: 'main.ts',
        }),
      } as never,
    );

    await controller.open();
    vscodeState.receive?.({ type: 'gitBlameReader.refresh', generation: 1 });
    await vi.waitFor(() => expect(gateway.execute).toHaveBeenCalledTimes(2));
    await vi.waitFor(() =>
      expect(vscodeState.postMessage).toHaveBeenCalledWith({
        type: 'gitBlameReader.state',
        state: 'failed',
        generation: 1,
        message: 'Git Blame Reader could not be loaded.',
      }),
    );

    expect(vscodeState.postMessage).toHaveBeenCalledWith({
      type: 'gitBlameReader.state',
      state: 'loading',
      generation: 1,
      message: 'Loading Git Blame Reader…',
    });
    controller.dispose();
  });
});

function listener(): { dispose(): void } {
  return { dispose: vi.fn() };
}

function uri(value: string): {
  readonly scheme: string;
  toString(): string;
} {
  return {
    scheme: value.split(':', 1)[0] ?? 'file',
    toString: () => value,
  };
}

function document(): {
  readonly uri: ReturnType<typeof uri>;
  readonly version: number;
  readonly lineCount: number;
  getText(): string;
} {
  return {
    uri: uri('file:///repo/main.ts'),
    version: 1,
    lineCount: 1,
    getText: () => 'const value = 1;',
  };
}

function panel(): unknown {
  return {
    title: '',
    reveal: vi.fn(),
    dispose: vi.fn(),
    onDidDispose: listener,
    webview: {
      cspSource: 'vscode-webview://reader',
      html: '',
      asWebviewUri: (value: unknown) => value,
      postMessage: vscodeState.postMessage,
      onDidReceiveMessage: (callback: (message: unknown) => void) => {
        vscodeState.receive = callback;
        return listener();
      },
    },
  };
}

function model(): GitBlameReaderModel {
  const blame = {
    line: 1,
    commit: 'a'.repeat(40),
    author: 'Alice',
    email: 'alice@example.com',
    authoredAt: 1_700_000_000,
    summary: 'Initial',
  };
  const line = {
    line: 1,
    text: 'const value = 1;',
    blame,
    kind: 'committed' as const,
  };
  return {
    version: 1,
    generation: 1,
    sourceUri: 'file:///repo/main.ts',
    resource: { repositoryRoot: '/repo', relativePath: 'main.ts' },
    revision: 'HEAD',
    documentVersion: 1,
    sourceLine: 1,
    lineCount: 1,
    lineEnding: '\n',
    hasFinalNewline: false,
    lines: [line],
    blocks: [
      {
        blockId: 'block-1-aaaaaaaaaaaa',
        startLine: 1,
        endLine: 1,
        commit: blame.commit,
        kind: 'committed',
        author: blame.author,
        email: blame.email,
        authoredAt: blame.authoredAt,
        summary: blame.summary,
        lines: [line],
      },
    ],
  };
}
