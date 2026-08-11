import type * as vscode from 'vscode';
import type { GitReviewWebviewBootstrap } from '../../core/contracts';
import { createWebviewNonce } from './webview-nonce';

export type GitReviewPanelAssets = {
  readonly scriptUri: vscode.Uri;
  readonly styleUri: vscode.Uri;
  readonly bootstrap: GitReviewWebviewBootstrap;
};

export function createGitReviewPanelHtml(
  webview: vscode.Webview,
  assets: GitReviewPanelAssets,
): string {
  const nonce = createWebviewNonce();
  const scriptUri = escapeHtml(assets.scriptUri.toString());
  const styleUri = escapeHtml(assets.styleUri.toString());
  const cspSource = escapeHtml(webview.cspSource);
  const bootstrap = JSON.stringify(assets.bootstrap)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');

  return `<!doctype html>
<html lang="${escapeHtml(assets.bootstrap.language)}">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource}; script-src 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>${escapeHtml(assets.bootstrap.strings.title)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script id="git-review-bootstrap" type="application/json" nonce="${nonce}">${bootstrap}</script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
