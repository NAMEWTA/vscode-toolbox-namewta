export type GitReviewOperation = {
  readonly controller: AbortController;
};

export class GitReviewOperationTracker {
  #current: GitReviewOperation | undefined;
  #isDisposed = false;

  public begin(): GitReviewOperation {
    this.#current?.controller.abort();
    const operation: GitReviewOperation = { controller: new AbortController() };
    this.#current = operation;
    return operation;
  }

  public finish(operation: GitReviewOperation): void {
    if (this.#current === operation) {
      this.#current = undefined;
    }
  }

  public isCurrent(operation: GitReviewOperation): boolean {
    return (
      !this.#isDisposed &&
      this.#current === operation &&
      !operation.controller.signal.aborted
    );
  }

  public dispose(): void {
    this.#isDisposed = true;
    this.#current?.controller.abort();
    this.#current = undefined;
  }
}
