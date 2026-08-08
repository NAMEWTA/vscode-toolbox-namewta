import type { ToolboxPanelController } from '../presentation/toolbox-panel-controller';

const OPEN_TOOLBOX_COMMAND_ID = 'vscodeToolboxNamewta.openToolbox' as const;

export class OpenToolboxCommand {
  public readonly id = OPEN_TOOLBOX_COMMAND_ID;

  public constructor(private readonly panelController: ToolboxPanelController) {}

  public execute(): void {
    this.panelController.open();
  }
}
