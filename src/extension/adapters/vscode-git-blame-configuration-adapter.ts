import * as vscode from 'vscode';
import type {
  GitBlameAuthorNameStyle,
  GitBlameDateFormatStyle,
} from '../../core/domains/git-blame/public-api';
import type { GitBlameConfiguration } from '../presentation/git-blame-annotation-controller';

export class VscodeGitBlameConfigurationAdapter {
  public read(): GitBlameConfiguration {
    const config = vscode.workspace.getConfiguration('vscodeToolboxNamewta.gitBlame');
    return {
      highlightCurrentCommit: readBoolean(
        config.get<unknown>('highlightCurrentCommit'),
        false,
      ),
      ignoreWhitespace: readBoolean(config.get<unknown>('ignoreWhitespace'), false),
      maxLines: readMaxLines(config.get<unknown>('maxLines')),
      dateFormatStyle: readDateFormat(config.get<unknown>('dateFormatStyle')),
      authorNameStyle: readAuthorNameStyle(config.get<unknown>('authorNameStyle')),
      showCommitNumber: readBoolean(config.get<unknown>('showCommitNumber'), false),
      mergeCommitLines: readBoolean(config.get<unknown>('mergeCommitLines'), false),
    };
  }
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readDateFormat(value: unknown): GitBlameDateFormatStyle {
  return ['Y/M/D', 'YYYY-MM-DD', 'YYYY-MM-DD HH:mm', 'DD.MM.YYYY', 'relative'].includes(
    String(value),
  )
    ? (value as GitBlameDateFormatStyle)
    : 'Y/M/D';
}

function readAuthorNameStyle(value: unknown): GitBlameAuthorNameStyle {
  return ['full', 'first', 'last'].includes(String(value))
    ? (value as GitBlameAuthorNameStyle)
    : 'full';
}

function readMaxLines(value: unknown): number {
  return Number.isInteger(value) && Number(value) >= 100 && Number(value) <= 200_000
    ? Number(value)
    : 20_000;
}
