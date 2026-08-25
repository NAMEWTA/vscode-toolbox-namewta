import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { VscodeCopyReferenceSourceAdapter } from './vscode-copy-reference-source-adapter';

const vscodeState: {
  activeTextEditor: vscode.TextEditor | undefined;
  clipboardText: string;
  explorerCopyText: string | undefined;
  workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;
} = {
  activeTextEditor: undefined,
  clipboardText: '',
  explorerCopyText: undefined,
  workspaceFolders: undefined,
};

vi.mock('vscode', () => {
  class Position {
    public constructor(
      public readonly line: number,
      public readonly character: number,
    ) {}
  }

  class Uri {
    public static file(fsPath: string): Uri {
      return new Uri('file', '', fsPath, fsPath);
    }

    public constructor(
      public readonly scheme: string,
      public readonly authority: string,
      public readonly path: string,
      public readonly fsPath: string,
    ) {}

    public with(): Uri {
      return this;
    }

    public toString(): string {
      return `${this.scheme}:${this.path}`;
    }
  }

  return {
    commands: {
      executeCommand: async (command: string): Promise<void> => {
        if (command === 'copyFilePath' && vscodeState.explorerCopyText !== undefined) {
          vscodeState.clipboardText = vscodeState.explorerCopyText;
        }
      },
    },
    env: {
      clipboard: {
        readText: async (): Promise<string> => vscodeState.clipboardText,
        writeText: async (value: string): Promise<void> => {
          vscodeState.clipboardText = value;
        },
      },
    },
    Position,
    Uri,
    window: {
      get activeTextEditor(): vscode.TextEditor | undefined {
        return vscodeState.activeTextEditor;
      },
    },
    workspace: {
      get workspaceFolders(): readonly vscode.WorkspaceFolder[] | undefined {
        return vscodeState.workspaceFolders;
      },
    },
  };
});

describe('VS Code Copy Reference 来源适配器', () => {
  beforeEach(() => {
    vscodeState.activeTextEditor = undefined;
    vscodeState.clipboardText = '';
    vscodeState.explorerCopyText = undefined;
    vscodeState.workspaceFolders = undefined;
  });

  it('在编辑器菜单路由中使用匹配 URI 的活动编辑器选择区', async () => {
    const uri = vscode.Uri.file('/workspace/project/src/main.ts');
    vscodeState.activeTextEditor = editor(uri, 1, 4, 1, 9);
    vscodeState.workspaceFolders = [
      { uri: vscode.Uri.file('/workspace/project') } as vscode.WorkspaceFolder,
    ];

    const result = await new VscodeCopyReferenceSourceAdapter().resolve(
      'relative',
      [uri],
      'editor-context',
    );

    expect(result).toMatchObject({
      source: {
        kind: 'editor',
        selection: {
          anchor: { line: 1, character: 4 },
          active: { line: 1, character: 9 },
        },
      },
    });
  });

  it('在编辑器快捷键路由没有参数时使用活动编辑器选择区', async () => {
    const uri = vscode.Uri.file('/workspace/project/src/main.ts');
    vscodeState.activeTextEditor = editor(uri, 1, 4, 1, 9);

    const result = await new VscodeCopyReferenceSourceAdapter().resolve(
      'relative',
      [],
      'editor-context',
    );

    expect(result).toMatchObject({
      source: {
        kind: 'editor',
        selection: {
          anchor: { line: 1, character: 4 },
          active: { line: 1, character: 9 },
        },
      },
    });
  });

  it('拒绝与活动编辑器不匹配的编辑器菜单 URI', async () => {
    vscodeState.activeTextEditor = editor(
      vscode.Uri.file('/workspace/project/src/main.ts'),
      0,
      0,
      0,
      0,
    );

    expect(
      await new VscodeCopyReferenceSourceAdapter().resolve(
        'relative',
        [vscode.Uri.file('/workspace/project/src/other.ts')],
        'editor-context',
      ),
    ).toBeUndefined();
  });

  it('让原有命令参数继续表示 Explorer 资源', async () => {
    const uri = vscode.Uri.file('/workspace/project/src/main.ts');
    vscodeState.activeTextEditor = editor(uri, 1, 4, 1, 9);

    expect(
      await new VscodeCopyReferenceSourceAdapter().resolve('relative', [uri]),
    ).toMatchObject({ source: { kind: 'explorer' } });
  });

  it('在 Explorer 快捷键路由中解析当前多选资源并保持顺序', async () => {
    vscodeState.clipboardText = '原有剪贴板内容';
    vscodeState.explorerCopyText = [
      '/workspace/project/src/first.ts',
      '/workspace/project/src/second.ts',
    ].join('\n');

    const result = await new VscodeCopyReferenceSourceAdapter().resolve(
      'relative',
      [],
      'explorer-context',
    );

    expect(result).toMatchObject({
      source: {
        kind: 'explorer',
        resources: [
          { path: '/workspace/project/src/first.ts' },
          { path: '/workspace/project/src/second.ts' },
        ],
      },
    });
    expect(vscodeState.clipboardText).toBe('原有剪贴板内容');
  });

  it('在 Explorer 快捷键无法解析绝对路径时恢复原剪贴板', async () => {
    vscodeState.clipboardText = '原有剪贴板内容';
    vscodeState.explorerCopyText = 'src/main.ts';

    const result = await new VscodeCopyReferenceSourceAdapter().resolve(
      'absolute',
      [],
      'explorer-context',
    );

    expect(result).toBeUndefined();
    expect(vscodeState.clipboardText).toBe('原有剪贴板内容');
  });
});

function editor(
  uri: vscode.Uri,
  anchorLine: number,
  anchorCharacter: number,
  activeLine: number,
  activeCharacter: number,
): vscode.TextEditor {
  return {
    document: { uri },
    selection: {
      anchor: new vscode.Position(anchorLine, anchorCharacter),
      active: new vscode.Position(activeLine, activeCharacter),
    },
  } as vscode.TextEditor;
}
