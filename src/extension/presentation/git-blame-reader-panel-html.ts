import type * as vscode from 'vscode';
import type { GitBlameReaderModel } from '../../core/domains/git-blame/public-api';
import { createWebviewNonce } from './webview-nonce';

export type GitBlameReaderPanelAssets = {
  readonly scriptUri: vscode.Uri;
  readonly styleUri: vscode.Uri;
  readonly model: GitBlameReaderModel;
  readonly language: string;
  readonly title: string;
  readonly strings: GitBlameReaderWebviewStrings;
};

export type GitBlameReaderWebviewStrings = {
  readonly title: string;
  readonly search: string;
  readonly logicalLines: string;
  readonly refresh: string;
  readonly copyActions: string;
  readonly copyCode: string;
  readonly copyLineWithBlame: string;
  readonly copyCommitSha: string;
  readonly copyCommitInfo: string;
  readonly copyBlockCode: string;
  readonly copyBlockWithBlame: string;
  readonly copyAllCode: string;
  readonly copyAllWithBlame: string;
  readonly lines: string;
  readonly matches: string;
  readonly noMatches: string;
  readonly workingTree: string;
  readonly uncommitted: string;
};

export function createGitBlameReaderPanelHtml(
  webview: vscode.Webview,
  assets: GitBlameReaderPanelAssets,
): string {
  const nonce = createWebviewNonce();
  const serialize = (value: unknown): string =>
    JSON.stringify(value)
      .replaceAll('<', '\\u003c')
      .replaceAll('>', '\\u003e')
      .replaceAll('&', '\\u0026');
  const escape = (value: string): string =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  return `<!doctype html><html lang="${escape(assets.language)}" style="height:100%"><head><meta charset="UTF-8" /><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${escape(webview.cspSource)}; script-src 'nonce-${nonce}';" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><link rel="stylesheet" href="${escape(assets.styleUri.toString())}" /><title>${escape(assets.title)}</title></head><body><div id="root"></div><script id="git-blame-reader-model" type="application/json" nonce="${nonce}">${serialize(assets.model)}</script><script id="git-blame-reader-strings" type="application/json" nonce="${nonce}">${serialize(assets.strings)}</script><script nonce="${nonce}" src="${escape(assets.scriptUri.toString())}"></script></body></html>`;
}
