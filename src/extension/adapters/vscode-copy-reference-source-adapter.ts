import * as vscode from 'vscode';
import type {
  CopyReferenceInput,
  CopyReferenceMode,
  CopyReferenceSource,
  ResourceSnapshot,
} from '../../core/domains/copy-reference/public-api';

export class VscodeCopyReferenceSourceAdapter {
  public resolve(
    mode: CopyReferenceMode,
    commandArguments: readonly unknown[],
  ): CopyReferenceInput | undefined {
    const source =
      commandArguments.length > 0
        ? resolveExplorerSource(commandArguments)
        : resolveEditorSource(vscode.window.activeTextEditor);
    if (source === undefined) {
      return undefined;
    }

    return {
      mode,
      source,
      workspaceFolders:
        vscode.workspace.workspaceFolders?.map(({ uri }) => snapshotResource(uri)) ??
        [],
    };
  }
}

function resolveExplorerSource(
  commandArguments: readonly unknown[],
): CopyReferenceSource | undefined {
  const firstResource = commandArguments[0];
  const selectedResources = commandArguments[1];
  if (selectedResources !== undefined) {
    if (
      !Array.isArray(selectedResources) ||
      selectedResources.length === 0 ||
      !selectedResources.every(isUri)
    ) {
      return undefined;
    }
    return {
      kind: 'explorer',
      resources: selectedResources.map(snapshotResource),
    };
  }
  if (!isUri(firstResource)) {
    return undefined;
  }
  return { kind: 'explorer', resources: [snapshotResource(firstResource)] };
}

function isUri(value: unknown): value is vscode.Uri {
  return value instanceof vscode.Uri;
}

function resolveEditorSource(
  editor: vscode.TextEditor | undefined,
): CopyReferenceSource | undefined {
  if (editor === undefined || editor.document.uri.scheme === 'untitled') {
    return undefined;
  }
  return {
    kind: 'editor',
    resource: snapshotResource(editor.document.uri),
    selection: {
      anchor: snapshotPosition(editor.selection.anchor),
      active: snapshotPosition(editor.selection.active),
    },
  };
}

function snapshotResource(uri: vscode.Uri): ResourceSnapshot {
  return {
    scheme: uri.scheme,
    authority: uri.authority,
    path: uri.path,
    absolute:
      uri.scheme === 'file'
        ? uri.fsPath
        : uri.with({ query: '', fragment: '' }).toString(true),
  };
}

function snapshotPosition(position: vscode.Position): {
  readonly line: number;
  readonly character: number;
} {
  return { line: position.line, character: position.character };
}
