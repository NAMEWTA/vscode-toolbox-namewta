/* eslint-disable max-lines */
import * as vscode from 'vscode';
import type { VscodeToolboxNamewtaExtensionApi } from '../../core/contracts';
import { DisposableStore } from '../../core/kernel/disposable';
import {
  DefaultToolboxGateway,
  ToolRegistry,
  type ToolboxGateway,
} from '../../core/orchestration/public-api';
import {
  VscodeCommandRegistrationAdapter,
  type VscodeCommand,
} from '../adapters/vscode-command-registration-adapter';
import { VscodeClipboardAdapter } from '../adapters/vscode-clipboard-adapter';
import { VscodeCopyReferenceSourceAdapter } from '../adapters/vscode-copy-reference-source-adapter';
import { VscodeLoggerAdapter } from '../adapters/vscode-logger-adapter';
import { VscodeRuntimeInfoAdapter } from '../adapters/vscode-runtime-info-adapter';
import { VscodeGitBlameConfigurationAdapter } from '../adapters/vscode-git-blame-configuration-adapter';
import { VscodeGitResourceAdapter } from '../adapters/vscode-git-resource-adapter';
import { GitCommandRunner } from '../adapters/git/git-command-runner';
import { OpenToolboxCommand } from '../commands/open-toolbox-command';
import { CopyReferenceCommand } from '../commands/copy-reference-command';
import { ShowRuntimeInfoCommand } from '../commands/show-runtime-info-command';
import {
  GitBlameVisibilityCommand,
  GitBlameVisibilityHost,
} from '../commands/git-blame-visibility-command';
import {
  GitBlameAnnotationController,
  type GitBlameAnnotationLoader,
} from '../presentation/git-blame-annotation-controller';
import { GitBlameDecorationRenderer } from '../presentation/git-blame-decoration-renderer';
import { GitHistoricalDocumentProvider } from '../presentation/git-historical-document-provider';
import {
  GitLineHistoryQuickPick,
  type GitLineHistoryPageLoader,
  type GitLineHistoryQuickPickItem,
  type GitLineHistoryStartInput,
} from '../presentation/git-line-history-quick-pick';
import type { GitLineHistoryEntry } from '../../core/domains/git-blame/public-api';
import { ViewLineHistoryCommand } from '../commands/view-line-history-command';
import { GitBlameHoverActions } from '../commands/git-blame-hover-action-command';
import { GitBlameHoverProvider } from '../presentation/git-blame-hover-provider';
import { GitReviewSessionExperience } from '../commands/git-review-session-experience';
import { ApplicationError } from '../../core/kernel/application-error';
import { ToolboxPanelController } from '../presentation/toolbox-panel-controller';
import { GitBlameReaderController } from '../presentation/git-blame-reader-controller';
import { GitBlameReaderSessionModelStore } from '../presentation/git-blame-reader-session-model-store';
import { createExtensionPublicApi } from './create-extension-public-api';
import { registerDomainModules } from './register-domain-modules';
import { GitCompareController } from '../presentation/git-compare-controller';
import { GIT_COMPARE_DOCUMENT_SCHEME } from '../presentation/vscode-git-compare-document-provider';

export type ExtensionRuntime = vscode.Disposable & {
  readonly publicApi: VscodeToolboxNamewtaExtensionApi;
};

// Reader 与现有 Git Blame 共享唯一组合根，因此注册逻辑在此集中编排。
// eslint-disable-next-line max-lines-per-function
export function createExtensionRuntime(
  context: vscode.ExtensionContext,
): ExtensionRuntime {
  const disposables = new DisposableStore();
  const logger = disposables.add(new VscodeLoggerAdapter('vscodeToolboxNamewta'));
  const registry = new ToolRegistry();
  const gateway = new DefaultToolboxGateway(registry, logger);
  const runtimeInfoPort = new VscodeRuntimeInfoAdapter(
    readExtensionVersion(context.extension.packageJSON),
  );
  const clipboardPort = new VscodeClipboardAdapter();
  const readerModels = new GitBlameReaderSessionModelStore();

  disposables.add(
    registerDomainModules({ clipboardPort, readerModels, registry, runtimeInfoPort }),
  );
  const gitCompareController = disposables.add(new GitCompareController(gateway));
  disposables.add(
    vscode.workspace.registerTextDocumentContentProvider(
      GIT_COMPARE_DOCUMENT_SCHEME,
      gitCompareController.documentProvider,
    ),
  );
  const historicalProvider = disposables.add(
    new GitHistoricalDocumentProvider(gateway),
  );
  disposables.add(
    vscode.workspace.registerTextDocumentContentProvider(
      'vscode-toolbox-namewta-git',
      historicalProvider,
    ),
  );

  const panelController = disposables.add(
    new ToolboxPanelController(context.extensionUri, gateway, logger),
  );
  const readerController = disposables.add(
    new GitBlameReaderController(
      context.extensionUri,
      gateway,
      logger,
      readerModels,
      historicalProvider,
    ),
  );
  const commandRegistration = new VscodeCommandRegistrationAdapter(logger, () =>
    logger.show(),
  );
  const gitReviewExperience = disposables.add(
    new GitReviewSessionExperience({
      gateway,
      logger,
    }),
  );
  const openToolboxCommand = new OpenToolboxCommand(panelController);
  const showRuntimeInfoCommand = new ShowRuntimeInfoCommand(gateway);
  const copyReferenceCommands = createCopyReferenceCommands(gateway);
  const blameCommands = createBlameCommands(
    gateway,
    disposables,
    historicalProvider,
    logger,
  );
  registerCommands(disposables, commandRegistration, [
    { id: openToolboxCommand.id, execute: () => openToolboxCommand.execute() },
    { id: showRuntimeInfoCommand.id, execute: () => showRuntimeInfoCommand.execute() },
    ...copyReferenceCommands.map((command) => ({
      id: command.id,
      execute: (...args: readonly unknown[]) => command.execute(...args),
    })),
    ...gitReviewExperience.commands,
    ...blameCommands,
    {
      id: 'vscodeToolboxNamewta.gitBlame.openReader',
      execute: () => readerController.open(),
    },
    {
      id: 'vscodeToolboxNamewta.gitCompare.start',
      execute: (...args: readonly unknown[]) => gitCompareController.start(...args),
    },
    {
      id: 'vscodeToolboxNamewta.gitCompare.openHistory',
      execute: (...args: readonly unknown[]) =>
        gitCompareController.openHistory(...args),
    },
  ]);

  const publicApi = createExtensionPublicApi(gateway);

  logger.info('vscode-toolbox-namewta extension activated.', {
    capabilities: gateway.getCapabilities().map(({ command }) => command),
  });

  return {
    publicApi,
    dispose: () => disposables.dispose(),
  };
}

function createBlameCommands(
  gateway: ToolboxGateway,
  disposables: DisposableStore,
  historicalProvider: GitHistoricalDocumentProvider,
  logger: VscodeLoggerAdapter,
): readonly VscodeCommand[] {
  const resourceAdapter = new VscodeGitResourceAdapter(new GitCommandRunner());
  const controller = new GitBlameAnnotationController(
    createBlameLoader(gateway, resourceAdapter),
    new GitBlameDecorationRenderer(),
    () => {
      void vscode.window.showErrorMessage(
        vscode.l10n.t('Git Blame could not be loaded. See the output log for details.'),
      );
    },
  );
  const host = disposables.add(
    new GitBlameVisibilityHost(controller, new VscodeGitBlameConfigurationAdapter()),
  );
  const visibilityCommands = (['toggle', 'show', 'hide', 'refresh'] as const).map(
    (mode) => {
      const command = new GitBlameVisibilityCommand(mode, host);
      return { id: command.id, execute: () => command.execute() };
    },
  );
  return [
    ...visibilityCommands,
    ...createBlameHistoryCommands(
      gateway,
      disposables,
      historicalProvider,
      logger,
      controller,
      resourceAdapter,
    ),
  ];
}

function createCopyReferenceCommands(
  gateway: ToolboxGateway,
): readonly CopyReferenceCommand[] {
  const source = new VscodeCopyReferenceSourceAdapter();
  return [
    new CopyReferenceCommand('relative', gateway, source),
    new CopyReferenceCommand('absolute', gateway, source),
    new CopyReferenceCommand('relative', gateway, source, 'editor-context'),
    new CopyReferenceCommand('absolute', gateway, source, 'editor-context'),
  ];
}

function createBlameHistoryCommands(
  gateway: ToolboxGateway,
  disposables: DisposableStore,
  historicalProvider: GitHistoricalDocumentProvider,
  logger: VscodeLoggerAdapter,
  controller: GitBlameAnnotationController,
  resourceAdapter: VscodeGitResourceAdapter,
): readonly VscodeCommand[] {
  const lineHistoryQuickPick = disposables.add(
    new GitLineHistoryQuickPick(
      () => vscode.window.createQuickPick<GitLineHistoryQuickPickItem>(),
      createLineHistoryLoader(gateway),
      createLineHistoryEntryOpener(historicalProvider),
      {
        emptyLine: vscode.l10n.t('(empty line)'),
        loadMore: vscode.l10n.t('Load more...'),
      },
      (error) => {
        logger.error('View Line History failed.', error);
        const openLog = vscode.l10n.t('Open Log');
        void vscode.window
          .showErrorMessage(
            vscode.l10n.t(
              'Git Blame could not be loaded. See the output log for details.',
            ),
            openLog,
          )
          .then((action) => {
            if (action === openLog) {
              logger.show();
            }
          });
      },
    ),
  );
  const viewLineHistory = new ViewLineHistoryCommand(
    lineHistoryQuickPick,
    resourceAdapter,
  );
  disposables.add(
    vscode.languages.registerHoverProvider('*', new GitBlameHoverProvider(controller)),
  );
  const hoverActions = disposables.add(
    new GitBlameHoverActions({
      gateway,
      controller,
      resourceAdapter,
      historicalProvider,
      viewLineHistory,
    }),
  );
  return [
    {
      id: viewLineHistory.id,
      execute: (...args: readonly unknown[]) => viewLineHistory.execute(...args),
    },
    ...hoverActions.commands,
  ];
}

function createLineHistoryLoader(gateway: ToolboxGateway): GitLineHistoryPageLoader {
  return async (input, signal) => {
    const result = await gateway.execute('gitBlame.getLineHistory', input, {
      signal,
      source: 'extension-command',
    });
    if (!result.ok) {
      if (result.error.code === 'cancelled') {
        throw abortError();
      }
      throw new ApplicationError(result.error.message, {
        code: result.error.code,
        retryable: result.error.retryable,
        ...(result.error.details === undefined
          ? {}
          : { details: result.error.details }),
      });
    }
    return result.data;
  };
}

function createLineHistoryEntryOpener(
  provider: GitHistoricalDocumentProvider,
): (entry: GitLineHistoryEntry, input: GitLineHistoryStartInput) => Promise<void> {
  return (entry, input) =>
    provider.openDiff(
      {
        resource: input.resource,
        ref: entry.parentCommit,
        path: entry.previousPath ?? entry.path,
      },
      { resource: input.resource, ref: entry.commit, path: entry.path },
      `${entry.commit.slice(0, 8)} - ${entry.path.split('/').at(-1) ?? entry.path}`,
    );
}

function abortError(): Error {
  const error = new Error('The Git line history request was cancelled.');
  error.name = 'AbortError';
  return error;
}

function createBlameLoader(
  gateway: ToolboxGateway,
  resourceAdapter: VscodeGitResourceAdapter,
): GitBlameAnnotationLoader {
  return async (document, config, signal) => {
    const resource = await resourceAdapter.resolve(
      vscode.Uri.parse(document.key, true),
      signal,
    );
    const result = await gateway.execute(
      'gitBlame.getAnnotations',
      {
        resource,
        documentVersion: document.version,
        lineCount: document.lineCount,
        ignoreWhitespace: config.ignoreWhitespace,
        showCommitNumber: config.showCommitNumber,
        maxLines: config.maxLines,
      },
      { signal, source: 'extension-command' },
    );
    if (!result.ok) {
      throw new ApplicationError(result.error.message, {
        code: result.error.code,
        retryable: result.error.retryable,
        ...(result.error.details === undefined
          ? {}
          : { details: result.error.details }),
      });
    }
    return result.data;
  };
}

function registerCommands(
  disposables: DisposableStore,
  registration: VscodeCommandRegistrationAdapter,
  commands: readonly VscodeCommand[],
): void {
  for (const command of commands) {
    disposables.add(registration.register(command));
  }
}

function readExtensionVersion(manifest: unknown): string {
  if (
    typeof manifest === 'object' &&
    manifest !== null &&
    'version' in manifest &&
    typeof manifest.version === 'string'
  ) {
    return manifest.version;
  }

  return 'unknown';
}
