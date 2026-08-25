import path from 'node:path';
import * as vscode from 'vscode';
import type {
  CopyReferenceInput,
  CopyReferenceMode,
  CopyReferenceSource,
  ResourceSnapshot,
} from '../../core/domains/copy-reference/public-api';

export type CopyReferenceSourceRoute =
  | 'automatic'
  | 'editor-context'
  | 'explorer-context';

export class VscodeCopyReferenceSourceAdapter {
  public async resolve(
    mode: CopyReferenceMode,
    commandArguments: readonly unknown[],
    route: CopyReferenceSourceRoute = 'automatic',
  ): Promise<CopyReferenceInput | undefined> {
    const source =
      route === 'editor-context'
        ? resolveEditorContextSource(commandArguments, vscode.window.activeTextEditor)
        : route === 'explorer-context'
          ? await resolveExplorerContextSource(commandArguments)
          : commandArguments.length > 0
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

async function resolveExplorerContextSource(
  commandArguments: readonly unknown[],
): Promise<CopyReferenceSource | undefined> {
  if (commandArguments.length > 0) {
    return resolveExplorerSource(commandArguments);
  }

  const resources = await readFocusedExplorerResources();
  if (resources === undefined) {
    return undefined;
  }
  return { kind: 'explorer', resources: resources.map(snapshotResource) };
}

async function readFocusedExplorerResources(): Promise<
  readonly vscode.Uri[] | undefined
> {
  let previousClipboard: string | undefined;
  try {
    previousClipboard = await vscode.env.clipboard.readText();
    await vscode.env.clipboard.writeText('');
    await vscode.commands.executeCommand('copyFilePath');
    const copiedPaths = await vscode.env.clipboard.readText();
    const filePaths = copiedPaths.split(/\r?\n/u);
    if (
      copiedPaths.length === 0 ||
      filePaths.some((filePath) => !path.isAbsolute(filePath))
    ) {
      await vscode.env.clipboard.writeText(previousClipboard);
      return undefined;
    }
    const resources = filePaths.map((filePath) => vscode.Uri.file(filePath));
    await vscode.env.clipboard.writeText(previousClipboard);
    return resources;
  } catch {
    if (previousClipboard !== undefined) {
      try {
        await vscode.env.clipboard.writeText(previousClipboard);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

function resolveEditorContextSource(
  commandArguments: readonly unknown[],
  editor: vscode.TextEditor | undefined,
): CopyReferenceSource | undefined {
  if (commandArguments.length === 0) {
    return resolveEditorSource(editor);
  }
  if (
    commandArguments.length !== 1 ||
    !isUri(commandArguments[0]) ||
    editor === undefined ||
    editor.document.uri.toString(true) !== commandArguments[0].toString(true)
  ) {
    return undefined;
  }
  return resolveEditorSource(editor);
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
