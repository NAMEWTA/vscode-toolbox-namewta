import * as vscode from 'vscode';
import type { ToolboxGateway, ToolLogger } from '../../core/orchestration/public-api';
import { createVscodeWebviewBootstrap } from '../adapters/vscode-webview-bootstrap-adapter';
import { VscodeWebviewMessageAdapter } from '../adapters/vscode-webview-message-adapter';
import { createToolboxPanelHtml } from './toolbox-panel-html';

const TOOLBOX_VIEW_TYPE = 'vscodeToolboxNamewta.toolbox';

export class ToolboxPanelController implements vscode.Disposable {
  #panel: vscode.WebviewPanel | undefined;
  #messageAdapter: VscodeWebviewMessageAdapter | undefined;
  #panelDisposeListener: vscode.Disposable | undefined;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly gateway: ToolboxGateway,
    private readonly logger: ToolLogger,
  ) {}

  public open(): void {
    if (this.#panel !== undefined) {
      this.#panel.reveal(vscode.ViewColumn.Active);
      return;
    }

    const webviewRoot = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview');
    const panel = vscode.window.createWebviewPanel(
      TOOLBOX_VIEW_TYPE,
      vscode.l10n.t('vscode-toolbox-namewta'),
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [webviewRoot],
      },
    );

    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(webviewRoot, 'main.js'),
    );
    const styleUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(webviewRoot, 'main.css'),
    );
    const requestTimeoutMs = vscode.workspace
      .getConfiguration('vscodeToolboxNamewta')
      .get<number>('webview.requestTimeoutMs', 10_000);
    panel.webview.html = createToolboxPanelHtml(panel.webview, {
      scriptUri,
      styleUri,
      bootstrap: createVscodeWebviewBootstrap(requestTimeoutMs),
    });

    this.#messageAdapter = new VscodeWebviewMessageAdapter(
      panel.webview,
      this.gateway,
      this.logger,
    );
    this.#panel = panel;
    this.#panelDisposeListener = panel.onDidDispose(() => this.handlePanelDisposed());
  }

  public dispose(): void {
    this.#panelDisposeListener?.dispose();
    this.#panelDisposeListener = undefined;
    this.#messageAdapter?.dispose();
    this.#messageAdapter = undefined;
    this.#panel?.dispose();
    this.#panel = undefined;
  }

  private handlePanelDisposed(): void {
    this.#panelDisposeListener?.dispose();
    this.#panelDisposeListener = undefined;
    this.#messageAdapter?.dispose();
    this.#messageAdapter = undefined;
    this.#panel = undefined;
  }
}
