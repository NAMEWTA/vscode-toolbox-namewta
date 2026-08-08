import type {
  GitCommitChange,
  GitCommitChangesInput,
  GitCommitChangesResult,
} from '../../core/domains/git-blame/public-api';

export type GitCommitChangesLoader = (
  input: GitCommitChangesInput,
  signal: AbortSignal,
) => Promise<GitCommitChangesResult>;

export type GitCommitChangesSelector = (
  changes: readonly GitCommitChange[],
  signal: AbortSignal,
) => Promise<GitCommitChange | undefined>;

export type GitCommitChangeOpener = (change: GitCommitChange) => Promise<void>;

export class GitCommitChangesQuickPick {
  #active: AbortController | undefined;

  public constructor(
    private readonly load: GitCommitChangesLoader,
    private readonly select: GitCommitChangesSelector,
    private readonly open: GitCommitChangeOpener,
  ) {}

  public async show(input: GitCommitChangesInput): Promise<void> {
    this.#active?.abort();
    const controller = new AbortController();
    this.#active = controller;
    try {
      const result = await this.load(input, controller.signal);
      if (!this.isCurrent(controller)) {
        return;
      }
      const selected = await this.selectChange(result.changes, controller.signal);
      if (selected !== undefined && this.isCurrent(controller)) {
        await this.open(selected);
      }
    } finally {
      if (this.#active === controller) {
        this.#active = undefined;
      }
    }
  }

  public dispose(): void {
    this.#active?.abort();
    this.#active = undefined;
  }

  private selectChange(
    changes: readonly GitCommitChange[],
    signal: AbortSignal,
  ): Promise<GitCommitChange | undefined> {
    if (changes.length <= 1) {
      return Promise.resolve(changes[0]);
    }
    return this.select(changes, signal);
  }

  private isCurrent(controller: AbortController): boolean {
    return this.#active === controller && !controller.signal.aborted;
  }
}
