import path from 'node:path';
import * as vscode from 'vscode';
import type { GitCommandPort } from '../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../core/kernel/application-error';

export class VscodeGitCompareRepositoryAdapter {
  public constructor(private readonly git: GitCommandPort) {}

  public async resolve(signal: AbortSignal): Promise<string> {
    if (!vscode.workspace.isTrusted) {
      throw new ApplicationError('Git requires a trusted workspace.', {
        code: 'permission-denied',
      });
    }
    const activePath = vscode.window.activeTextEditor?.document.uri;
    if (activePath?.scheme === 'file') {
      const root = await this.findRoot(path.dirname(activePath.fsPath), signal);
      if (root !== undefined) return root;
    }
    const candidates = await this.findWorkspaceRoots(signal);
    if (candidates.length === 0) {
      throw new ApplicationError('No executable Git repository is available.', {
        code: 'capability-unavailable',
      });
    }
    if (candidates.length === 1) return candidates[0]!;
    const selected = await vscode.window.showQuickPick(
      candidates.map((repositoryRoot) => ({
        label: path.basename(repositoryRoot) || repositoryRoot,
        description: repositoryRoot,
        repositoryRoot,
      })),
      { placeHolder: vscode.l10n.t('Select a Git repository to compare') },
    );
    if (selected === undefined) {
      throw new ApplicationError('Repository selection was cancelled.', {
        code: 'cancelled',
      });
    }
    return selected.repositoryRoot;
  }

  private async findWorkspaceRoots(signal: AbortSignal): Promise<readonly string[]> {
    const roots = new Set<string>();
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      if (folder.uri.scheme !== 'file') continue;
      const root = await this.findRoot(folder.uri.fsPath, signal);
      if (root !== undefined) roots.add(root);
    }
    return [...roots];
  }

  private async findRoot(
    cwd: string,
    signal: AbortSignal,
  ): Promise<string | undefined> {
    try {
      const result = await this.git.run({
        operation: 'git-compare-repository-discovery',
        cwd,
        args: ['--no-optional-locks', 'rev-parse', '--show-toplevel'],
        signal,
      });
      const root = result.stdout.trim();
      return root.length > 0 && path.isAbsolute(root) ? path.resolve(root) : undefined;
    } catch (error: unknown) {
      if (error instanceof ApplicationError && error.code === 'permission-denied')
        throw error;
      return undefined;
    }
  }
}
