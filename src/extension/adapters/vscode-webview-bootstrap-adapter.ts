import * as vscode from 'vscode';
import type { WebviewBootstrap, WebviewStrings } from '../../core/contracts';

export function createVscodeWebviewBootstrap(
  requestTimeoutMs: number,
): WebviewBootstrap {
  return {
    version: 1,
    language: vscode.env.language,
    requestTimeoutMs,
    strings: createWebviewStrings(),
  };
}

function createWebviewStrings(): WebviewStrings {
  return {
    eyebrow: vscode.l10n.t('VS Code extension foundation'),
    title: vscode.l10n.t('vscode-toolbox-namewta'),
    description: vscode.l10n.t(
      'A modular TypeScript and React foundation for focused developer tools.',
    ),
    runtimeStatusTitle: vscode.l10n.t('Runtime status'),
    refresh: vscode.l10n.t('Refresh'),
    refreshing: vscode.l10n.t('Refreshing…'),
    loadingRuntimeInfo: vscode.l10n.t('Loading runtime information…'),
    extensionLabel: vscode.l10n.t('Extension'),
    apiLabel: vscode.l10n.t('API'),
    vscodeLabel: vscode.l10n.t('VS Code'),
    nodeLabel: vscode.l10n.t('Node'),
    languageLabel: vscode.l10n.t('Language'),
    workspaceLabel: vscode.l10n.t('Workspace'),
    environmentLabel: vscode.l10n.t('Environment'),
    runtimeLabel: vscode.l10n.t('Runtime'),
    toolsLabel: vscode.l10n.t('Tools'),
    trusted: vscode.l10n.t('Trusted'),
    restricted: vscode.l10n.t('Restricted'),
    remote: vscode.l10n.t('Remote'),
    local: vscode.l10n.t('Local'),
    unknownError: vscode.l10n.t('Unknown Webview error.'),
  };
}
