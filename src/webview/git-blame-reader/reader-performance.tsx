import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, type JSX } from 'react';
import type {
  GitBlameReaderBlock,
  GitBlameReaderLine,
  GitBlameReaderModel,
} from '../../core/domains/git-blame/public-api';
import type { GitBlameReaderWebviewStrings } from './GitBlameReaderApp';

// eslint-disable-next-line max-lines-per-function
export function ReaderVirtualLines({
  model,
  currentLine,
  matches,
  onOpen,
  onSelect,
  onCommit,
  onCopyBlock,
  strings,
}: {
  readonly model: GitBlameReaderModel;
  readonly currentLine: number;
  readonly matches: readonly number[];
  readonly onOpen: (line: number) => void;
  readonly onSelect: (line: number) => void;
  readonly onCommit: (blockId: string) => void;
  readonly onCopyBlock: (blockId: string) => void;
  readonly strings: GitBlameReaderWebviewStrings;
}): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const blockByStartLine = new Map(
    model.blocks.map((block) => [block.startLine, block]),
  );
  const virtualizer = useVirtualizer({
    count: model.lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (blockByStartLine.has(index + 1) ? 62 : 30),
    overscan: 12,
  });
  useEffect(() => {
    const line = matches[0] ?? currentLine;
    virtualizer.scrollToIndex(Math.max(0, line - 1), { align: 'center' });
  }, [currentLine, matches, virtualizer]);
  return (
    <div
      ref={scrollRef}
      className="blame-reader-scroll"
      role="list"
      aria-label={strings.logicalLines}
    >
      <div
        className="blame-reader-virtual"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          const line = model.lines[row.index];
          if (line === undefined) return null;
          return (
            <div
              ref={virtualizer.measureElement}
              data-index={row.index}
              key={line.line}
              className="blame-reader-virtual-row"
              style={{ transform: `translateY(${row.start}px)` }}
            >
              <ReaderBlockHeader
                block={blockByStartLine.get(line.line)}
                onCommit={onCommit}
                onCopyBlock={onCopyBlock}
                strings={strings}
              />
              <ReaderLogicalLine
                line={line}
                currentLine={currentLine}
                matches={matches}
                onOpen={onOpen}
                onSelect={onSelect}
                strings={strings}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReaderBlockHeader({
  block,
  onCommit,
  onCopyBlock,
  strings,
}: {
  readonly block: GitBlameReaderBlock | undefined;
  readonly onCommit: (blockId: string) => void;
  readonly onCopyBlock: (blockId: string) => void;
  readonly strings: GitBlameReaderWebviewStrings;
}): JSX.Element | null {
  if (block === undefined) return null;
  return (
    <header className="blame-reader-block-header">
      <button
        type="button"
        className="blame-reader-commit"
        onClick={() => onCommit(block.blockId)}
      >
        {block.kind === 'uncommitted' ? strings.uncommitted : block.commit.slice(0, 12)}
      </button>
      <span>{block.author}</span>
      <span>{block.summary}</span>
      <button type="button" onClick={() => onCopyBlock(block.blockId)}>
        {strings.copyBlockWithBlame}
      </button>
    </header>
  );
}

export function ReaderLogicalLine({
  line,
  currentLine,
  matches,
  onOpen,
  onSelect,
  strings,
}: {
  readonly line: GitBlameReaderLine;
  readonly currentLine: number;
  readonly matches: readonly number[];
  readonly onOpen: (line: number) => void;
  readonly onSelect: (line: number) => void;
  readonly strings: GitBlameReaderWebviewStrings;
}): JSX.Element {
  return (
    <div
      role="listitem"
      tabIndex={0}
      data-reader-line={line.line}
      className={`blame-reader-line${currentLine === line.line ? ' is-current' : ''}${matches.includes(line.line) ? ' is-match' : ''}`}
      onClick={() => {
        onSelect(line.line);
        if (window.getSelection()?.isCollapsed !== false) onOpen(line.line);
      }}
      onDoubleClick={() => onOpen(line.line)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen(line.line);
      }}
    >
      <span className="blame-reader-line-number" aria-hidden="true">
        {line.line}
      </span>
      <span className="blame-reader-meta">
        {line.kind === 'uncommitted' ? (
          <>
            {strings.workingTree} · {line.blame.author} · {strings.uncommitted}
          </>
        ) : (
          <>
            {new Date(line.blame.authoredAt * 1_000).toISOString()} ·{' '}
            {line.blame.author} · {line.blame.commit.slice(0, 12)}
          </>
        )}
      </span>
      <code>{line.text}</code>
    </div>
  );
}
