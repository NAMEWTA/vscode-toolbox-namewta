import { describe, expect, it } from 'vitest';
import {
  buildGitBlameReaderModel,
  formatGitBlameReaderCopy,
  isGitBlameReaderModel,
  isValidGitBlameReaderCopyRequest,
} from './git-blame-reader-model';

// eslint-disable-next-line max-lines-per-function
describe('Git Blame Reader model', () => {
  it('groups only adjacent equal commit lines and preserves source text', () => {
    const model = buildGitBlameReaderModel({
      sourceUri: 'file:///repo/main.ts',
      resource: { repositoryRoot: '/repo', relativePath: 'main.ts' },
      revision: 'HEAD',
      documentVersion: 3,
      generation: 1,
      sourceLine: 1,
      sourceText: 'A\t<main>\r\n\r\nB\r\nA',
      blameLines: [
        line(1, 'a', 'Alice'),
        line(2, 'a', 'Alice'),
        line(3, 'b', 'Bob'),
        line(4, 'a', 'Alice'),
      ],
    });
    expect(model.blocks.map(({ startLine, endLine }) => [startLine, endLine])).toEqual([
      [1, 2],
      [3, 3],
      [4, 4],
    ]);
    expect(model.lines.map(({ text }) => text)).toEqual(['A\t<main>', '', 'B', 'A']);
    expect(model.lineEnding).toBe('\r\n');
  });

  it('generates all copy forms from the host model', () => {
    const model = buildGitBlameReaderModel({
      sourceUri: 'file:///repo/main.ts',
      resource: { repositoryRoot: '/repo', relativePath: 'main.ts' },
      revision: 'HEAD',
      documentVersion: 1,
      generation: 1,
      sourceLine: 1,
      sourceText: 'one\ntwo\n',
      blameLines: [line(1, 'a', 'Alice'), line(2, 'a', 'Alice')],
    });
    const blockId = model.blocks[0]?.blockId;
    expect(blockId).toBeDefined();
    if (blockId === undefined) throw new Error('Expected a block.');
    expect(formatGitBlameReaderCopy({ model, format: 'code', line: 1 })).toBe('one');
    expect(
      formatGitBlameReaderCopy({ model, format: 'line-with-blame', line: 1 }),
    ).toContain('\tone');
    expect(formatGitBlameReaderCopy({ model, format: 'commit-sha', blockId })).toBe(
      'a'.repeat(40),
    );
    expect(
      formatGitBlameReaderCopy({ model, format: 'commit-info', blockId }),
    ).toContain('Alice');
    expect(formatGitBlameReaderCopy({ model, format: 'block-code', blockId })).toBe(
      'one\ntwo\n',
    );
    expect(
      formatGitBlameReaderCopy({ model, format: 'block-with-blame', blockId }),
    ).toContain('one');
    expect(formatGitBlameReaderCopy({ model, format: 'all-code' })).toBe('one\ntwo\n');
    expect(formatGitBlameReaderCopy({ model, format: 'all-with-blame' })).toContain(
      'two',
    );
    expect(formatGitBlameReaderCopy({ model, format: 'all-with-blame' })).toMatch(
      /two\n$/u,
    );
  });

  it('rejects mismatched blame data', () => {
    expect(() =>
      buildGitBlameReaderModel({
        sourceUri: 'file:///repo/main.ts',
        resource: { repositoryRoot: '/repo', relativePath: 'main.ts' },
        revision: 'HEAD',
        documentVersion: 1,
        generation: 1,
        sourceLine: 1,
        sourceText: 'one\ntwo',
        blameLines: [line(1, 'a', 'Alice')],
      }),
    ).toThrow('line count');
    expect(() =>
      buildGitBlameReaderModel({
        sourceUri: 'file:///repo/empty.ts',
        resource: { repositoryRoot: '/repo', relativePath: 'empty.ts' },
        revision: 'HEAD',
        documentVersion: 1,
        generation: 1,
        sourceLine: 1,
        sourceText: '',
        blameLines: [],
      }),
    ).toThrow('non-empty');
  });

  it('never exposes the zero commit as an uncommitted SHA', () => {
    const model = buildGitBlameReaderModel({
      sourceUri: 'file:///repo/main.ts',
      resource: { repositoryRoot: '/repo', relativePath: 'main.ts' },
      revision: 'HEAD',
      documentVersion: 1,
      generation: 1,
      sourceLine: 1,
      sourceText: 'working tree',
      blameLines: [
        {
          ...line(1, '0', 'Working Tree'),
          commit: '0'.repeat(40),
        },
      ],
    });
    expect(formatGitBlameReaderCopy({ model, format: 'commit-sha', line: 1 })).toBe(
      'Uncommitted',
    );
  });

  it('validates reader models and rejects invalid copy targets', () => {
    const model = buildGitBlameReaderModel({
      sourceUri: 'file:///repo/main.ts',
      resource: { repositoryRoot: '/repo', relativePath: 'main.ts' },
      revision: 'HEAD',
      documentVersion: 1,
      generation: 1,
      sourceLine: 1,
      sourceText: 'one',
      blameLines: [line(1, 'a', 'Alice')],
    });
    expect(isGitBlameReaderModel(model)).toBe(true);
    expect(isGitBlameReaderModel({ ...model, lineCount: 2 })).toBe(false);
    expect(isValidGitBlameReaderCopyRequest({ model, format: 'code' })).toBe(false);
    expect(
      isValidGitBlameReaderCopyRequest({ model, format: 'block-code', line: 1 }),
    ).toBe(false);
    expect(() => formatGitBlameReaderCopy({ model, format: 'code' })).toThrow(
      'invalid',
    );
  });

  it('exports every line from a model above the virtualization threshold', () => {
    const sourceLines = Array.from(
      { length: 5_001 },
      (_, index) => `line-${index + 1}`,
    );
    const model = buildGitBlameReaderModel({
      sourceUri: 'file:///repo/large.ts',
      resource: { repositoryRoot: '/repo', relativePath: 'large.ts' },
      revision: 'HEAD',
      documentVersion: 1,
      generation: 1,
      sourceLine: 5_001,
      sourceText: sourceLines.join('\n'),
      blameLines: sourceLines.map((_, index) => line(index + 1, 'a', 'Alice')),
    });
    expect(formatGitBlameReaderCopy({ model, format: 'all-code' })).toBe(
      sourceLines.join('\n'),
    );
    expect(model.blocks).toHaveLength(1);
  });
});

function line(
  lineNumber: number,
  hash: string,
  author: string,
): {
  readonly line: number;
  readonly commit: string;
  readonly author: string;
  readonly email: string;
  readonly authoredAt: number;
  readonly summary: string;
} {
  return {
    line: lineNumber,
    commit: hash.repeat(40),
    author,
    email: `${author.toLowerCase()}@example.com`,
    authoredAt: 1_700_000_000,
    summary: `commit ${hash}`,
  };
}
