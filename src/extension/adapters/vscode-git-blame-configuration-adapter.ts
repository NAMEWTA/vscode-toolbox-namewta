import * as vscode from 'vscode';
import type { GitBlameConfiguration } from '../presentation/git-blame-annotation-controller';

export class VscodeGitBlameConfigurationAdapter {
  public read(): GitBlameConfiguration {
    const config = vscode.workspace.getConfiguration('vscodeToolboxNamewta.gitBlame');
    return {
      highlightCurrentCommit: config.get<boolean>('highlightCurrentCommit', false),
      ignoreWhitespace: config.get<boolean>('ignoreWhitespace', false),
      maxLines: readMaxLines(config.get<unknown>('maxLines')),
    };
  }
}

function readMaxLines(value: unknown): number {
  return Number.isInteger(value) && Number(value) >= 100 && Number(value) <= 200_000
    ? Number(value)
    : 20_000;
}
