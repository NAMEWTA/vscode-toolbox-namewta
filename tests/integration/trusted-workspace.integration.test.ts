import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

suite('Workspace trust foundation', () => {
  test('exposes a deterministic trust state', () => {
    assert.equal(typeof vscode.workspace.isTrusted, 'boolean');
  });

  test('can create and dispose the toolbox Webview command', async () => {
    await assert.doesNotReject(async () => {
      await vscode.commands.executeCommand('vscodeToolboxNamewta.openToolbox');
    });
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });
});
