import {
  type GitBlameAuthorNameStyle,
  type GitBlameDateFormatStyle,
  mapGitBlameLines,
  type GitBlameAnnotationsResult,
  type GitBlameLine,
  type GitBlameLineChange,
} from '../../core/domains/git-blame/public-api';
export type GitBlameConfiguration = {
  readonly highlightCurrentCommit: boolean;
  readonly ignoreWhitespace: boolean;
  readonly maxLines: number;
  readonly dateFormatStyle: GitBlameDateFormatStyle;
  readonly authorNameStyle: GitBlameAuthorNameStyle;
  readonly showCommitNumber: boolean;
  readonly mergeCommitLines: boolean;
};

export type GitBlameDocumentSnapshot = {
  readonly key: string;
  readonly version: number;
  readonly lineCount: number;
};

export type GitBlameDocumentState =
  | 'disabled'
  | 'loading'
  | 'visible'
  | 'dirty'
  | 'unavailable'
  | 'failed';

export type GitBlameLineIdentity = {
  readonly documentKey: string;
  readonly documentVersion: number;
  readonly generation: number;
  readonly blame: GitBlameLine;
  readonly remoteUrl?: string;
};

export type GitBlameAnnotationLoader = (
  document: GitBlameDocumentSnapshot,
  config: GitBlameConfiguration,
  signal: AbortSignal,
) => Promise<GitBlameAnnotationsResult>;

export type GitBlameAnnotationRenderer = {
  render(
    document: GitBlameDocumentSnapshot,
    lines: readonly GitBlameLine[],
    config: GitBlameConfiguration,
    highlightedLine: number | undefined,
  ): void;
  clear(documentKey: string): void;
  dispose(): void;
};

type DocumentSession = {
  readonly document: GitBlameDocumentSnapshot;
  readonly config: GitBlameConfiguration;
  readonly generation: number;
  readonly controller: AbortController;
  state: GitBlameDocumentState;
  lines?: readonly GitBlameLine[];
  remoteUrl?: string;
  highlightedLine: number | undefined;
};

export class GitBlameAnnotationController {
  readonly #sessions = new Map<string, DocumentSession>();
  #nextGeneration = 1;

  public constructor(
    private readonly loader: GitBlameAnnotationLoader,
    private readonly renderer: GitBlameAnnotationRenderer,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  public async show(
    document: GitBlameDocumentSnapshot,
    config: GitBlameConfiguration,
  ): Promise<void> {
    this.cancel(document.key);
    this.renderer.clear(document.key);
    const session = this.createSession(document, config);
    this.#sessions.set(document.key, session);
    if (document.lineCount > config.maxLines) {
      session.state = 'unavailable';
      return;
    }

    try {
      const result = await this.loader(document, config, session.controller.signal);
      if (!this.isCurrent(session)) {
        return;
      }
      if (result.status === 'unavailable') {
        session.state = 'unavailable';
        return;
      }
      session.state = 'visible';
      session.lines = result.lines;
      if (result.remoteUrl !== undefined) {
        session.remoteUrl = result.remoteUrl;
      }
      this.renderer.render(document, result.lines, config, undefined);
    } catch (error: unknown) {
      if (!this.isCurrent(session) || isAbortError(error)) {
        return;
      }
      session.state = 'failed';
      this.renderer.clear(document.key);
      this.onError(error);
    }
  }

  public hide(documentKey: string): void {
    this.cancel(documentKey);
    this.#sessions.delete(documentKey);
    this.renderer.clear(documentKey);
  }

  public applyContentChanges(
    documentKey: string,
    changes: readonly GitBlameLineChange[],
    documentVersion: number,
    currentLineCount: number,
  ): void {
    const previous = this.#sessions.get(documentKey);
    if (
      previous === undefined ||
      !['loading', 'visible', 'dirty'].includes(previous.state)
    ) {
      return;
    }
    previous.controller.abort();
    const document = {
      key: documentKey,
      version: documentVersion,
      lineCount: currentLineCount,
    };
    const lines = mapGitBlameLines(previous.lines ?? [], changes, currentLineCount);
    const dirtySession: DocumentSession = {
      document,
      config: previous.config,
      generation: this.#nextGeneration++,
      controller: new AbortController(),
      state: 'dirty',
      lines,
      ...(previous.remoteUrl === undefined ? {} : { remoteUrl: previous.remoteUrl }),
      highlightedLine: undefined,
    };
    this.#sessions.set(documentKey, dirtySession);
    this.renderer.render(document, lines, previous.config, undefined);
  }

  public rerender(documentKey: string, highlightedLine?: number): void {
    const session = this.#sessions.get(documentKey);
    if (session?.state !== 'visible' || session.lines === undefined) {
      return;
    }
    session.highlightedLine = highlightedLine;
    this.renderer.render(
      session.document,
      session.lines,
      session.config,
      highlightedLine,
    );
  }

  public getState(documentKey: string): GitBlameDocumentState {
    return this.#sessions.get(documentKey)?.state ?? 'disabled';
  }

  public getTrackedDocumentKeys(): readonly string[] {
    return [...this.#sessions.keys()];
  }

  public getLineIdentity(
    documentKey: string,
    line: number,
  ): GitBlameLineIdentity | undefined {
    const session = this.#sessions.get(documentKey);
    if (!isHoverableSession(session)) {
      return undefined;
    }
    const blame = session.lines.find((candidate) => candidate.line === line);
    if (blame === undefined || /^0+$/u.test(blame.commit)) {
      return undefined;
    }
    return {
      documentKey,
      documentVersion: session.document.version,
      generation: session.generation,
      blame,
      ...(session.remoteUrl === undefined ? {} : { remoteUrl: session.remoteUrl }),
    };
  }

  public dispose(): void {
    for (const key of this.#sessions.keys()) {
      this.cancel(key);
      this.renderer.clear(key);
    }
    this.#sessions.clear();
    this.renderer.dispose();
  }

  private createSession(
    document: GitBlameDocumentSnapshot,
    config: GitBlameConfiguration,
  ): DocumentSession {
    return {
      document,
      config,
      generation: this.#nextGeneration++,
      controller: new AbortController(),
      state: 'loading',
      highlightedLine: undefined,
    };
  }

  private cancel(documentKey: string): void {
    this.#sessions.get(documentKey)?.controller.abort();
  }

  private isCurrent(session: DocumentSession): boolean {
    return this.#sessions.get(session.document.key)?.generation === session.generation;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isHoverableSession(
  session: DocumentSession | undefined,
): session is DocumentSession & { readonly lines: readonly GitBlameLine[] } {
  return (
    session !== undefined &&
    (session.state === 'visible' || session.state === 'dirty') &&
    session.lines !== undefined
  );
}
