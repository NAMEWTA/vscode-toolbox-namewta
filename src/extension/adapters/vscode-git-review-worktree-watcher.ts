import path from 'node:path';
import * as vscode from 'vscode';
import { DisposableStore, type Disposable } from '../../core/kernel/disposable';

export type GitReviewWorktreeFileWatcher = Disposable & {
  onDidCreate(listener: () => void): Disposable;
  onDidChange(listener: () => void): Disposable;
  onDidDelete(listener: () => void): Disposable;
};

export type GitReviewWorktreeWatcherHost = {
  createWatcher(repositoryRoot: string): GitReviewWorktreeFileWatcher;
};

export class VscodeGitReviewWorktreeWatcher implements Disposable {
  readonly #disposables = new DisposableStore();

  public constructor(
    repositoryRoot: string,
    private readonly onChange: () => Promise<void>,
    host: GitReviewWorktreeWatcherHost = new VscodeGitReviewWorktreeWatcherHost(),
  ) {
    assertRepositoryRoot(repositoryRoot);
    const watcher = this.#disposables.add(host.createWatcher(repositoryRoot));
    this.#disposables.add(watcher.onDidCreate(() => this.handleChange()));
    this.#disposables.add(watcher.onDidChange(() => this.handleChange()));
    this.#disposables.add(watcher.onDidDelete(() => this.handleChange()));
  }

  public dispose(): void {
    this.#disposables.dispose();
  }

  private handleChange(): void {
    void this.onChange();
  }
}

class VscodeGitReviewWorktreeWatcherHost implements GitReviewWorktreeWatcherHost {
  public createWatcher(repositoryRoot: string): GitReviewWorktreeFileWatcher {
    return vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(repositoryRoot), '**'),
    );
  }
}

function assertRepositoryRoot(repositoryRoot: string): void {
  if (
    repositoryRoot.length === 0 ||
    repositoryRoot.length > 4_096 ||
    repositoryRoot.includes('\0') ||
    !path.isAbsolute(repositoryRoot)
  ) {
    throw new Error('Git Review repository root is invalid.');
  }
}
