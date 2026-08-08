import * as vscode from 'vscode';
import type { ToolLogger } from '../../core/orchestration/public-api';

export type VscodeCommand = {
  readonly id: string;
  readonly execute: (...args: readonly unknown[]) => Promise<void> | void;
};

export class VscodeCommandRegistrationAdapter {
  public constructor(
    private readonly logger: ToolLogger,
    private readonly showLog: () => void,
  ) {}

  public register(command: VscodeCommand): vscode.Disposable {
    return vscode.commands.registerCommand(command.id, async (...args: unknown[]) => {
      try {
        await command.execute(...args);
      } catch (error: unknown) {
        this.logger.error('VS Code command failed.', error, {
          command: command.id,
        });
        const openLogLabel = vscode.l10n.t('Open Log');
        const action = await vscode.window.showErrorMessage(
          vscode.l10n.t(
            'vscode-toolbox-namewta command failed. See the output log for details.',
          ),
          openLogLabel,
        );
        if (action === openLogLabel) {
          this.showLog();
        }
      }
    });
  }
}
