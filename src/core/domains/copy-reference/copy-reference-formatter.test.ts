import { describe, expect, it } from 'vitest';
import { formatCopyReference } from './copy-reference-formatter';
import type { CopyReferenceInput, ResourceSnapshot } from './copy-reference-model';

const workspace = resource('file', '', '/workspace/project', '/workspace/project');

describe('formatCopyReference', () => {
  it('formats an empty editor selection with a one-based cursor line', () => {
    const input = editorInput(
      resource(
        'file',
        '',
        '/workspace/project/src/main.ts',
        '/workspace/project/src/main.ts',
      ),
      { line: 4, character: 8 },
      { line: 4, character: 8 },
    );

    expect(formatCopyReference(input)).toBe('`src/main.ts:5`');
  });

  it.each([
    [{ line: 2, character: 8 }, { line: 2, character: 3 }, '`src/main.ts:3(4-9)`'],
    [{ line: 6, character: 1 }, { line: 3, character: 7 }, '`src/main.ts:4-7`'],
  ])('normalizes reverse selections before formatting', (anchor, active, expected) => {
    expect(
      formatCopyReference(
        editorInput(
          resource(
            'file',
            '',
            '/workspace/project/src/main.ts',
            '/workspace/project/src/main.ts',
          ),
          anchor,
          active,
        ),
      ),
    ).toBe(expected);
  });

  it('uses the deepest matching workspace folder for relative references', () => {
    const nestedWorkspace = resource(
      'file',
      '',
      '/workspace/project/packages/app',
      '/workspace/project/packages/app',
    );
    const input = editorInput(
      resource(
        'file',
        '',
        '/workspace/project/packages/app/src/index.ts',
        '/workspace/project/packages/app/src/index.ts',
      ),
      { line: 0, character: 0 },
      { line: 0, character: 0 },
      [workspace, nestedWorkspace],
    );

    expect(formatCopyReference(input)).toBe('`src/index.ts:1`');
  });

  it('relativizes Windows file URI paths when only the drive-letter case differs', () => {
    const input = editorInput(
      resource(
        'file',
        '',
        '/d:/work/project/README.md',
        String.raw`d:\work\project\README.md`,
      ),
      { line: 0, character: 0 },
      { line: 0, character: 0 },
      [resource('file', '', '/D:/work/project', String.raw`D:\work\project`)],
    );

    expect(formatCopyReference(input)).toBe('`README.md:1`');
  });

  it('uses a sanitized absolute URI when a virtual resource cannot be relativized', () => {
    const input = editorInput(
      resource('memfs', 'repo', '/src/main.ts', 'memfs://repo/src/main.ts'),
      { line: 0, character: 0 },
      { line: 0, character: 0 },
      [resource('memfs', 'other', '/', 'memfs://other/')],
    );

    expect(formatCopyReference(input)).toBe('`memfs://repo/src/main.ts:1`');
  });

  it('relativizes a virtual resource against a matching root workspace', () => {
    const input = editorInput(
      resource('memfs', 'repo', '/src/main.ts', 'memfs://repo/src/main.ts'),
      { line: 0, character: 0 },
      { line: 0, character: 0 },
      [resource('memfs', 'repo', '/', 'memfs://repo/')],
    );

    expect(formatCopyReference(input)).toBe('`src/main.ts:1`');
  });

  it('formats explorer resources without sorting their input order', () => {
    const first = resource(
      'file',
      '',
      '/workspace/project/src/z.ts',
      '/workspace/project/src/z.ts',
    );
    const second = resource(
      'file',
      '',
      '/workspace/project/src/a.ts',
      '/workspace/project/src/a.ts',
    );

    expect(
      formatCopyReference({
        mode: 'relative',
        source: { kind: 'explorer', resources: [first] },
        workspaceFolders: [workspace],
      }),
    ).toBe('`src/z.ts`');
    expect(
      formatCopyReference({
        mode: 'relative',
        source: { kind: 'explorer', resources: [first, second] },
        workspaceFolders: [workspace],
      }),
    ).toBe('```\nsrc/z.ts\nsrc/a.ts\n```');
  });
});

function editorInput(
  target: ResourceSnapshot,
  anchor: { readonly line: number; readonly character: number },
  active: { readonly line: number; readonly character: number },
  workspaceFolders: readonly ResourceSnapshot[] = [workspace],
): CopyReferenceInput {
  return {
    mode: 'relative',
    source: { kind: 'editor', resource: target, selection: { anchor, active } },
    workspaceFolders,
  };
}

function resource(
  scheme: string,
  authority: string,
  path: string,
  absolute: string,
): ResourceSnapshot {
  return { scheme, authority, path, absolute };
}
