import * as vscode from 'vscode';
import type {
  GitReviewItem,
  GitReviewItemContent,
} from '../../core/domains/git-review/public-api';
import { displayGitReviewText } from './git-review-display-text';

type SummaryReason = Extract<
  GitReviewItemContent,
  { readonly kind: 'summary' }
>['reason'];

export function createGitReviewSummaryText(
  item: GitReviewItem,
  reason: SummaryReason,
): string {
  return [
    vscode.l10n.t('Git Review item'),
    vscode.l10n.t('Path: {0}', displayGitReviewText(item.path)),
    vscode.l10n.t('Change: {0}', changeLabel(item.change)),
    summaryReason(reason),
  ].join('\n');
}

function changeLabel(change: GitReviewItem['change']): string {
  switch (change) {
    case 'added':
      return vscode.l10n.t('Added');
    case 'modified':
      return vscode.l10n.t('Modified');
    case 'deleted':
      return vscode.l10n.t('Deleted');
    case 'renamed':
      return vscode.l10n.t('Renamed');
    case 'untracked':
      return vscode.l10n.t('Untracked');
    case 'conflicted':
      return vscode.l10n.t('Conflicted');
  }
}

function summaryReason(reason: SummaryReason): string {
  switch (reason) {
    case 'binary':
      return vscode.l10n.t('This item is binary and cannot be shown as a text diff.');
    case 'submodule':
      return vscode.l10n.t(
        'This item is a submodule and cannot be shown as a text diff.',
      );
    case 'conflict':
      return vscode.l10n.t(
        'This item contains merge conflicts. Open the file to resolve them.',
      );
    case 'too-large':
      return vscode.l10n.t('This item is too large to display as text.');
    case 'unavailable':
      return vscode.l10n.t(
        'This item is unavailable as a text diff. Retry or skip it.',
      );
  }
}
