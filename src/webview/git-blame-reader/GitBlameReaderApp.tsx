import { RefreshCw } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { GitBlameReaderModel } from '../../core/domains/git-blame/public-api';
import type { GitBlameReaderWebviewAction } from '../../core/contracts';
import { ReaderColumns } from './reader-columns';

export type GitBlameReaderWebviewStrings = {
  readonly title: string;
  readonly search: string;
  readonly logicalLines: string;
  readonly refresh: string;
  readonly blameColumn: string;
  readonly codeColumn: string;
  readonly openSource: string;
  readonly commitDetails: string;
  readonly resizeBlameColumn: string;
  readonly lines: string;
  readonly matches: string;
  readonly noMatches: string;
  readonly workingTree: string;
  readonly uncommitted: string;
};

const MIN_BLAME_WIDTH = 220;
const DEFAULT_BLAME_WIDTH = 360;
const MAX_BLAME_WIDTH = 640;
const BLAME_WIDTH_STEP = 16;

// eslint-disable-next-line max-lines-per-function -- 工具栏、选择与拖拽状态必须共享同一 Reader 会话。
export function GitBlameReaderApp({
  model,
  strings,
  status,
  post,
}: {
  readonly model: GitBlameReaderModel;
  readonly strings: GitBlameReaderWebviewStrings;
  readonly status: string | undefined;
  readonly post: (message: GitBlameReaderWebviewAction) => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [currentLine, setCurrentLine] = useState(model.sourceLine);
  const [blameWidth, setBlameWidth] = useState(DEFAULT_BLAME_WIDTH);
  const searchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const matches = useMemo(
    () =>
      query.length === 0
        ? []
        : model.lines
            .filter((line) =>
              line.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
            )
            .map((line) => line.line),
    [model.lines, query],
  );

  useEffect(() => {
    setCurrentLine(model.sourceLine);
  }, [model.generation, model.sourceLine]);

  useEffect(() => {
    const line = matches[0] ?? currentLine;
    document
      .querySelector(`[data-code-line="${line}"]`)
      ?.scrollIntoView({ block: 'center' });
  }, [currentLine, matches]);

  useEffect(() => {
    const listener = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'f') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const openLine = (line: number): void => {
    setCurrentLine(line);
    post({ type: 'gitBlameReader.openSource', generation: model.generation, line });
  };
  const commitDetail = (blockId: string): void => {
    post({
      type: 'gitBlameReader.commitDetail',
      generation: model.generation,
      blockId,
    });
  };
  const updateBlameWidth = (next: number): void => {
    const contentWidth = contentRef.current?.clientWidth ?? 0;
    const max =
      contentWidth > 0
        ? Math.min(MAX_BLAME_WIDTH, Math.max(MIN_BLAME_WIDTH, contentWidth - 240))
        : MAX_BLAME_WIDTH;
    setBlameWidth(Math.round(Math.min(max, Math.max(MIN_BLAME_WIDTH, next))));
  };
  const handleSeparatorKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      updateBlameWidth(
        blameWidth +
          (event.key === 'ArrowRight' ? BLAME_WIDTH_STEP : -BLAME_WIDTH_STEP),
      );
    } else if (event.key === 'Home') {
      event.preventDefault();
      updateBlameWidth(MIN_BLAME_WIDTH);
    } else if (event.key === 'End') {
      event.preventDefault();
      updateBlameWidth(MAX_BLAME_WIDTH);
    }
  };
  const handleSeparatorPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture?.(event.pointerId);
    const move = (moveEvent: PointerEvent): void => {
      const bounds = contentRef.current?.getBoundingClientRect();
      if (bounds !== undefined) updateBlameWidth(moveEvent.clientX - bounds.left);
    };
    const stop = (): void => {
      target.releasePointerCapture?.(event.pointerId);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', stop);
      target.removeEventListener('pointercancel', stop);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', stop);
    target.addEventListener('pointercancel', stop);
  };
  const shellStyle = {
    '--blame-column-width': `${blameWidth}px`,
  } as CSSProperties;

  return (
    <main className="blame-reader-shell" style={shellStyle}>
      <header className="blame-reader-toolbar">
        <div>
          <h1>{strings.title}</h1>
          <span aria-live="polite" className="blame-reader-status">
            {status ?? strings.lines.replace('{0}', String(model.lineCount))}
          </span>
        </div>
        <label className="blame-reader-search">
          {strings.search}
          <input
            ref={searchRef}
            aria-label={strings.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="blame-reader-icon-button"
          aria-label={strings.refresh}
          title={strings.refresh}
          onClick={() =>
            post({ type: 'gitBlameReader.refresh', generation: model.generation })
          }
        >
          <RefreshCw size={15} aria-hidden="true" />
        </button>
        <span aria-live="polite" className="blame-reader-match-status">
          {matches.length > 0
            ? strings.matches.replace('{0}', String(matches.length))
            : query.length > 0
              ? strings.noMatches
              : ''}
        </span>
      </header>
      <div
        ref={contentRef}
        className="blame-reader-scroll"
        aria-label={strings.logicalLines}
      >
        <div className="blame-reader-columns-wrap">
          <ReaderColumns
            model={model}
            currentLine={currentLine}
            matches={matches}
            strings={strings}
            onOpen={openLine}
            onCommit={commitDetail}
          />
          <div
            className="blame-reader-resizer"
            role="separator"
            tabIndex={0}
            aria-label={strings.resizeBlameColumn}
            aria-valuemin={MIN_BLAME_WIDTH}
            aria-valuemax={MAX_BLAME_WIDTH}
            aria-valuenow={blameWidth}
            aria-orientation="vertical"
            onKeyDown={handleSeparatorKeyDown}
            onPointerDown={handleSeparatorPointerDown}
          />
        </div>
      </div>
    </main>
  );
}
