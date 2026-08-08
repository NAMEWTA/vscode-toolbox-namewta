import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { VscodeToolboxNamewtaExtensionApi } from '../core/contracts';

suite('vscode-toolbox-namewta extension', () => {
  test('activates and exposes the versioned public API', async () => {
    const extension = vscode.extensions.getExtension<VscodeToolboxNamewtaExtensionApi>(
      'NAMEWTA.vscode-toolbox-namewta',
    );
    assert.ok(extension);

    const api = await extension.activate();
    assert.equal(api.apiVersion, 1);
    assert.deepEqual(api.getCapabilities(), [
      { command: 'copyReference.copy', available: true },
      { command: 'gitBlame.copyCommitHash', available: true },
      { command: 'gitBlame.getAnnotations', available: true },
      { command: 'gitBlame.getCommitChanges', available: true },
      { command: 'gitBlame.getHistoricalContent', available: true },
      { command: 'gitBlame.getLineHistory', available: true },
      { command: 'system.getRuntimeInfo', available: true },
    ]);
  });

  test('registers the foundation, copy and blame visibility commands', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('vscodeToolboxNamewta.openToolbox'));
    assert.ok(commands.includes('vscodeToolboxNamewta.showRuntimeInfo'));
    assert.ok(commands.includes('vscodeToolboxNamewta.copyReference.relative'));
    assert.ok(commands.includes('vscodeToolboxNamewta.copyReference.absolute'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitBlame.toggle'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitBlame.show'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitBlame.hide'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitBlame.refresh'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitBlame.viewLineHistory'));
  });

  test('executes runtime info through the public API', async () => {
    const extension = vscode.extensions.getExtension<VscodeToolboxNamewtaExtensionApi>(
      'NAMEWTA.vscode-toolbox-namewta',
    );
    assert.ok(extension);
    const api = await extension.activate();

    const result = await api.execute('system.getRuntimeInfo', {});
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.apiVersion, 1);
      assert.equal(typeof result.data.isWorkspaceTrusted, 'boolean');
    }
  });

  test('copies relative and absolute editor references', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder);
    const uri = vscode.Uri.joinPath(workspaceFolder.uri, 'README.md');
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(0, 0, 0, 0);

    await vscode.commands.executeCommand('vscodeToolboxNamewta.copyReference.relative');
    assert.equal(await vscode.env.clipboard.readText(), '`README.md:1`');

    await vscode.commands.executeCommand('vscodeToolboxNamewta.copyReference.absolute');
    assert.equal(await vscode.env.clipboard.readText(), `\`${uri.fsPath}:1\``);
  });

  test('does not fall back to the active editor for invalid explorer input', async () => {
    await vscode.env.clipboard.writeText('unchanged');

    await vscode.commands.executeCommand(
      'vscodeToolboxNamewta.copyReference.relative',
      {
        invalid: true,
      },
    );

    assert.equal(await vscode.env.clipboard.readText(), 'unchanged');
  });

  test('preserves explicit explorer selection order', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder);
    const first = vscode.Uri.joinPath(workspaceFolder.uri, 'README.md');
    const second = vscode.Uri.joinPath(workspaceFolder.uri, 'future.ts');

    await vscode.commands.executeCommand(
      'vscodeToolboxNamewta.copyReference.relative',
      first,
      [second, first],
    );

    assert.equal(
      await vscode.env.clipboard.readText(),
      '```\nfuture.ts\nREADME.md\n```',
    );
  });

  test('does not copy an untitled editor resource', async () => {
    const document = await vscode.workspace.openTextDocument({ content: 'draft' });
    await vscode.window.showTextDocument(document);
    await vscode.env.clipboard.writeText('unchanged');

    await vscode.commands.executeCommand('vscodeToolboxNamewta.copyReference.relative');

    assert.equal(await vscode.env.clipboard.readText(), 'unchanged');
  });
});
