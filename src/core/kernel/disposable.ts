export type Disposable = {
  dispose(): void;
};

export type DisposeCallback = () => void;

export class DisposableStore implements Disposable {
  readonly #disposables = new Set<Disposable>();
  #isDisposed = false;

  public add<TDisposable extends Disposable>(disposable: TDisposable): TDisposable {
    if (this.#isDisposed) {
      disposable.dispose();
      return disposable;
    }

    this.#disposables.add(disposable);
    return disposable;
  }

  public addCallback(callback: DisposeCallback): Disposable {
    return this.add({ dispose: callback });
  }

  public clear(): void {
    const current = [...this.#disposables];
    this.#disposables.clear();

    for (const disposable of current.reverse()) {
      disposable.dispose();
    }
  }

  public dispose(): void {
    if (this.#isDisposed) {
      return;
    }

    this.#isDisposed = true;
    this.clear();
  }
}
