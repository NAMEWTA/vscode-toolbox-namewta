import * as vscode from 'vscode';
import {
  SystemInfoHandler,
  type RuntimeInfoPort,
} from '../../core/domains/system-info/public-api';
import {
  CopyReferenceHandler,
  type ClipboardPort,
} from '../../core/domains/copy-reference/public-api';
import type { Disposable } from '../../core/kernel/disposable';
import type { ToolRegistry } from '../../core/orchestration/public-api';
import {
  GitBlameHandler,
  GitCommitChangesHandler,
  GitCopyCommitHashHandler,
  GitHistoricalContentHandler,
  GitLineHistoryHandler,
  type GitBlameReaderSessionModelPort,
  GitBlameReaderHandler,
  GitBlameReaderCopyHandler,
} from '../../core/domains/git-blame/public-api';
import { GitBlamePortAdapter } from '../adapters/git/git-blame-port-adapter';
import { GitCommandRunner } from '../adapters/git/git-command-runner';
import { GitHistoryPortAdapter } from '../adapters/git/git-history-port-adapter';
import { GitLineHistoryPortAdapter } from '../adapters/git/git-line-history-port-adapter';
import { registerGitReviewHandlers } from '../adapters/git/git-review-handler-registration';
import { GitReviewPortAdapter } from '../adapters/git/git-review-port-adapter';

export type DomainModuleDependencies = {
  readonly registry: ToolRegistry;
  readonly clipboardPort: ClipboardPort;
  readonly runtimeInfoPort: RuntimeInfoPort;
  readonly readerModels: GitBlameReaderSessionModelPort;
};

export function registerDomainModules(
  dependencies: DomainModuleDependencies,
): Disposable {
  const { clipboardPort, readerModels, registry, runtimeInfoPort } = dependencies;
  registry.register(new CopyReferenceHandler(clipboardPort));
  registry.register(new GitCopyCommitHashHandler(clipboardPort));
  const git = new GitCommandRunner();
  const blamePort = new GitBlamePortAdapter(git, () => vscode.workspace.isTrusted);
  registry.register(new GitBlameHandler(blamePort));
  registry.register(new GitBlameReaderHandler(blamePort));
  registry.register(
    new GitBlameReaderCopyHandler(
      clipboardPort,
      readerModels,
      () => vscode.workspace.isTrusted,
    ),
  );
  const history = new GitHistoryPortAdapter(git, () => vscode.workspace.isTrusted);
  registry.register(new GitCommitChangesHandler(history));
  registry.register(new GitHistoricalContentHandler(history));
  registry.register(
    new GitLineHistoryHandler(
      new GitLineHistoryPortAdapter(git, () => vscode.workspace.isTrusted),
    ),
  );
  const gitReviewSession = registerGitReviewHandlers(
    registry,
    new GitReviewPortAdapter(git, () => vscode.workspace.isTrusted),
  );
  registry.register(
    new SystemInfoHandler(runtimeInfoPort, () => registry.getCapabilities()),
  );
  return gitReviewSession;
}
