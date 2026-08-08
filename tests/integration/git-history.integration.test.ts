import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type {
  VscodeToolboxNamewtaExtensionApi,
  ToolCommandId,
  ToolCommandInput,
} from '../../src/core/contracts';
import type { ToolboxGateway } from '../../src/core/orchestration/public-api';
import { GitHistoricalDocumentProvider } from '../../src/extension/presentation/git-historical-document-provider';

const executeFile = promisify(execFile);

suite('Git history integration', () => {
  test('reads commit changes and historical content without exposing the repository path', async () => {
    const fixture = await createRepository();
    const cancellation = new vscode.CancellationTokenSource();
    let provider: GitHistoricalDocumentProvider | undefined;
    try {
      const api = await extensionApi();
      const resource = { repositoryRoot: fixture.repository, relativePath: 'main.ts' };
      const changes = await api.execute('gitBlame.getCommitChanges', {
        resource,
        commit: fixture.commit,
      });
      assert.equal(changes.ok, true);
      if (!changes.ok) {
        return;
      }
      assert.equal(changes.data.changes[0]?.status, 'added');
      const after = changes.data.changes[0]?.after;
      assert.ok(after);

      provider = new GitHistoricalDocumentProvider(gatewayFromApi(api));
      const uri = provider.createUri(after);
      assert.equal(uri.toString(true).includes(fixture.repository), false);
      assert.equal(
        await provider.provideTextDocumentContent(uri, cancellation.token),
        'first\nsecond\n',
      );
    } finally {
      cancellation.dispose();
      provider?.dispose();
      await rm(fixture.repository, { recursive: true, force: true });
    }
  });
});

function gatewayFromApi(api: VscodeToolboxNamewtaExtensionApi): ToolboxGateway {
  return {
    execute: <TCommand extends ToolCommandId>(
      command: TCommand,
      input: ToolCommandInput<TCommand>,
    ) => api.execute(command, input),
    getCapabilities: () => api.getCapabilities(),
  };
}

async function extensionApi(): Promise<VscodeToolboxNamewtaExtensionApi> {
  const extension = vscode.extensions.getExtension<VscodeToolboxNamewtaExtensionApi>(
    'NAMEWTA.vscode-toolbox-namewta',
  );
  assert.ok(extension);
  return extension.activate();
}

type HistoryFixture = { readonly repository: string; readonly commit: string };

async function createRepository(): Promise<HistoryFixture> {
  const repository = await mkdtemp(
    path.join(tmpdir(), 'vscode-toolbox-namewta-host-history-'),
  );
  await git(repository, ['init']);
  await git(repository, ['config', 'user.name', 'vscode-toolbox-namewta Test']);
  await git(repository, ['config', 'user.email', 'test@example.invalid']);
  await writeFile(path.join(repository, 'main.ts'), 'first\nsecond\n');
  await git(repository, ['add', '--', 'main.ts']);
  await git(repository, ['commit', '-m', 'initial']);
  const commit = (
    await executeFile('git', ['rev-parse', 'HEAD'], { cwd: repository })
  ).stdout.trim();
  return { repository, commit };
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await executeFile('git', args, { cwd });
}
