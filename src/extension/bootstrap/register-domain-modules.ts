import * as vscode from 'vscode';
import {
  SystemInfoHandler,
  type RuntimeInfoPort,
} from '../../core/domains/system-info/public-api';
import {
  CopyReferenceHandler,
  type ClipboardPort,
} from '../../core/domains/copy-reference/public-api';
import type { ToolRegistry } from '../../core/orchestration/public-api';
import {
  GitBlameHandler,
  GitCommitChangesHandler,
  GitCopyCommitHashHandler,
  GitHistoricalContentHandler,
  GitLineHistoryHandler,
} from '../../core/domains/git-blame/public-api';
import { GitBlamePortAdapter } from '../adapters/git/git-blame-port-adapter';
import { GitCommandRunner } from '../adapters/git/git-command-runner';
import { GitHistoryPortAdapter } from '../adapters/git/git-history-port-adapter';
import { GitLineHistoryPortAdapter } from '../adapters/git/git-line-history-port-adapter';

export type DomainModuleDependencies = {
  readonly registry: ToolRegistry;
  readonly clipboardPort: ClipboardPort;
  readonly runtimeInfoPort: RuntimeInfoPort;
};

export function registerDomainModules(dependencies: DomainModuleDependencies): void {
  const { clipboardPort, registry, runtimeInfoPort } = dependencies;
  registry.register(new CopyReferenceHandler(clipboardPort));
  registry.register(new GitCopyCommitHashHandler(clipboardPort));
  const git = new GitCommandRunner();
  registry.register(
    new GitBlameHandler(new GitBlamePortAdapter(git, () => vscode.workspace.isTrusted)),
  );
  const history = new GitHistoryPortAdapter(git, () => vscode.workspace.isTrusted);
  registry.register(new GitCommitChangesHandler(history));
  registry.register(new GitHistoricalContentHandler(history));
  registry.register(
    new GitLineHistoryHandler(
      new GitLineHistoryPortAdapter(git, () => vscode.workspace.isTrusted),
    ),
  );
  registry.register(
    new SystemInfoHandler(runtimeInfoPort, () => registry.getCapabilities()),
  );
}
