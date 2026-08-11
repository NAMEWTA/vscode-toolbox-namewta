import type { Disposable } from '../../core/kernel/disposable';
import type * as vscode from 'vscode';
import type { ToolboxGateway } from '../../core/orchestration/public-api';
import { VscodeGitReviewControllerHost } from '../adapters/vscode-git-review-controller-host';
import { VscodeGitReviewRepositoryAdapter } from '../adapters/vscode-git-review-repository-adapter';
import { VscodeGitReviewWorktreeWatcher } from '../adapters/vscode-git-review-worktree-watcher';
import type { VscodeLoggerAdapter } from '../adapters/vscode-logger-adapter';
import { GitCommandRunner } from '../adapters/git/git-command-runner';
import { VscodeGitReviewPresentation } from '../presentation/vscode-git-review-presentation';
import { GitReviewSessionController } from '../presentation/git-review-session-controller';
import {
  createGitReviewSessionCommands,
  type GitReviewSessionCommand,
} from './git-review-session-command';

export type GitReviewSessionExperienceDependencies = {
  readonly gateway: ToolboxGateway;
  readonly logger: VscodeLoggerAdapter;
  readonly extensionUri: vscode.Uri;
};

export class GitReviewSessionExperience implements Disposable {
  readonly #controller: GitReviewSessionController;

  public readonly commands: readonly GitReviewSessionCommand[];

  public constructor(dependencies: GitReviewSessionExperienceDependencies) {
    const controllerReference: {
      current: GitReviewSessionController | undefined;
    } = { current: undefined };
    const presentation = new VscodeGitReviewPresentation(
      async (item) => {
        if (controllerReference.current !== undefined) {
          await controllerReference.current.select(item);
        }
      },
      {
        extensionUri: dependencies.extensionUri,
        gateway: dependencies.gateway,
        logger: dependencies.logger,
        onSnapshot: (snapshot) => controllerReference.current?.synchronize(snapshot),
      },
    );
    const controller = new GitReviewSessionController({
      gateway: dependencies.gateway,
      repositoryResolver: new VscodeGitReviewRepositoryAdapter(new GitCommandRunner()),
      presentation,
      host: new VscodeGitReviewControllerHost(dependencies.logger, () =>
        dependencies.logger.show(),
      ),
      watcherFactory: (repositoryRoot, onChange) =>
        new VscodeGitReviewWorktreeWatcher(repositoryRoot, onChange),
    });
    controllerReference.current = controller;
    this.#controller = controller;
    this.commands = createGitReviewSessionCommands(controller);
  }

  public dispose(): void {
    this.#controller.dispose();
  }
}
