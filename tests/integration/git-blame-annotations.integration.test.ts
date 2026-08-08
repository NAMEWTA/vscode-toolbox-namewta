import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';

const executeFile = promisify(execFile);

suite('Git blame annotations integration', () => {
  test('shows, refreshes and clears annotations across visible editors', async () => {
    const repository = await createRepository();
    try {
      const document = await vscode.workspace.openTextDocument(
        vscode.Uri.file(path.join(repository, 'main.ts')),
      );
      await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
      await vscode.window.showTextDocument(document, vscode.ViewColumn.Two);

      await assert.doesNotReject(
        Promise.resolve(
          vscode.commands.executeCommand('vscodeToolboxNamewta.gitBlame.show'),
        ),
      );
      const editor = vscode.window.activeTextEditor;
      assert.ok(editor);
      assert.equal(
        await editor.edit((builder) =>
          builder.insert(new vscode.Position(0, 0), 'changed '),
        ),
        true,
      );
      assert.equal(await document.save(), true);
      await assert.doesNotReject(
        Promise.resolve(
          vscode.commands.executeCommand('vscodeToolboxNamewta.gitBlame.refresh'),
        ),
      );
      await assert.doesNotReject(
        Promise.resolve(
          vscode.commands.executeCommand('vscodeToolboxNamewta.gitBlame.hide'),
        ),
      );
      await assert.doesNotReject(
        Promise.resolve(
          vscode.commands.executeCommand('vscodeToolboxNamewta.gitBlame.toggle'),
        ),
      );
      await vscode.commands.executeCommand('vscodeToolboxNamewta.gitBlame.hide');
    } finally {
      await vscode.commands.executeCommand('workbench.action.closeAllGroups');
      await rm(repository, { recursive: true, force: true });
    }
  });
});

async function createRepository(): Promise<string> {
  const repository = await mkdtemp(
    path.join(tmpdir(), 'vscode-toolbox-namewta-host-annotations-'),
  );
  await git(repository, ['init']);
  await git(repository, ['config', 'user.name', 'vscode-toolbox-namewta Test']);
  await git(repository, ['config', 'user.email', 'test@example.invalid']);
  await writeFile(path.join(repository, 'main.ts'), 'first\nsecond');
  await git(repository, ['add', '--', 'main.ts']);
  await git(repository, ['commit', '-m', 'initial']);
  return repository;
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await executeFile('git', args, { cwd });
}
