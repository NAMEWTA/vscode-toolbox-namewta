import type { ToolResult } from '../../core/contracts';
import type { GitReviewItemPatch } from '../../core/domains/git-review/public-api';
import type { ToolMessageClient } from '../platform/webview-message-client';

type PatchInput = {
  readonly itemId: string;
  readonly contentIdentity: string;
};

type PatchTask = {
  readonly input: PatchInput;
  readonly externalSignal?: AbortSignal;
  readonly resolve: (result: ToolResult<GitReviewItemPatch>) => void;
  readonly reject: (error: Error) => void;
  abortListener?: () => void;
  controller?: AbortController;
  cancelled: boolean;
  started: boolean;
};

export class GitReviewPatchLoader {
  readonly #queue: PatchTask[] = [];
  readonly #tasks = new Set<PatchTask>();
  #active = 0;
  #disposed = false;

  public constructor(
    private readonly client: ToolMessageClient,
    private readonly concurrency = 2,
  ) {}

  public load(
    input: PatchInput,
    signal?: AbortSignal,
  ): Promise<ToolResult<GitReviewItemPatch>> {
    if (this.#disposed || signal?.aborted === true) {
      return Promise.reject(abortError());
    }
    return new Promise((resolve, reject) => {
      const task: PatchTask = {
        input,
        ...(signal === undefined ? {} : { externalSignal: signal }),
        resolve,
        reject,
        cancelled: false,
        started: false,
      };
      const cancel = (): void => this.cancel(task);
      task.abortListener = cancel;
      signal?.addEventListener('abort', cancel, { once: true });
      this.#tasks.add(task);
      this.#queue.push(task);
      this.drain();
    });
  }

  public dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    for (const task of this.#tasks) {
      this.cancel(task);
    }
    this.#queue.splice(0);
  }

  private drain(): void {
    while (!this.#disposed && this.#active < this.concurrency) {
      const task = this.#queue.shift();
      if (task === undefined) {
        return;
      }
      if (!task.cancelled) {
        this.start(task);
      }
    }
  }

  private start(task: PatchTask): void {
    task.started = true;
    task.controller = new AbortController();
    this.#active += 1;
    void this.client
      .execute('gitReview.getItemPatch', task.input, task.controller.signal)
      .then((result) => {
        if (!task.cancelled) {
          task.resolve(result);
        }
      })
      .catch((error: unknown) => {
        if (!task.cancelled) {
          task.reject(error instanceof Error ? error : new Error(String(error)));
        }
      })
      .finally(() => {
        this.finish(task);
      });
  }

  private cancel(task: PatchTask): void {
    if (task.cancelled) {
      return;
    }
    task.cancelled = true;
    task.controller?.abort();
    task.reject(abortError());
    if (!task.started) {
      this.finish(task);
    }
  }

  private finish(task: PatchTask): void {
    if (!this.#tasks.delete(task)) {
      return;
    }
    if (task.started) {
      this.#active -= 1;
    }
    if (task.abortListener !== undefined) {
      task.externalSignal?.removeEventListener('abort', task.abortListener);
    }
    this.drain();
  }
}

function abortError(): Error {
  const error = new Error('Git Review patch loading was cancelled.');
  error.name = 'AbortError';
  return error;
}
