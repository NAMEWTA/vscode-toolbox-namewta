import * as vscode from 'vscode';
import type { CopyReferenceMode } from '../../core/domains/copy-reference/public-api';
import type { ToolboxGateway } from '../../core/orchestration/public-api';
import type { VscodeCopyReferenceSourceAdapter } from '../adapters/vscode-copy-reference-source-adapter';

const COMMAND_IDS = {
  relative: 'vscodeToolboxNamewta.copyReference.relative',
  absolute: 'vscodeToolboxNamewta.copyReference.absolute',
} as const;

export class CopyReferenceCommand {
  public readonly id: string;

  public constructor(
    private readonly mode: CopyReferenceMode,
    private readonly gateway: ToolboxGateway,
    private readonly sourceAdapter: VscodeCopyReferenceSourceAdapter,
  ) {
    this.id = COMMAND_IDS[mode];
  }

  public async execute(...args: readonly unknown[]): Promise<void> {
    const input = this.sourceAdapter.resolve(this.mode, args);
    if (input === undefined) {
      void vscode.window.showErrorMessage(
        vscode.l10n.t('No stable resource is available to copy.'),
      );
      return;
    }

    const result = await this.gateway.execute('copyReference.copy', input, {
      source: 'extension-command',
    });
    if (!result.ok) {
      void vscode.window.showErrorMessage(
        vscode.l10n.t('The code reference could not be copied.'),
      );
      return;
    }

    vscode.window.setStatusBarMessage(vscode.l10n.t('Code reference copied.'), 3_000);
  }
}
