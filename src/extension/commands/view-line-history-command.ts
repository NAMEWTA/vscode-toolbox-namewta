import * as vscode from 'vscode';
import {
  isExecutableGitResource,
  isGitReference,
  isRepositoryRelativePath,
} from '../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../core/kernel/application-error';
import type { VscodeGitResourceAdapter } from '../adapters/vscode-git-resource-adapter';
import type {
  GitLineHistoryQuickPick,
  GitLineHistoryStartInput,
} from '../presentation/git-line-history-quick-pick';

export class ViewLineHistoryCommand {
  public readonly id = 'vscodeToolboxNamewta.gitBlame.viewLineHistory';

  public constructor(
    private readonly quickPick: GitLineHistoryQuickPick,
    private readonly resourceAdapter: VscodeGitResourceAdapter,
  ) {}

  public async execute(...args: readonly unknown[]): Promise<void> {
    const target = await this.resolveTarget(args);
    if (target !== undefined) {
      await this.quickPick.show(target);
    }
  }

  private async resolveTarget(
    args: readonly unknown[],
  ): Promise<GitLineHistoryStartInput | undefined> {
    if (args.length === 1 && isLineHistoryTarget(args[0])) {
      return args[0];
    }
    if (args.length > 0 && !isEditorContextArgs(args)) {
      throw invalidInputError();
    }
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
      void vscode.window.showInformationMessage(
        vscode.l10n.t('Open a file before viewing line history.'),
      );
      return undefined;
    }
    const uri = args[0] instanceof vscode.Uri ? args[0] : editor.document.uri;
    const line = readContextLine(args[1], editor, uri);
    const resource = await this.resourceAdapter.resolve(uri);
    return {
      resource,
      ref: 'HEAD',
      path: resource.relativePath,
      line,
    };
  }
}

function isLineHistoryTarget(value: unknown): value is GitLineHistoryStartInput {
  if (!isRecordWithKeys(value, ['resource', 'ref', 'path', 'line'])) {
    return false;
  }
  return (
    isExecutableGitResource(value.resource) &&
    isGitReference(value.ref) &&
    isRepositoryRelativePath(value.path) &&
    Number.isInteger(value.line) &&
    Number(value.line) > 0
  );
}

function isEditorContextArgs(args: readonly unknown[]): boolean {
  return (
    args.length <= 2 &&
    (args[0] === undefined || args[0] instanceof vscode.Uri) &&
    (args[1] === undefined || isPositiveInteger(args[1]))
  );
}

function readContextLine(
  value: unknown,
  editor: vscode.TextEditor,
  uri: vscode.Uri,
): number {
  if (isPositiveInteger(value)) {
    return value;
  }
  if (editor.document.uri.toString(true) !== uri.toString(true)) {
    throw invalidInputError();
  }
  return editor.selection.active.line + 1;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isRecordWithKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => key in value)
  );
}

function invalidInputError(): ApplicationError {
  return new ApplicationError('View Line History input is invalid.', {
    code: 'invalid-input',
  });
}
