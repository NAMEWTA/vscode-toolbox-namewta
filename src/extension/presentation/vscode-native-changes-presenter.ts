import * as vscode from 'vscode';

export type VscodeNativeChangeResource = readonly [
  vscode.Uri,
  vscode.Uri | undefined,
  vscode.Uri | undefined,
];

export class VscodeNativeChangesPresenter {
  public async open(
    title: string,
    resources: readonly VscodeNativeChangeResource[],
  ): Promise<void> {
    await vscode.commands.executeCommand('vscode.changes', title, resources);
  }

  public async openDiff(
    title: string,
    original: vscode.Uri,
    modified: vscode.Uri,
  ): Promise<void> {
    await vscode.commands.executeCommand('vscode.diff', original, modified, title);
  }
}
