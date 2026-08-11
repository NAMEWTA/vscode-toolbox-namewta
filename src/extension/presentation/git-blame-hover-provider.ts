import * as vscode from 'vscode';
import {
  createGitRemoteCommitUrl,
  formatGitBlameLocalDateTime,
} from '../../core/domains/git-blame/public-api';
import type {
  GitBlameAnnotationController,
  GitBlameLineIdentity,
} from './git-blame-annotation-controller';

export const GIT_BLAME_HOVER_COMMAND_IDS = {
  copyHash: 'vscodeToolboxNamewta.gitBlame.internal.copyCommitHash',
  commitChanges: 'vscodeToolboxNamewta.gitBlame.internal.viewCommitChanges',
  previousVersion: 'vscodeToolboxNamewta.gitBlame.internal.openPreviousVersion',
  lineHistory: 'vscodeToolboxNamewta.gitBlame.internal.viewLineHistory',
} as const;

export type GitBlameHoverActionArguments = {
  readonly documentKey: string;
  readonly line: number;
  readonly commit: string;
  readonly generation: number;
};

export class GitBlameHoverProvider implements vscode.HoverProvider {
  public constructor(
    private readonly controller: GitBlameAnnotationController,
    private readonly nowEpochSeconds: () => number = () =>
      Math.floor(Date.now() / 1_000),
  ) {}

  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): vscode.Hover | undefined {
    if (token.isCancellationRequested) {
      return undefined;
    }
    const identity = this.controller.getLineIdentity(
      document.uri.toString(true),
      position.line + 1,
    );
    return identity === undefined
      ? undefined
      : new vscode.Hover(buildGitBlameHoverMarkdown(identity, this.nowEpochSeconds()));
  }
}

export function buildGitBlameHoverMarkdown(
  identity: GitBlameLineIdentity,
  nowEpochSeconds: number,
): vscode.MarkdownString {
  const markdown = new vscode.MarkdownString(undefined, true);
  markdown.supportHtml = false;
  markdown.isTrusted = {
    enabledCommands: Object.values(GIT_BLAME_HOVER_COMMAND_IDS),
  };
  const { blame } = identity;
  const absoluteTime = formatGitBlameLocalDateTime(blame.authoredAt);
  markdown.appendMarkdown(
    `**${escapeMarkdown(vscode.l10n.t('Author'))}:** ${escapeMarkdown(blame.author)} <${escapeMarkdown(blame.email)}>  \n`,
  );
  markdown.appendMarkdown(
    `**${escapeMarkdown(vscode.l10n.t('Time'))}:** ${escapeMarkdown(formatRelativeTime(blame.authoredAt, nowEpochSeconds))} (${escapeMarkdown(absoluteTime)})  \n`,
  );
  markdown.appendMarkdown(
    `**${escapeMarkdown(vscode.l10n.t('Commit'))}:** \`${blame.commit}\`  \n`,
  );
  markdown.appendMarkdown(
    `**${escapeMarkdown(vscode.l10n.t('Summary'))}:** ${escapeMarkdown(blame.summary)}\n\n`,
  );
  markdown.appendMarkdown(createActions(identity).join(' &nbsp;|&nbsp; '));
  return markdown;
}

function createActions(identity: GitBlameLineIdentity): readonly string[] {
  const args: GitBlameHoverActionArguments = {
    documentKey: identity.documentKey,
    line: identity.blame.line,
    commit: identity.blame.commit,
    generation: identity.generation,
  };
  const actions = [
    commandLink(
      vscode.l10n.t('Copy Commit Hash'),
      GIT_BLAME_HOVER_COMMAND_IDS.copyHash,
      args,
    ),
    commandLink(
      vscode.l10n.t('View Commit Changes'),
      GIT_BLAME_HOVER_COMMAND_IDS.commitChanges,
      args,
    ),
    commandLink(
      vscode.l10n.t('Open Previous Version'),
      GIT_BLAME_HOVER_COMMAND_IDS.previousVersion,
      args,
    ),
    commandLink(
      vscode.l10n.t('View Line History'),
      GIT_BLAME_HOVER_COMMAND_IDS.lineHistory,
      args,
    ),
  ];
  const remote =
    identity.remoteUrl === undefined
      ? undefined
      : createGitRemoteCommitUrl(identity.remoteUrl, identity.blame.commit);
  return remote === undefined
    ? actions
    : [
        ...actions,
        `[${escapeMarkdown(vscode.l10n.t('Open Remote Commit'))}](${remote})`,
      ];
}

function commandLink(
  label: string,
  command: string,
  args: GitBlameHoverActionArguments,
): string {
  const query = encodeURIComponent(JSON.stringify([args]));
  return `[${escapeMarkdown(label)}](command:${command}?${query})`;
}

function formatRelativeTime(authoredAt: number, now: number): string {
  const elapsedSeconds = Math.max(0, now - authoredAt);
  if (elapsedSeconds < 60) {
    return vscode.l10n.t('just now');
  }
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) {
    return vscode.l10n.t('{0} minutes ago', minutes);
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1
      ? vscode.l10n.t('1 hour ago')
      : vscode.l10n.t('{0} hours ago', hours);
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? vscode.l10n.t('1 day ago') : vscode.l10n.t('{0} days ago', days);
}

function escapeMarkdown(value: string): string {
  return value
    .replace(/\\/gu, '\\\\')
    .replace(/([`*_{}[\]()<>#+.!|-])/gu, '\\$1')
    .replace(/[\r\n]+/gu, ' ');
}
