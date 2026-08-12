// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitBlameReaderModel } from '../../core/domains/git-blame/public-api';
import { GitBlameReaderApp } from './GitBlameReaderApp';

describe('GitBlameReaderApp', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  it('renders selectable source text and sends typed navigation/copy actions', () => {
    const post = vi.fn();
    render(
      <GitBlameReaderApp
        model={model()}
        strings={strings()}
        status={undefined}
        post={post}
      />,
    );

    const source = screen.getByText('const value = "<safe>";');
    expect(source).toBeInTheDocument();
    fireEvent.click(source);
    fireEvent.doubleClick(source);
    expect(post).toHaveBeenCalledWith({
      type: 'gitBlameReader.openSource',
      generation: 7,
      line: 1,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy All Code' }));
    expect(post).toHaveBeenCalledWith({
      type: 'gitBlameReader.copy',
      generation: 7,
      format: 'all-code',
    });
  });

  it('uses Ctrl+F to focus source search and reports matches', () => {
    render(
      <GitBlameReaderApp
        model={model()}
        strings={strings()}
        status={undefined}
        post={vi.fn()}
      />,
    );
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    const search = screen.getByRole('textbox', { name: 'Search source' });
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: 'safe' } });
    expect(screen.getByText('1 match(es)')).toBeInTheDocument();
  });

  it('virtualizes large models while Copy All remains a host-model action', () => {
    const post = vi.fn();
    render(
      <GitBlameReaderApp
        model={largeModel()}
        strings={strings()}
        status={undefined}
        post={post}
      />,
    );
    expect(document.querySelectorAll('[data-reader-line]').length).toBeLessThan(100);
    fireEvent.click(screen.getByRole('button', { name: 'Copy All Code' }));
    expect(post).toHaveBeenCalledWith({
      type: 'gitBlameReader.copy',
      generation: 7,
      format: 'all-code',
    });
  });
});

function model(): GitBlameReaderModel {
  const blame = {
    line: 1,
    commit: 'a'.repeat(40),
    author: 'Alice',
    email: 'alice@example.com',
    authoredAt: 1_700_000_000,
    summary: 'Initial',
  };
  const line = {
    line: 1,
    text: 'const value = "<safe>";',
    blame,
    kind: 'committed' as const,
  };
  return {
    version: 1,
    generation: 7,
    sourceUri: 'file:///repo/main.ts',
    resource: { repositoryRoot: '/repo', relativePath: 'main.ts' },
    revision: 'HEAD',
    documentVersion: 1,
    sourceLine: 1,
    lineCount: 1,
    lineEnding: '\n',
    hasFinalNewline: false,
    lines: [line],
    blocks: [
      {
        blockId: 'block-1-aaaaaaaaaaaa',
        startLine: 1,
        endLine: 1,
        commit: blame.commit,
        kind: 'committed',
        author: blame.author,
        email: blame.email,
        authoredAt: blame.authoredAt,
        summary: blame.summary,
        lines: [line],
      },
    ],
  };
}

function largeModel(): GitBlameReaderModel {
  const first = model();
  const lines = Array.from({ length: 5_001 }, (_, index) => ({
    ...first.lines[0],
    line: index + 1,
    text: `line-${index + 1}`,
    blame: { ...first.lines[0]?.blame, line: index + 1 },
  }));
  return {
    ...first,
    sourceLine: 5_001,
    lineCount: lines.length,
    lines,
    blocks: [
      {
        ...first.blocks[0],
        endLine: lines.length,
        lines,
      },
    ],
  } as GitBlameReaderModel;
}

function strings(): {
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
} {
  return {
    title: 'Git Blame Reader',
    search: 'Search source',
    logicalLines: 'Git blame logical lines',
    refresh: 'Refresh',
    copyActions: 'Copy actions',
    copyCode: 'Copy Code',
    copyLineWithBlame: 'Copy Line With Blame',
    copyCommitSha: 'Copy Commit SHA',
    copyCommitInfo: 'Copy Commit Info',
    copyBlockCode: 'Copy Block Code',
    copyBlockWithBlame: 'Copy Block With Blame',
    copyAllCode: 'Copy All Code',
    copyAllWithBlame: 'Copy All With Blame',
    lines: '{0} lines',
    matches: '{0} match(es)',
    noMatches: 'No matches',
    workingTree: 'Working Tree',
    uncommitted: 'Uncommitted',
  };
}
