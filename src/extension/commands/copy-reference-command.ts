import * as vscode from 'vscode';
import type { CopyReferenceMode } from '../../core/domains/copy-reference/public-api';
import type { ToolboxGateway } from '../../core/orchestration/public-api';
import type {
  CopyReferenceSourceRoute,
  VscodeCopyReferenceSourceAdapter,
} from '../adapters/vscode-copy-reference-source-adapter';

const COMMAND_IDS = {
  automatic: {
    relative: 'vscodeToolboxNamewta.copyReference.relative',
    absolute: 'vscodeToolboxNamewta.copyReference.absolute',
  },
  'editor-context': {
    relative: 'vscodeToolboxNamewta.copyReference.editor.relative',
    absolute: 'vscodeToolboxNamewta.copyReference.editor.absolute',
  },
  'explorer-context': {
    relative: 'vscodeToolboxNamewta.copyReference.explorer.relative',
    absolute: 'vscodeToolboxNamewta.copyReference.explorer.absolute',
  },
} as const;

export class CopyReferenceCommand {
  public readonly id: string;

  public constructor(
    private readonly mode: CopyReferenceMode,
    private readonly gateway: ToolboxGateway,
    private readonly sourceAdapter: VscodeCopyReferenceSourceAdapter,
    private readonly route: CopyReferenceSourceRoute = 'automatic',
  ) {
    this.id = COMMAND_IDS[route][mode];
  }

  public async execute(...args: readonly unknown[]): Promise<void> {
    const input = await this.sourceAdapter.resolve(this.mode, args, this.route);
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
