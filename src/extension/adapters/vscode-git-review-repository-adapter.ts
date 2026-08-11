import path from 'node:path';
import * as vscode from 'vscode';
import type { GitCommandPort } from '../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../core/kernel/application-error';
import type { GitReviewRepositoryResolver } from '../presentation/git-review-session-controller-contract';

const GIT_REPOSITORY_ROOT_ARGS = [
  '--no-optional-locks',
  'rev-parse',
  '--show-toplevel',
] as const;

export type GitReviewRepositoryCandidate = {
  readonly repositoryRoot: string;
  readonly label: string;
  readonly description: string;
};

export type GitReviewRepositoryContext = {
  readonly isWorkspaceTrusted: boolean;
  readonly activeFilePath: string | undefined;
  readonly workspaceFolderPaths: readonly string[];
};

export type GitReviewRepositoryHost = {
  getContext(): GitReviewRepositoryContext;
  pickRepository(
    candidates: readonly GitReviewRepositoryCandidate[],
  ): Promise<string | undefined>;
};

type GitReviewCommandContext =
  | { readonly kind: 'discovery' }
  | { readonly kind: 'source-control'; readonly rootPath?: string };

export class VscodeGitReviewRepositoryAdapter implements GitReviewRepositoryResolver {
  public constructor(
    private readonly git: GitCommandPort,
    private readonly host: GitReviewRepositoryHost = new VscodeGitReviewRepositoryHost(),
  ) {}

  public async resolve(
    args: readonly unknown[],
    signal: AbortSignal,
  ): Promise<string | undefined> {
    const commandContext = parseCommandContext(args);
    const context = this.host.getContext();
    if (!context.isWorkspaceTrusted) {
      throw new ApplicationError('Git requires a trusted workspace.', {
        code: 'permission-denied',
      });
    }
    if (commandContext.kind === 'source-control') {
      if (commandContext.rootPath === undefined) {
        throw unavailableRepositoryError();
      }
      const repositoryRoot = await this.findRepositoryRoot(
        commandContext.rootPath,
        signal,
      );
      if (repositoryRoot === undefined) {
        throw unavailableRepositoryError();
      }
      return repositoryRoot;
    }
    const activeRepository = await this.resolveActiveRepository(context, signal);
    if (activeRepository !== undefined) {
      return activeRepository;
    }
    const candidates = await this.resolveWorkspaceCandidates(context, signal);
    if (candidates.length === 0) {
      throw unavailableRepositoryError();
    }
    if (candidates.length === 1) {
      const [candidate] = candidates;
      if (candidate === undefined) {
        throw unavailableRepositoryError();
      }
      return candidate.repositoryRoot;
    }
    return this.pickCandidate(candidates);
  }

  private async resolveActiveRepository(
    context: GitReviewRepositoryContext,
    signal: AbortSignal,
  ): Promise<string | undefined> {
    if (
      context.activeFilePath === undefined ||
      !isSafeAbsolutePath(context.activeFilePath)
    ) {
      return undefined;
    }
    return this.findRepositoryRoot(path.dirname(context.activeFilePath), signal);
  }

  private async resolveWorkspaceCandidates(
    context: GitReviewRepositoryContext,
    signal: AbortSignal,
  ): Promise<readonly GitReviewRepositoryCandidate[]> {
    const roots = new Set<string>();
    for (const workspaceFolderPath of context.workspaceFolderPaths) {
      if (!isSafeAbsolutePath(workspaceFolderPath)) {
        continue;
      }
      const repositoryRoot = await this.findRepositoryRoot(workspaceFolderPath, signal);
      if (repositoryRoot !== undefined) {
        roots.add(repositoryRoot);
      }
    }
    return [...roots].map(toRepositoryCandidate);
  }

  private async findRepositoryRoot(
    cwd: string,
    signal: AbortSignal,
  ): Promise<string | undefined> {
    try {
      const result = await this.git.run({
        operation: 'git-review-repository-discovery',
        cwd,
        args: GIT_REPOSITORY_ROOT_ARGS,
        signal,
      });
      return toRepositoryRoot(result.stdout);
    } catch (error: unknown) {
      if (
        error instanceof ApplicationError &&
        (error.code === 'cancelled' ||
          error.code === 'timeout' ||
          error.code === 'permission-denied')
      ) {
        throw error;
      }
      return undefined;
    }
  }

  private async pickCandidate(
    candidates: readonly GitReviewRepositoryCandidate[],
  ): Promise<string | undefined> {
    const selectedRoot = await this.host.pickRepository(candidates);
    return candidates.some((candidate) => candidate.repositoryRoot === selectedRoot)
      ? selectedRoot
      : undefined;
  }
}

function parseCommandContext(args: readonly unknown[]): GitReviewCommandContext {
  if (args.length === 0) {
    return { kind: 'discovery' };
  }
  if (args.length !== 1 || !isSourceControlContext(args[0])) {
    throw invalidInputError();
  }
  const rootUri = args[0].rootUri;
  if (rootUri === undefined) {
    return { kind: 'source-control' };
  }
  if (
    !(rootUri instanceof vscode.Uri) ||
    rootUri.scheme !== 'file' ||
    !isSafeAbsolutePath(rootUri.fsPath)
  ) {
    throw invalidInputError();
  }
  return { kind: 'source-control', rootPath: rootUri.fsPath };
}

function isSourceControlContext(value: unknown): value is {
  readonly id: string;
  readonly label: string;
  readonly rootUri?: unknown;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'id' in value &&
    isBoundedText(value.id) &&
    'label' in value &&
    isBoundedText(value.label) &&
    (!('rootUri' in value) || value.rootUri === undefined || value.rootUri !== null)
  );
}

function isBoundedText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 1_024;
}

class VscodeGitReviewRepositoryHost implements GitReviewRepositoryHost {
  public getContext(): GitReviewRepositoryContext {
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    return {
      isWorkspaceTrusted: vscode.workspace.isTrusted,
      activeFilePath: activeUri?.scheme === 'file' ? activeUri.fsPath : undefined,
      workspaceFolderPaths: (vscode.workspace.workspaceFolders ?? []).flatMap(
        (folder) => (folder.uri.scheme === 'file' ? [folder.uri.fsPath] : []),
      ),
    };
  }

  public async pickRepository(
    candidates: readonly GitReviewRepositoryCandidate[],
  ): Promise<string | undefined> {
    const selected = await vscode.window.showQuickPick([...candidates], {
      placeHolder: vscode.l10n.t('Select a Git repository to review'),
      matchOnDescription: true,
    });
    return selected?.repositoryRoot;
  }
}

function toRepositoryRoot(output: string): string | undefined {
  const value = output.trim();
  return isSafeAbsolutePath(value) ? path.resolve(value) : undefined;
}

function toRepositoryCandidate(repositoryRoot: string): GitReviewRepositoryCandidate {
  return {
    repositoryRoot,
    label: path.basename(repositoryRoot) || repositoryRoot,
    description: repositoryRoot,
  };
}

function isSafeAbsolutePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 4_096 &&
    !value.includes('\0') &&
    path.isAbsolute(value)
  );
}

function invalidInputError(): ApplicationError {
  return new ApplicationError('Git Review command input is invalid.', {
    code: 'invalid-input',
  });
}

function unavailableRepositoryError(): ApplicationError {
  return new ApplicationError('No executable Git repository is available for review.', {
    code: 'capability-unavailable',
  });
}
