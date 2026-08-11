import * as vscode from 'vscode';
import type {
  GitBlameAuthorNameStyle,
  GitBlameDateFormatStyle,
} from '../../core/domains/git-blame/git-blame-annotation-format';
import type { GitBlameConfiguration } from '../presentation/git-blame-annotation-controller';

const DATE_FORMAT_STYLES = [
  'Y/M/D',
  'YYYY-MM-DD',
  'YYYY-MM-DD HH:mm',
  'DD.MM.YYYY',
  'relative',
] as const;
const AUTHOR_NAME_STYLES = ['full', 'first', 'last'] as const;

export class VscodeGitBlameConfigurationAdapter {
  public read(): GitBlameConfiguration {
    const config = vscode.workspace.getConfiguration('vscodeToolboxNamewta.gitBlame');
    return {
      dateFormatStyle: readEnum(
        config.get<unknown>('dateFormatStyle'),
        DATE_FORMAT_STYLES,
        'YYYY-MM-DD HH:mm',
      ),
      authorNameStyle: readEnum(
        config.get<unknown>('authorNameStyle'),
        AUTHOR_NAME_STYLES,
        'full',
      ),
      mergeCommitLines: config.get<boolean>('mergeCommitLines', false),
      highlightCurrentCommit: config.get<boolean>('highlightCurrentCommit', false),
      ignoreWhitespace: config.get<boolean>('ignoreWhitespace', false),
      maxLines: readMaxLines(config.get<unknown>('maxLines')),
    };
  }
}

function readEnum<TValue extends string>(
  value: unknown,
  allowed: readonly TValue[],
  fallback: TValue,
): TValue {
  return typeof value === 'string' && allowed.some((candidate) => candidate === value)
    ? (value as TValue)
    : fallback;
}

function readMaxLines(value: unknown): number {
  return Number.isInteger(value) && Number(value) >= 100 && Number(value) <= 200_000
    ? Number(value)
    : 20_000;
}

export type { GitBlameAuthorNameStyle, GitBlameDateFormatStyle };
