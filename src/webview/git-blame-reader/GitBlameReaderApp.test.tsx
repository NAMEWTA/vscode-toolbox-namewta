// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitBlameReaderModel } from '../../core/domains/git-blame/public-api';
import {
  GitBlameReaderApp,
  type GitBlameReaderWebviewStrings,
} from './GitBlameReaderApp';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('GitBlameReaderApp', () => {
  it('使用彼此独立的 Blame 与 Code 文本层，并删除复制按钮带', () => {
    renderReader(model(), vi.fn());

    const blame = screen.getByRole('region', { name: 'Blame' });
    const code = screen.getByRole('region', { name: 'Code' });
    expect(blame).toHaveTextContent('Alice');
    expect(blame).not.toHaveTextContent('const first = 1;');
    expect(code).toHaveTextContent('const first = 1;');
    expect(code).not.toHaveTextContent('Alice');
    expect(screen.queryByRole('toolbar', { name: 'Copy actions' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy All Code' })).toBeNull();
  });

  it('每个连续提交块只显示一次 commit hash', () => {
    renderReader(singleBlockModel(), vi.fn());

    const blame = screen.getByRole('region', { name: 'Blame' });
    expect(blame.textContent?.match(/aaaaaaaaaaaa/gu)).toHaveLength(1);
  });
});

describe('GitBlameReaderApp commit details', () => {
  it('在 React 模态中显示提交详情，并只为特权操作发送结构化消息', () => {
    const post = vi.fn();
    renderReader(model(), post);

    fireEvent.click(screen.getByText('const first = 1;'));
    fireEvent.click(screen.getAllByText(/Alice/)[0]!);
    expect(post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Open source line 1' }));
    expect(post).toHaveBeenLastCalledWith({
      type: 'gitBlameReader.openSource',
      generation: 7,
      line: 1,
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Show commit details' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Commit details' });
    expect(dialog).toHaveTextContent('a'.repeat(40));
    expect(dialog).toHaveTextContent('Alice <alice@example.com>');
    expect(dialog).toHaveTextContent('Commit 1');
    expect(post).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy commit SHA' }));
    expect(post).toHaveBeenLastCalledWith({
      type: 'gitBlameReader.copy',
      generation: 7,
      format: 'commit-sha',
      blockId: 'block-1-aaaaaaaaaaaa',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Open commit' }));
    expect(post).toHaveBeenLastCalledWith({
      type: 'gitBlameReader.commitAction',
      generation: 7,
      blockId: 'block-1-aaaaaaaaaaaa',
      action: 'open-remote',
    });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('GitBlameReaderApp layout', () => {
  it('为相邻 commit 分配不同颜色，并让同一 SHA 始终复用颜色', () => {
    renderReader(model(), vi.fn());

    const first = document.querySelector('[data-blame-line="1"]');
    const second = document.querySelector('[data-blame-line="2"]');
    const third = document.querySelector('[data-blame-line="3"]');
    expect(first).toHaveAttribute('data-commit-color');
    expect(second).toHaveAttribute('data-commit-color');
    expect(third).toHaveAttribute('data-commit-color');
    expect(first?.getAttribute('data-commit-color')).not.toBe(
      second?.getAttribute('data-commit-color'),
    );
    expect(first?.getAttribute('data-commit-color')).toBe(
      third?.getAttribute('data-commit-color'),
    );
  });

  it('在 Blame 与 Code 两列标出相同的提交块首尾', () => {
    renderReader(singleBlockModel(), vi.fn());

    expect(document.querySelector('[data-blame-line="1"]')).toHaveClass(
      'is-block-start',
    );
    expect(document.querySelector('[data-code-line="1"]')).toHaveClass(
      'is-block-start',
    );
    expect(document.querySelector('[data-blame-line="2"]')).toHaveClass('is-block-end');
    expect(document.querySelector('[data-code-line="2"]')).toHaveClass('is-block-end');
  });

  it('使用 Ctrl+F 搜索源码并报告匹配数', () => {
    renderReader(model(), vi.fn());
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    const search = screen.getByRole('textbox', { name: 'Search source' });
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: 'second' } });
    expect(screen.getByText('1 match(es)')).toBeInTheDocument();
  });

  it('保留大型模型的全部 logical lines，不再受虚拟窗口限制', () => {
    renderReader(largeModel(), vi.fn());

    expect(document.querySelectorAll('[data-code-line]').length).toBe(5_001);
    expect(document.querySelectorAll('[data-blame-line]').length).toBe(5_001);
    expect(document.querySelector('.blame-reader-virtual')).toBeNull();
  }, 30_000);

  it('通过键盘调整 Blame 列宽并限制在当前布局边界内', () => {
    renderReader(model(), vi.fn());
    const separator = screen.getByRole('separator', { name: 'Resize Blame column' });
    expect(separator).toHaveAttribute('aria-valuenow', '360');
    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(separator).toHaveAttribute('aria-valuenow', '376');
    fireEvent.keyDown(separator, { key: 'Home' });
    expect(separator).toHaveAttribute('aria-valuenow', '220');
  });

  it('刷新模型时保留当前 Reader 会话的列宽', () => {
    const view = renderReader(model(), vi.fn());
    const separator = screen.getByRole('separator', { name: 'Resize Blame column' });
    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    view.rerender(
      <GitBlameReaderApp
        model={{ ...model(), generation: 8, sourceLine: 2 }}
        strings={strings()}
        status={undefined}
        post={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('separator', { name: 'Resize Blame column' }),
    ).toHaveAttribute('aria-valuenow', '376');
  });
});

function renderReader(
  readerModel: GitBlameReaderModel,
  post: ReturnType<typeof vi.fn>,
): ReturnType<typeof render> {
  return render(
    <GitBlameReaderApp
      model={readerModel}
      strings={strings()}
      status={undefined}
      post={post}
    />,
  );
}

function model(): GitBlameReaderModel {
  const commits = ['a'.repeat(40), 'b'.repeat(40), 'a'.repeat(40)];
  const lines = commits.map((commit, index) => ({
    line: index + 1,
    text: ['const first = 1;', 'const second = 2;', 'return first;'][index] ?? '',
    blame: {
      line: index + 1,
      commit,
      author: index === 1 ? 'Bob' : 'Alice',
      email: index === 1 ? 'bob@example.com' : 'alice@example.com',
      authoredAt: 1_700_000_000 + index,
      summary: `Commit ${index + 1}`,
    },
    kind: 'committed' as const,
  }));
  return {
    version: 1,
    generation: 7,
    sourceUri: 'file:///repo/main.ts',
    remoteUrl: 'git@github.com:owner/repo.git',
    resource: { repositoryRoot: '/repo', relativePath: 'main.ts' },
    revision: 'HEAD',
    documentVersion: 1,
    sourceLine: 1,
    lineCount: lines.length,
    lineEnding: '\n',
    hasFinalNewline: false,
    lines,
    blocks: lines.map((line) => ({
      blockId: `block-${line.line}-${line.blame.commit.slice(0, 12)}`,
      startLine: line.line,
      endLine: line.line,
      commit: line.blame.commit,
      kind: 'committed' as const,
      author: line.blame.author,
      email: line.blame.email,
      authoredAt: line.blame.authoredAt,
      summary: line.blame.summary,
      lines: [line],
    })),
  };
}

function largeModel(): GitBlameReaderModel {
  const first = model();
  const template = first.lines[0];
  if (template === undefined) throw new Error('测试模型缺少模板行。');
  const lines = Array.from({ length: 5_001 }, (_, index) => ({
    ...template,
    line: index + 1,
    text: `line-${index + 1}`,
    blame: { ...template.blame, line: index + 1 },
  }));
  const block = first.blocks[0];
  if (block === undefined) throw new Error('测试模型缺少模板 block。');
  return {
    ...first,
    sourceLine: 5_001,
    lineCount: lines.length,
    lines,
    blocks: [{ ...block, endLine: lines.length, lines }],
  };
}

function singleBlockModel(): GitBlameReaderModel {
  const first = model();
  const template = first.lines[0];
  const block = first.blocks[0];
  if (template === undefined || block === undefined) {
    throw new Error('测试模型缺少提交块。');
  }
  const lines = [
    template,
    {
      ...template,
      line: 2,
      text: 'const next = 2;',
      blame: { ...template.blame, line: 2 },
    },
  ];
  return {
    ...first,
    lineCount: lines.length,
    lines,
    blocks: [{ ...block, endLine: 2, lines }],
  };
}

function strings(): GitBlameReaderWebviewStrings {
  return {
    title: 'Git Blame Reader',
    search: 'Search source',
    logicalLines: 'Git blame logical lines',
    refresh: 'Refresh',
    blameColumn: 'Blame',
    codeColumn: 'Code',
    openSource: 'Open source line {0}',
    commitDetails: 'Show commit details',
    commitDetailTitle: 'Commit details',
    closeCommitDetails: 'Close commit details',
    commitSha: 'Commit SHA',
    author: 'Author',
    authoredAt: 'Authored at',
    summary: 'Summary',
    affectedLines: 'Affected lines',
    copyCommitSha: 'Copy commit SHA',
    copyCommitInfo: 'Copy commit info',
    openRemoteCommit: 'Open commit',
    openPreviousRevision: 'Open previous revision',
    resizeBlameColumn: 'Resize Blame column',
    lines: '{0} lines',
    matches: '{0} match(es)',
    noMatches: 'No matches',
    workingTree: 'Working Tree',
    uncommitted: 'Uncommitted',
  };
}
