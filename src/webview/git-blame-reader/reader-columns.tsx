import { ExternalLink, Info } from 'lucide-react';
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from 'react';
import type {
  GitBlameReaderBlock,
  GitBlameReaderLine,
  GitBlameReaderModel,
} from '../../core/domains/git-blame/public-api';
import type { GitBlameReaderWebviewStrings } from './GitBlameReaderApp';
import {
  createReaderCommitColorMap,
  type ReaderCommitColor,
} from './reader-commit-color';

type ReaderColumnsProps = {
  readonly model: GitBlameReaderModel;
  readonly currentLine: number;
  readonly matches: readonly number[];
  readonly strings: GitBlameReaderWebviewStrings;
  readonly onOpen: (line: number) => void;
  readonly onCommit: (blockId: string) => void;
};

// eslint-disable-next-line max-lines-per-function -- 双列渲染必须共享同一行索引与测量生命周期。
export function ReaderColumns({
  model,
  currentLine,
  matches,
  strings,
  onOpen,
  onCommit,
}: ReaderColumnsProps): JSX.Element {
  const colorByCommit = useMemo(
    () => createReaderCommitColorMap(model.blocks),
    [model.blocks],
  );
  const blockByLine = useMemo(() => {
    const result = new Map<number, GitBlameReaderBlock>();
    for (const block of model.blocks) {
      for (const line of block.lines) result.set(line.line, block);
    }
    return result;
  }, [model.blocks]);
  const [rowHeights, setRowHeights] = useState<readonly number[]>([]);
  const blameRows = useRef<(HTMLDivElement | null)[]>([]);
  const codeRows = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    const measure = (): void => {
      const next = model.lines.map((_, index) =>
        Math.max(
          blameRows.current[index]?.offsetHeight ?? 0,
          codeRows.current[index]?.offsetHeight ?? 0,
        ),
      );
      setRowHeights((previous) =>
        previous.length === next.length &&
        previous.every((height, index) => height === next[index])
          ? previous
          : next,
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    for (const row of [...blameRows.current, ...codeRows.current]) {
      if (row !== null) observer.observe(row);
    }
    return () => observer.disconnect();
  }, [model.generation, model.lines]);

  return (
    <div className="blame-reader-columns" role="group">
      <section
        className="blame-reader-column blame-reader-column-blame"
        role="region"
        aria-label={strings.blameColumn}
      >
        <div className="blame-reader-column-heading" aria-hidden="true">
          {strings.blameColumn}
        </div>
        {model.lines.map((line, index) => {
          const block = blockByLine.get(line.line);
          return (
            <ReaderBlameRow
              key={line.line}
              rowRef={(element) => {
                blameRows.current[index] = element;
              }}
              line={line}
              block={block}
              color={getLineColor(line, block, colorByCommit)}
              height={rowHeights[index]}
              currentLine={currentLine}
              isMatch={matches.includes(line.line)}
              strings={strings}
              onCommit={onCommit}
            />
          );
        })}
      </section>
      <div className="blame-reader-column-divider" aria-hidden="true" />
      <section
        className="blame-reader-column blame-reader-column-code"
        role="region"
        aria-label={strings.codeColumn}
      >
        <div className="blame-reader-column-heading" aria-hidden="true">
          {strings.codeColumn}
        </div>
        {model.lines.map((line, index) => {
          const block = blockByLine.get(line.line);
          return (
            <ReaderCodeRow
              key={line.line}
              rowRef={(element) => {
                codeRows.current[index] = element;
              }}
              line={line}
              block={block}
              color={getLineColor(line, block, colorByCommit)}
              height={rowHeights[index]}
              currentLine={currentLine}
              isMatch={matches.includes(line.line)}
              strings={strings}
              onOpen={onOpen}
            />
          );
        })}
      </section>
    </div>
  );
}

function getLineColor(
  line: GitBlameReaderLine,
  block: GitBlameReaderBlock | undefined,
  colorByCommit: ReadonlyMap<string, ReaderCommitColor>,
): ReaderCommitColor {
  const key = line.kind === 'uncommitted' ? 'working-tree' : line.blame.commit;
  return colorByCommit.get(key) ?? (block?.kind === 'uncommitted' ? 'working-tree' : 0);
}

function rowStyle(height: number | undefined): CSSProperties {
  return height === undefined || height <= 0 ? {} : { minHeight: `${height}px` };
}

function lineClassName(
  currentLine: number,
  line: number,
  isMatch: boolean,
  block: GitBlameReaderBlock | undefined,
): string {
  return [
    currentLine === line ? 'is-current' : '',
    isMatch ? 'is-match' : '',
    block?.startLine === line ? 'is-block-start' : '',
    block?.endLine === line ? 'is-block-end' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function commitLabel(
  line: GitBlameReaderLine,
  strings: GitBlameReaderWebviewStrings,
): string {
  return line.kind === 'uncommitted'
    ? strings.uncommitted
    : line.blame.commit.slice(0, 12);
}

function metadata(
  line: GitBlameReaderLine,
  strings: GitBlameReaderWebviewStrings,
): string {
  if (line.kind === 'uncommitted') {
    return `${strings.workingTree} · ${line.blame.author} · ${strings.uncommitted}`;
  }
  return `${new Date(line.blame.authoredAt * 1_000).toISOString()} · ${line.blame.author}`;
}

function colorAttribute(color: ReaderCommitColor): string {
  return String(color);
}

function blockStyle(color: ReaderCommitColor): {
  readonly 'data-commit-color': string;
} {
  return { 'data-commit-color': colorAttribute(color) };
}

function blockLeading(
  block: GitBlameReaderBlock | undefined,
  line: GitBlameReaderLine,
  strings: GitBlameReaderWebviewStrings,
  onCommit: (blockId: string) => void,
): JSX.Element | null {
  if (block === undefined || block.startLine !== line.line) return null;
  return (
    <span className="blame-reader-block-leading">
      <span className="blame-reader-commit-sha">{commitLabel(line, strings)}</span>
      <span className="blame-reader-commit-summary">{block.summary}</span>
      {block.kind !== 'uncommitted' ? (
        <button
          type="button"
          className="blame-reader-icon-button"
          aria-label={strings.commitDetails}
          title={strings.commitDetails}
          onClick={() => onCommit(block.blockId)}
        >
          <Info size={14} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}

const ReaderBlameRow = ({
  line,
  block,
  color,
  height,
  currentLine,
  isMatch,
  strings,
  onCommit,
  rowRef,
}: {
  readonly line: GitBlameReaderLine;
  readonly block: GitBlameReaderBlock | undefined;
  readonly color: ReaderCommitColor;
  readonly height: number | undefined;
  readonly currentLine: number;
  readonly isMatch: boolean;
  readonly strings: GitBlameReaderWebviewStrings;
  readonly onCommit: (blockId: string) => void;
  readonly rowRef: (element: HTMLDivElement | null) => void;
}): JSX.Element => (
  <div
    ref={rowRef}
    className={`blame-reader-blame-row ${lineClassName(currentLine, line.line, isMatch, block)}`}
    data-blame-line={line.line}
    {...blockStyle(color)}
    style={rowStyle(height)}
  >
    <span
      className="blame-reader-line-number"
      data-line={line.line}
      aria-hidden="true"
    />
    <span className="blame-reader-blame-text">
      {blockLeading(block, line, strings, onCommit)}
      <span className="blame-reader-meta">{metadata(line, strings)}</span>
    </span>
  </div>
);

const ReaderCodeRow = ({
  line,
  block,
  color,
  height,
  currentLine,
  isMatch,
  strings,
  onOpen,
  rowRef,
}: {
  readonly line: GitBlameReaderLine;
  readonly block: GitBlameReaderBlock | undefined;
  readonly color: ReaderCommitColor;
  readonly height: number | undefined;
  readonly currentLine: number;
  readonly isMatch: boolean;
  readonly strings: GitBlameReaderWebviewStrings;
  readonly onOpen: (line: number) => void;
  readonly rowRef: (element: HTMLDivElement | null) => void;
}): JSX.Element => (
  <div
    ref={rowRef}
    className={`blame-reader-code-row ${lineClassName(currentLine, line.line, isMatch, block)}`}
    data-code-line={line.line}
    {...blockStyle(color)}
    style={rowStyle(height)}
  >
    <code>{line.text}</code>
    <button
      type="button"
      className="blame-reader-icon-button blame-reader-open-button"
      aria-label={strings.openSource.replace('{0}', String(line.line))}
      title={strings.openSource.replace('{0}', String(line.line))}
      onClick={() => onOpen(line.line)}
    >
      <ExternalLink size={14} aria-hidden="true" />
    </button>
  </div>
);
