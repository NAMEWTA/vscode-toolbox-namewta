import * as vscode from 'vscode';
import {
  GIT_EMPTY_TREE_HASH,
  isFullCommitHash,
  type ExecutableGitResource,
  type GitBlameLine,
  type GitCommitChange,
  type GitCommitChangesInput,
} from '../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../core/kernel/application-error';
import type { ToolboxGateway } from '../../core/orchestration/public-api';
import type { VscodeCommand } from '../adapters/vscode-command-registration-adapter';
import type { VscodeGitResourceAdapter } from '../adapters/vscode-git-resource-adapter';
import type {
  GitBlameAnnotationController,
  GitBlameLineIdentity,
} from '../presentation/git-blame-annotation-controller';
import {
  GIT_BLAME_HOVER_COMMAND_IDS,
  type GitBlameHoverActionArguments,
} from '../presentation/git-blame-hover-provider';
import {
  GitCommitChangesQuickPick,
  type GitCommitChangesLoader,
  type GitCommitChangesSelector,
} from '../presentation/git-commit-changes-quick-pick';
import type { GitHistoricalDocumentProvider } from '../presentation/git-historical-document-provider';
import type { ViewLineHistoryCommand } from './view-line-history-command';

type HoverActionMode = keyof typeof GIT_BLAME_HOVER_COMMAND_IDS;

type HoverActionDependencies = {
  readonly gateway: ToolboxGateway;
  readonly controller: GitBlameAnnotationController;
  readonly resourceAdapter: VscodeGitResourceAdapter;
  readonly historicalProvider: GitHistoricalDocumentProvider;
  readonly viewLineHistory: ViewLineHistoryCommand;
};

export class GitBlameHoverActions implements vscode.Disposable {
  public readonly commands: readonly VscodeCommand[];
  readonly #commitChanges: GitCommitChangesQuickPick;

  public constructor(private readonly dependencies: HoverActionDependencies) {
    this.#commitChanges = new GitCommitChangesQuickPick(
      createCommitChangesLoader(dependencies.gateway),
      selectCommitChange,
      (change) => openCommitChange(dependencies.historicalProvider, change),
    );
    this.commands = (Object.keys(GIT_BLAME_HOVER_COMMAND_IDS) as HoverActionMode[]).map(
      (mode) => {
        const command = new GitBlameHoverActionCommand(
          mode,
          dependencies,
          this.#commitChanges,
        );
        return {
          id: command.id,
          execute: (value: unknown) => command.execute(value),
        };
      },
    );
  }

  public dispose(): void {
    this.#commitChanges.dispose();
  }
}

class GitBlameHoverActionCommand {
  public readonly id: string;

  public constructor(
    private readonly mode: HoverActionMode,
    private readonly dependencies: HoverActionDependencies,
    private readonly commitChanges: GitCommitChangesQuickPick,
  ) {
    this.id = GIT_BLAME_HOVER_COMMAND_IDS[mode];
  }

  public async execute(value: unknown): Promise<void> {
    if (!isHoverActionArguments(value)) {
      throw invalidInputError();
    }
    const identity = this.dependencies.controller.getLineIdentity(
      value.documentKey,
      value.line,
    );
    if (!matchesIdentity(identity, value)) {
      return;
    }
    if (this.mode === 'copyHash') {
      await executeCopyHash(this.dependencies.gateway, identity.blame.commit);
      return;
    }
    const uri = parseOwnedDocumentUri(value.documentKey);
    const resource = await this.dependencies.resourceAdapter.resolve(uri);
    await this.executeCurrent(identity, resource);
  }

  private async executeCurrent(
    identity: GitBlameLineIdentity,
    resource: ExecutableGitResource,
  ): Promise<void> {
    switch (this.mode) {
      case 'commitChanges':
        await this.commitChanges.show(commitChangesInput(identity.blame, resource));
        return;
      case 'previousVersion':
        await openPreviousVersion(
          this.dependencies.historicalProvider,
          identity.blame,
          resource,
        );
        return;
      case 'lineHistory':
        await this.dependencies.viewLineHistory.execute(
          lineHistoryTarget(identity.blame, resource),
        );
        return;
      case 'copyHash':
        return;
    }
  }
}

function createCommitChangesLoader(gateway: ToolboxGateway): GitCommitChangesLoader {
  return async (input, signal) => {
    const result = await gateway.execute('gitBlame.getCommitChanges', input, {
      signal,
      source: 'extension-command',
    });
    if (!result.ok) {
      throw toolResultError(result.error);
    }
    return result.data;
  };
}

const selectCommitChange: GitCommitChangesSelector = async (changes, signal) => {
  const tokenSource = new vscode.CancellationTokenSource();
  const abort = (): void => tokenSource.cancel();
  signal.addEventListener('abort', abort, { once: true });
  try {
    const items = changes.map((change) => ({
      label: `$(diff) ${change.path}`,
      description: change.status,
      change,
    }));
    const selected = await vscode.window.showQuickPick(
      items,
      {
        placeHolder: vscode.l10n.t('Select a changed file'),
        matchOnDescription: true,
      },
      tokenSource.token,
    );
    return selected?.change;
  } finally {
    signal.removeEventListener('abort', abort);
    tokenSource.dispose();
  }
};

async function openCommitChange(
  provider: GitHistoricalDocumentProvider,
  change: GitCommitChange,
): Promise<void> {
  await provider.openDiff(
    change.before,
    change.after,
    diffTitle(change.after.ref, change.path),
  );
}

async function openPreviousVersion(
  provider: GitHistoricalDocumentProvider,
  blame: GitBlameLine,
  resource: ExecutableGitResource,
): Promise<void> {
  const path = blame.originalPath ?? resource.relativePath;
  const parent = blame.parentCommit ?? GIT_EMPTY_TREE_HASH;
  await provider.openDiff(
    { resource, ref: parent, path },
    { resource, ref: blame.commit, path },
    diffTitle(blame.commit, path),
  );
}

async function executeCopyHash(gateway: ToolboxGateway, hash: string): Promise<void> {
  const result = await gateway.execute(
    'gitBlame.copyCommitHash',
    { hash },
    { source: 'extension-command' },
  );
  if (!result.ok) {
    throw toolResultError(result.error);
  }
}

function commitChangesInput(
  blame: GitBlameLine,
  resource: ExecutableGitResource,
): GitCommitChangesInput {
  return {
    resource,
    commit: blame.commit,
    ...(blame.parentCommit === undefined ? {} : { parent: blame.parentCommit }),
  };
}

function lineHistoryTarget(
  blame: GitBlameLine,
  resource: ExecutableGitResource,
): {
  readonly resource: ExecutableGitResource;
  readonly ref: string;
  readonly path: string;
  readonly line: number;
} {
  return {
    resource,
    ref: blame.commit,
    path: blame.originalPath ?? resource.relativePath,
    line: blame.originalLine ?? blame.line,
  };
}

function isHoverActionArguments(value: unknown): value is GitBlameHoverActionArguments {
  return (
    isRecordWithKeys(value, ['documentKey', 'line', 'commit', 'generation']) &&
    typeof value.documentKey === 'string' &&
    value.documentKey.length > 0 &&
    value.documentKey.length <= 8_192 &&
    Number.isInteger(value.line) &&
    Number(value.line) > 0 &&
    isFullCommitHash(value.commit) &&
    Number.isInteger(value.generation) &&
    Number(value.generation) > 0
  );
}

function matchesIdentity(
  identity: GitBlameLineIdentity | undefined,
  args: GitBlameHoverActionArguments,
): identity is GitBlameLineIdentity {
  return (
    identity !== undefined &&
    identity.generation === args.generation &&
    identity.blame.commit === args.commit
  );
}

function parseOwnedDocumentUri(documentKey: string): vscode.Uri {
  try {
    const uri = vscode.Uri.parse(documentKey, true);
    if (uri.toString(true) !== documentKey || uri.scheme !== 'file') {
      throw invalidInputError();
    }
    return uri;
  } catch (error: unknown) {
    if (error instanceof ApplicationError) {
      throw error;
    }
    throw invalidInputError(error);
  }
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

function diffTitle(commit: string, path: string): string {
  return `${commit.slice(0, 8)} - ${path.split('/').at(-1) ?? path}`;
}

function toolResultError(error: {
  readonly code: ApplicationError['code'];
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}): ApplicationError {
  return new ApplicationError(error.message, {
    code: error.code,
    retryable: error.retryable,
    ...(error.details === undefined ? {} : { details: error.details }),
  });
}

function invalidInputError(cause?: unknown): ApplicationError {
  return new ApplicationError('Git Blame Hover action input is invalid.', {
    code: 'invalid-input',
    ...(cause === undefined ? {} : { cause }),
  });
}
