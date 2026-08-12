import type {
  GitBlameReaderModel,
  GitBlameReaderSessionModelPort,
} from '../../core/domains/git-blame/public-api';

export class GitBlameReaderSessionModelStore implements GitBlameReaderSessionModelPort {
  #model: GitBlameReaderModel | undefined;

  public get(generation: number): GitBlameReaderModel | undefined {
    return this.#model?.generation === generation ? this.#model : undefined;
  }

  public set(model: GitBlameReaderModel): void {
    this.#model = model;
  }

  public clear(generation?: number): void {
    if (generation === undefined || this.#model?.generation === generation) {
      this.#model = undefined;
    }
  }
}
