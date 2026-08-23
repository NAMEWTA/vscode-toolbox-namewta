import * as vscode from 'vscode';
import type { ToolErrorCode } from '../../core/contracts/tool-error-contract';
import { ApplicationError } from '../../core/kernel/application-error';
import { DisposableStore } from '../../core/kernel/disposable';
import type { ToolboxGateway } from '../../core/orchestration/public-api';
import { GitCommandRunner } from '../adapters/git/git-command-runner';
import { VscodeGitCompareRepositoryAdapter } from '../adapters/vscode-git-compare-repository-adapter';
import {
  GitCompareRevisionQuickPick,
  type GitCompareHistoryPageLoader,
  type GitCompareRevisionQuickPickItem,
  type GitCompareRevisionResolver,
} from './git-compare-revision-quick-pick';
import { VscodeGitCompareDocumentProvider } from './vscode-git-compare-document-provider';

const PAGE_SIZE = 50;

export class GitCompareController implements vscode.Disposable {
  readonly #disposables = new DisposableStore();
  readonly #repositoryResolver = new VscodeGitCompareRepositoryAdapter(
    new GitCommandRunner(),
  );
  readonly #documentProvider: VscodeGitCompareDocumentProvider;
  readonly #revisionPicker: GitCompareRevisionQuickPick;
  #request: AbortController | undefined;
  #isDisposed = false;

  public get documentProvider(): VscodeGitCompareDocumentProvider {
    return this.#documentProvider;
  }

  public constructor(private readonly gateway: ToolboxGateway) {
    this.#documentProvider = this.#disposables.add(
      new VscodeGitCompareDocumentProvider(gateway),
    );
    this.#revisionPicker = this.#disposables.add(
      new GitCompareRevisionQuickPick(
        () => vscode.window.createQuickPick<GitCompareRevisionQuickPickItem>(),
        createHistoryPageLoader(gateway),
        createRevisionResolver(gateway),
        {
          baseTitle: vscode.l10n.t('Select comparison base'),
          targetTitle: (base) =>
            vscode.l10n.t('Select comparison target · base {0}', base.sha.slice(0, 8)),
          basePlaceholder: vscode.l10n.t(
            'Choose a commit or enter a commit number for the base',
          ),
          targetPlaceholder: vscode.l10n.t(
            'Choose a commit or enter a commit number for the target',
          ),
          loadMore: vscode.l10n.t('Load more commits'),
          back: vscode.l10n.t('Back to base selection'),
          useRevision: (revision) => vscode.l10n.t('Use commit number {0}', revision),
          sameRevision: vscode.l10n.t(
            'The base and target resolve to the same commit. Select another target.',
          ),
        },
        (error) => this.reportPickerError(error),
        PAGE_SIZE,
      ),
    );
  }

  public async start(): Promise<void> {
    this.assertAvailable();
    this.#revisionPicker.cancel();
    this.cancelRequest();
    const controller = new AbortController();
    this.#request = controller;
    try {
      const repositoryRoot = await this.#repositoryResolver.resolve(controller.signal);
      if (!this.isCurrent(controller)) return;
      const selection = await this.#revisionPicker.show(repositoryRoot);
      if (selection === undefined || !this.isCurrent(controller)) return;
      const result = await this.gateway.execute(
        'gitCompare.compareCommits',
        {
          repositoryRoot,
          base: selection.base.sha,
          target: selection.target.sha,
        },
        { signal: controller.signal, source: 'extension-command' },
      );
      if (!result.ok) throw toApplicationError(result.error);
      if (this.isCurrent(controller)) {
        await this.#documentProvider.openComparison(repositoryRoot, result.data);
      }
    } catch (error: unknown) {
      if (!isCancellation(error) && !controller.signal.aborted) {
        this.reportError(error);
      }
    } finally {
      if (this.#request === controller) this.#request = undefined;
    }
  }

  public openHistory(): Promise<void> {
    return this.start();
  }

  public dispose(): void {
    if (this.#isDisposed) return;
    this.#isDisposed = true;
    this.cancelRequest();
    this.#disposables.dispose();
  }

  private reportPickerError(error: unknown): void {
    if (typeof error === 'string') {
      void vscode.window.showWarningMessage(error);
      return;
    }
    if (!isCancellation(error)) this.reportError(error);
  }

  private reportError(error: unknown): void {
    const message =
      error instanceof ApplicationError && error.code === 'not-found'
        ? vscode.l10n.t(
            'No unique commit matches that number. Enter a longer commit number.',
          )
        : error instanceof ApplicationError && error.code === 'permission-denied'
          ? vscode.l10n.t('Git comparison requires a trusted workspace.')
          : error instanceof ApplicationError && error.code === 'capability-unavailable'
            ? vscode.l10n.t('No Git repository or commit history is available.')
            : vscode.l10n.t('Git comparison could not be completed.');
    void vscode.window.showErrorMessage(message);
  }

  private isCurrent(controller: AbortController): boolean {
    return this.#request === controller && !controller.signal.aborted;
  }

  private cancelRequest(): void {
    this.#request?.abort();
    this.#request = undefined;
  }

  private assertAvailable(): void {
    if (this.#isDisposed) {
      throw new Error(vscode.l10n.t('Git comparison is no longer active.'));
    }
  }
}

function createHistoryPageLoader(gateway: ToolboxGateway): GitCompareHistoryPageLoader {
  return async (input, signal) => {
    const result = await gateway.execute('gitCompare.listCommits', input, {
      signal,
      source: 'extension-command',
    });
    if (!result.ok) throw toApplicationError(result.error);
    return result.data;
  };
}

function createRevisionResolver(gateway: ToolboxGateway): GitCompareRevisionResolver {
  return async (input, signal) => {
    const result = await gateway.execute('gitCompare.resolveRevision', input, {
      signal,
      source: 'extension-command',
    });
    if (!result.ok) throw toApplicationError(result.error);
    return result.data;
  };
}

function isCancellation(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (error instanceof ApplicationError && error.code === 'cancelled')
  );
}

function toApplicationError(error: {
  readonly code: ToolErrorCode;
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
