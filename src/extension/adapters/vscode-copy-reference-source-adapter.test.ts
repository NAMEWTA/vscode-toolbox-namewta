import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { VscodeCopyReferenceSourceAdapter } from './vscode-copy-reference-source-adapter';

const vscodeState: {
  activeTextEditor: vscode.TextEditor | undefined;
  workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;
} = {
  activeTextEditor: undefined,
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
    vscodeState.workspaceFolders = undefined;
  });

  it('在编辑器菜单路由中使用匹配 URI 的活动编辑器选择区', () => {
    const uri = vscode.Uri.file('/workspace/project/src/main.ts');
    vscodeState.activeTextEditor = editor(uri, 1, 4, 1, 9);
    vscodeState.workspaceFolders = [
      { uri: vscode.Uri.file('/workspace/project') } as vscode.WorkspaceFolder,
    ];

    const result = new VscodeCopyReferenceSourceAdapter().resolve(
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

  it('拒绝与活动编辑器不匹配的编辑器菜单 URI', () => {
    vscodeState.activeTextEditor = editor(
      vscode.Uri.file('/workspace/project/src/main.ts'),
      0,
      0,
      0,
      0,
    );

    expect(
      new VscodeCopyReferenceSourceAdapter().resolve(
        'relative',
        [vscode.Uri.file('/workspace/project/src/other.ts')],
        'editor-context',
      ),
    ).toBeUndefined();
  });

  it('让原有命令参数继续表示 Explorer 资源', () => {
    const uri = vscode.Uri.file('/workspace/project/src/main.ts');
    vscodeState.activeTextEditor = editor(uri, 1, 4, 1, 9);

    expect(
      new VscodeCopyReferenceSourceAdapter().resolve('relative', [uri]),
    ).toMatchObject({ source: { kind: 'explorer' } });
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
