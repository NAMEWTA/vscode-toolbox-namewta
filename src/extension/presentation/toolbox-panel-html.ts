import type * as vscode from 'vscode';
import type { WebviewBootstrap } from '../../core/contracts';
import { createWebviewNonce } from './webview-nonce';

export type ToolboxPanelAssets = {
  readonly scriptUri: vscode.Uri;
  readonly styleUri: vscode.Uri;
  readonly bootstrap: WebviewBootstrap;
};

export function createToolboxPanelHtml(
  webview: vscode.Webview,
  assets: ToolboxPanelAssets,
): string {
  const nonce = createWebviewNonce();
  const scriptUri = escapeHtmlAttribute(assets.scriptUri.toString());
  const styleUri = escapeHtmlAttribute(assets.styleUri.toString());
  const cspSource = escapeHtmlAttribute(webview.cspSource);
  const language = escapeHtmlAttribute(assets.bootstrap.language);
  const bootstrapJson = serializeBootstrap(assets.bootstrap);

  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${cspSource}; style-src ${cspSource}; script-src 'nonce-${nonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>${escapeHtmlText(assets.bootstrap.strings.title)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script id="toolbox-bootstrap" type="application/json" nonce="${nonce}">${bootstrapJson}</script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}

function serializeBootstrap(bootstrap: WebviewBootstrap): string {
  return JSON.stringify(bootstrap)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function escapeHtmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
