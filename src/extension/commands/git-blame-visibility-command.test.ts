import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitBlameVisibilityHost } from './git-blame-visibility-command';

const vscodeState = vi.hoisted(() => ({
  statusBar: {
    text: '',
    tooltip: undefined as string | undefined,
    command: undefined as string | undefined,
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  },
  selectionListener: undefined as
    | ((event: { textEditor: unknown; selections: readonly unknown[] }) => void)
    | undefined,
  listeners: [] as { readonly dispose: ReturnType<typeof vi.fn> }[],
  activeTextEditor: undefined as unknown,
}));

vi.mock('vscode', () => ({
  StatusBarAlignment: { Right: 2 },
  l10n: { t: (value: string): string => value },
  workspace: {
    onDidCloseTextDocument: listener(),
    onDidSaveTextDocument: listener(),
    onDidChangeTextDocument: listener(),
    onDidChangeConfiguration: listener(),
    textDocuments: [],
  },
  window: {
    createStatusBarItem: vi.fn(() => vscodeState.statusBar),
    onDidChangeVisibleTextEditors: listener(),
    onDidChangeTextEditorSelection: vi.fn(
      (callback: typeof vscodeState.selectionListener) => {
        vscodeState.selectionListener = callback;
        const disposable = { dispose: vi.fn() };
        vscodeState.listeners.push(disposable);
        return disposable;
      },
    ),
    get activeTextEditor(): unknown {
      return vscodeState.activeTextEditor;
    },
  },
}));

function listener(): ReturnType<typeof vi.fn> {
  return vi.fn(() => {
    const disposable = { dispose: vi.fn() };
    vscodeState.listeners.push(disposable);
    return disposable;
  });
}

beforeEach(() => {
  vscodeState.listeners.splice(0);
  vscodeState.statusBar.text = '';
  vscodeState.statusBar.tooltip = undefined;
  vscodeState.statusBar.command = undefined;
  vscodeState.activeTextEditor = undefined;
});

describe('GitBlameVisibilityHost', () => {
  it('shows current-line identity in the status bar and disposes it', () => {
    const uri = { toString: (): string => 'file:///repo/main.ts' };
    const editor = { document: { uri }, selection: { active: { line: 1 } } };
    vscodeState.activeTextEditor = editor;
    const controller = {
      hide: vi.fn(),
      show: vi.fn(),
      applyContentChanges: vi.fn(),
      rerender: vi.fn(),
      getState: vi.fn(() => 'ready'),
      getTrackedDocumentKeys: vi.fn(() => ['file:///repo/main.ts']),
      getLineIdentity: vi.fn(() => ({
        documentKey: 'file:///repo/main.ts',
        documentVersion: 1,
        generation: 1,
        blame: {
          line: 2,
          commit: 'a'.repeat(40),
          author: 'Alice',
          email: 'alice@example.com',
          authoredAt: 1_700_000_000,
          summary: 'Initial',
        },
      })),
      dispose: vi.fn(),
    };
    const host = new GitBlameVisibilityHost(
      controller as never,
      { read: vi.fn() } as never,
    );
    vscodeState.selectionListener?.({ textEditor: editor, selections: [] });
    expect(vscodeState.statusBar.text).toContain('Alice');
    expect(vscodeState.statusBar.text).toContain('aaaaaaaaaaaa');
    expect(vscodeState.statusBar.tooltip).toBe('Initial');
    expect(vscodeState.statusBar.command).toBe(
      'vscodeToolboxNamewta.gitBlame.openReader',
    );
    expect(vscodeState.statusBar.show).toHaveBeenCalled();
    host.dispose();
    expect(vscodeState.statusBar.dispose).toHaveBeenCalled();
  });
});
