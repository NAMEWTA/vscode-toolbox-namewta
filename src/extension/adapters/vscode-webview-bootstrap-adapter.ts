import * as vscode from 'vscode';
import type {
  GitReviewSessionSnapshot,
  GitReviewWebviewBootstrap,
  GitReviewWebviewStrings,
  WebviewBootstrap,
  WebviewStrings,
} from '../../core/contracts';

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

export function createVscodeGitReviewWebviewBootstrap(
  requestTimeoutMs: number,
  snapshot: GitReviewSessionSnapshot,
): GitReviewWebviewBootstrap {
  return {
    version: 1,
    view: 'git-review',
    language: vscode.env.language,
    requestTimeoutMs,
    strings: createGitReviewWebviewStrings(),
    snapshot,
  };
}

function createGitReviewWebviewStrings(): GitReviewWebviewStrings {
  return {
    title: vscode.l10n.t('toolbox-Git Review'),
    conflict: vscode.l10n.t('Merge Changes'),
    staged: vscode.l10n.t('Staged Changes'),
    unstaged: vscode.l10n.t('Changes'),
    stage: vscode.l10n.t('Stage Changes'),
    unstage: vscode.l10n.t('Unstage Changes'),
    discard: vscode.l10n.t('Discard Changes'),
    openFile: vscode.l10n.t('Open File'),
    openDiff: vscode.l10n.t('Open Diff'),
    copyReference: vscode.l10n.t('Copy Reference'),
    markReviewed: vscode.l10n.t('Mark Reviewed'),
    skip: vscode.l10n.t('Skip'),
    mergeChanges: vscode.l10n.t('Open Merge Changes'),
    loading: vscode.l10n.t('Loading diff…'),
    retry: vscode.l10n.t('Retry'),
    binary: vscode.l10n.t('Binary file'),
    submodule: vscode.l10n.t('Submodule change'),
    tooLarge: vscode.l10n.t('Diff is too large for the aggregate view'),
    unavailable: vscode.l10n.t('Diff is unavailable'),
    noChanges: vscode.l10n.t('No changes to review'),
    refreshRequired: vscode.l10n.t('Refresh required'),
    additions: vscode.l10n.t('additions'),
    deletions: vscode.l10n.t('deletions'),
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
