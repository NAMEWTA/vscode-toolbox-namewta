import * as vscode from 'vscode';
import type { ToolboxGateway } from '../../core/orchestration/public-api';

const SHOW_RUNTIME_INFO_COMMAND_ID = 'vscodeToolboxNamewta.showRuntimeInfo' as const;

export class ShowRuntimeInfoCommand {
  public readonly id = SHOW_RUNTIME_INFO_COMMAND_ID;

  public constructor(private readonly gateway: ToolboxGateway) {}

  public async execute(): Promise<void> {
    const result = await this.gateway.execute(
      'system.getRuntimeInfo',
      {},
      {
        source: 'extension-command',
      },
    );

    if (!result.ok) {
      await vscode.window.showErrorMessage(result.error.message);
      return;
    }

    const info = result.data;
    const remoteLabel = info.isRemoteEnvironment
      ? vscode.l10n.t('remote')
      : vscode.l10n.t('local');
    const trustLabel = info.isWorkspaceTrusted
      ? vscode.l10n.t('trusted')
      : vscode.l10n.t('restricted');

    await vscode.window.showInformationMessage(
      vscode.l10n.t(
        'vscode-toolbox-namewta {0} · VS Code {1} · Node {2} · {3} · {4}',
        info.extensionVersion,
        info.vscodeVersion,
        info.nodeVersion,
        remoteLabel,
        trustLabel,
      ),
    );
  }
}
