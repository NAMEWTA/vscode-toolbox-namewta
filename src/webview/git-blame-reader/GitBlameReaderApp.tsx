/* eslint-disable max-lines-per-function */
import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { GitBlameReaderModel } from '../../core/domains/git-blame/public-api';
import type { GitBlameReaderWebviewAction } from '../../core/contracts';
import {
  ReaderBlockHeader,
  ReaderLogicalLine,
  ReaderVirtualLines,
} from './reader-performance';

export type GitBlameReaderWebviewStrings = {
  readonly title: string;
  readonly search: string;
  readonly logicalLines: string;
  readonly refresh: string;
  readonly copyActions: string;
  readonly copyCode: string;
  readonly copyLineWithBlame: string;
  readonly copyCommitSha: string;
  readonly copyCommitInfo: string;
  readonly copyBlockCode: string;
  readonly copyBlockWithBlame: string;
  readonly copyAllCode: string;
  readonly copyAllWithBlame: string;
  readonly lines: string;
  readonly matches: string;
  readonly noMatches: string;
  readonly workingTree: string;
  readonly uncommitted: string;
};

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
  const searchRef = useRef<HTMLInputElement>(null);
  const [currentLine, setCurrentLine] = useState(model.sourceLine);
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
      .querySelector(`[data-reader-line="${line}"]`)
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
    post({ type: 'gitBlameReader.openSource', generation: model.generation, line });
  };
  const commitDetail = (blockId: string): void =>
    post({
      type: 'gitBlameReader.commitDetail',
      generation: model.generation,
      blockId,
    });
  const copyBlock = (blockId: string): void =>
    post({
      type: 'gitBlameReader.copy',
      generation: model.generation,
      format: 'block-with-blame',
      blockId,
    });
  return (
    <main className="blame-reader-shell">
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
          onClick={() =>
            post({ type: 'gitBlameReader.refresh', generation: model.generation })
          }
        >
          {strings.refresh}
        </button>
      </header>
      <div
        className="blame-reader-actions"
        role="toolbar"
        aria-label={strings.copyActions}
      >
        <button
          type="button"
          onClick={() =>
            post({
              type: 'gitBlameReader.copy',
              generation: model.generation,
              format: 'code',
              line: currentLine,
            })
          }
        >
          {strings.copyCode}
        </button>
        <button
          type="button"
          onClick={() =>
            post({
              type: 'gitBlameReader.copy',
              generation: model.generation,
              format: 'line-with-blame',
              line: currentLine,
            })
          }
        >
          {strings.copyLineWithBlame}
        </button>
        <button
          type="button"
          onClick={() =>
            post({
              type: 'gitBlameReader.copy',
              generation: model.generation,
              format: 'all-code',
            })
          }
        >
          {strings.copyAllCode}
        </button>
        <button
          type="button"
          onClick={() => {
            const block = model.blocks.find(
              ({ startLine, endLine }) =>
                currentLine >= startLine && currentLine <= endLine,
            );
            if (block !== undefined)
              post({
                type: 'gitBlameReader.copy',
                generation: model.generation,
                format: 'commit-sha',
                blockId: block.blockId,
              });
          }}
        >
          {strings.copyCommitSha}
        </button>
        <button
          type="button"
          onClick={() => {
            const block = model.blocks.find(
              ({ startLine, endLine }) =>
                currentLine >= startLine && currentLine <= endLine,
            );
            if (block !== undefined)
              post({
                type: 'gitBlameReader.copy',
                generation: model.generation,
                format: 'commit-info',
                blockId: block.blockId,
              });
          }}
        >
          {strings.copyCommitInfo}
        </button>
        <button
          type="button"
          onClick={() => {
            const block = model.blocks.find(
              ({ startLine, endLine }) =>
                currentLine >= startLine && currentLine <= endLine,
            );
            if (block !== undefined)
              post({
                type: 'gitBlameReader.copy',
                generation: model.generation,
                format: 'block-code',
                blockId: block.blockId,
              });
          }}
        >
          {strings.copyBlockCode}
        </button>
        <button
          type="button"
          onClick={() =>
            post({
              type: 'gitBlameReader.copy',
              generation: model.generation,
              format: 'all-with-blame',
            })
          }
        >
          {strings.copyAllWithBlame}
        </button>
        <span aria-live="polite">
          {matches.length > 0
            ? strings.matches.replace('{0}', String(matches.length))
            : query.length > 0
              ? strings.noMatches
              : ''}
        </span>
      </div>
      {model.lineCount > 5_000 ? (
        <ReaderVirtualLines
          model={model}
          currentLine={currentLine}
          matches={matches}
          onOpen={openLine}
          onSelect={setCurrentLine}
          onCommit={commitDetail}
          onCopyBlock={copyBlock}
          strings={strings}
        />
      ) : (
        <div
          className="blame-reader-scroll"
          role="list"
          aria-label={strings.logicalLines}
        >
          {model.blocks.map((block) => (
            <section className="blame-reader-block" key={block.blockId}>
              <ReaderBlockHeader
                block={block}
                onCommit={commitDetail}
                onCopyBlock={copyBlock}
                strings={strings}
              />
              {block.lines.map((line) => (
                <ReaderLogicalLine
                  key={line.line}
                  line={line}
                  currentLine={currentLine}
                  matches={matches}
                  onOpen={openLine}
                  onSelect={setCurrentLine}
                  strings={strings}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
