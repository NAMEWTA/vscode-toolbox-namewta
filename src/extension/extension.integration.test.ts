import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { VscodeToolboxNamewtaExtensionApi } from '../core/contracts';

// 集成测试按扩展公共 API 和命令注册边界分组，保持单一激活上下文。
// eslint-disable-next-line max-lines-per-function
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
      { command: 'gitBlame.copyReader', available: true },
      { command: 'gitBlame.getAnnotations', available: true },
      { command: 'gitBlame.getCommitChanges', available: true },
      { command: 'gitBlame.getHistoricalContent', available: true },
      { command: 'gitBlame.getLineHistory', available: true },
      { command: 'gitBlame.getReaderModel', available: true },
      { command: 'gitCompare.compareCommits', available: true },
      { command: 'gitCompare.getRevisionContent', available: true },
      { command: 'gitCompare.listCommits', available: true },
      { command: 'gitReview.discardItem', available: true },
      { command: 'gitReview.end', available: true },
      { command: 'gitReview.getItemContent', available: true },
      { command: 'gitReview.getItemPatch', available: true },
      { command: 'gitReview.markReviewedAndNext', available: true },
      { command: 'gitReview.markStale', available: true },
      { command: 'gitReview.next', available: true },
      { command: 'gitReview.previous', available: true },
      { command: 'gitReview.refresh', available: true },
      { command: 'gitReview.retry', available: true },
      { command: 'gitReview.skip', available: true },
      { command: 'gitReview.stageItem', available: true },
      { command: 'gitReview.start', available: true },
      { command: 'gitReview.unstageItem', available: true },
      { command: 'system.getRuntimeInfo', available: true },
    ]);
  });

  test('注册基础、复制、Git Blame、Git Review 与 Git Compare 命令', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('vscodeToolboxNamewta.openToolbox'));
    assert.ok(commands.includes('vscodeToolboxNamewta.showRuntimeInfo'));
    assert.ok(commands.includes('vscodeToolboxNamewta.copyReference.relative'));
    assert.ok(commands.includes('vscodeToolboxNamewta.copyReference.absolute'));
    assert.ok(commands.includes('vscodeToolboxNamewta.copyReference.editor.relative'));
    assert.ok(commands.includes('vscodeToolboxNamewta.copyReference.editor.absolute'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitBlame.toggle'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitBlame.show'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitBlame.hide'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitBlame.refresh'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitBlame.viewLineHistory'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitBlame.openReader'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitReview.start'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitReview.previous'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitReview.next'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitReview.markReviewedAndNext'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitReview.retry'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitReview.skip'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitReview.refresh'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitReview.end'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitCompare.openHistory'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitCompare.refresh'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitCompare.setReference'));
    assert.ok(
      commands.includes('vscodeToolboxNamewta.gitCompare.compareWithReference'),
    );
    assert.ok(commands.includes('vscodeToolboxNamewta.gitCompare.clearReference'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitCompare.loadMore'));
    assert.ok(commands.includes('vscodeToolboxNamewta.gitCompare.openFileDiff'));
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

  test('copies the active editor selection from the editor context route', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder);
    const uri = vscode.Uri.joinPath(workspaceFolder.uri, 'README.md');
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(1, 4, 1, 9);

    await vscode.commands.executeCommand(
      'vscodeToolboxNamewta.copyReference.editor.relative',
      uri,
    );

    assert.equal(await vscode.env.clipboard.readText(), '`README.md:2(5-9)`');
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
});

suite('vscode-toolbox-namewta copy reference boundary', () => {
  test('does not copy an untitled editor resource', async () => {
    const document = await vscode.workspace.openTextDocument({ content: 'draft' });
    await vscode.window.showTextDocument(document);
    await vscode.env.clipboard.writeText('unchanged');

    await vscode.commands.executeCommand('vscodeToolboxNamewta.copyReference.relative');

    assert.equal(await vscode.env.clipboard.readText(), 'unchanged');
  });
});
