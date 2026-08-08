import * as vscode from 'vscode';
import {
  type ExecutableGitResource,
  type GitCancellationSignal,
  type GitCommandPort,
} from '../../core/domains/git-blame/public-api';
import { GitResourceResolver } from './git/git-resource-resolver';

export class VscodeGitResourceAdapter {
  readonly #resolver: GitResourceResolver;

  public constructor(git: GitCommandPort) {
    this.#resolver = new GitResourceResolver(git);
  }

  public async resolve(
    uri: vscode.Uri,
    signal?: GitCancellationSignal,
  ): Promise<ExecutableGitResource> {
    return this.#resolver.resolve(
      {
        isWorkspaceTrusted: vscode.workspace.isTrusted,
        scheme: uri.scheme,
        filePath: uri.fsPath,
      },
      signal,
    );
  }
}
