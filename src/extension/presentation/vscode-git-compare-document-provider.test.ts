import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitCompareResult } from '../../core/domains/git-compare/public-api';
import type { ToolboxGateway } from '../../core/orchestration/public-api';
import { VscodeGitCompareDocumentProvider } from './vscode-git-compare-document-provider';

const vscodeState = vi.hoisted(() => ({
  executeCommand: vi.fn(),
  showInformationMessage: vi.fn(),
}));

vi.mock('vscode', () => {
  class Uri {
    public constructor(public readonly value: string) {}
    public toString(): string {
      return this.value;
    }
  }
  return {
    Uri: {
      parse: (value: string) => new Uri(value),
      file: (value: string) => new Uri(`file://${value}`),
      joinPath: (base: Uri, ...segments: readonly string[]) =>
        new Uri(`${base.value}/${segments.join('/')}`),
    },
    commands: { executeCommand: vscodeState.executeCommand },
    l10n: {
      t: (message: string, ...values: readonly unknown[]): string =>
        values.reduce<string>(
          (text, value, index) => text.replace(`{${String(index)}}`, String(value)),
          message,
        ),
    },
    window: { showInformationMessage: vscodeState.showInformationMessage },
  };
});

beforeEach(() => {
  vscodeState.executeCommand.mockResolvedValue(undefined);
  vscodeState.showInformationMessage.mockResolvedValue(undefined);
});

describe('VscodeGitCompareDocumentProvider', () => {
  it('opens all resources with the public native changes command and directional title', async () => {
    const provider = new VscodeGitCompareDocumentProvider(createGateway());
    const result = comparison([
      { status: 'added', path: 'src/added.ts', contentKind: 'text' },
      { status: 'deleted', path: 'src/deleted.ts', contentKind: 'text' },
    ]);

    await provider.openComparison('/repo', result);

    expect(vscodeState.executeCommand).toHaveBeenCalledWith(
      'vscode.changes',
      'Git comparison aaaaaaaa → bbbbbbbb · 2 files · +4 -2',
      expect.arrayContaining([
        [
          expect.objectContaining({ value: 'file:///repo/src/added.ts' }),
          undefined,
          expect.anything(),
        ],
        [
          expect.objectContaining({ value: 'file:///repo/src/deleted.ts' }),
          expect.anything(),
          undefined,
        ],
      ]),
    );
    const resources = vscodeState.executeCommand.mock
      .calls[0]?.[2] as readonly (readonly [
      UriLike,
      UriLike | undefined,
      UriLike | undefined,
    ])[];
    expect(resources[0]?.[2]?.value).toMatch(/\/src\/added\.ts$/u);
    expect(resources[1]?.[1]?.value).toMatch(/\/src\/deleted\.ts$/u);
  });

  it('uses the old and new repository paths for renamed revision resources', async () => {
    const provider = new VscodeGitCompareDocumentProvider(createGateway());

    await provider.openComparison(
      '/repo',
      comparison([
        {
          status: 'renamed',
          path: 'src/new-name.ts',
          previousPath: 'src/old-name.ts',
          contentKind: 'text',
        },
      ]),
    );

    const resources = vscodeState.executeCommand.mock
      .calls[0]?.[2] as readonly (readonly [
      UriLike,
      UriLike | undefined,
      UriLike | undefined,
    ])[];
    expect(resources[0]?.[1]?.value).toMatch(/\/src\/old-name\.ts$/u);
    expect(resources[0]?.[2]?.value).toMatch(/\/src\/new-name\.ts$/u);
  });

  it('reports an empty comparison without opening a native changes editor', async () => {
    const provider = new VscodeGitCompareDocumentProvider(createGateway());

    await provider.openComparison('/repo', comparison([]));

    expect(vscodeState.showInformationMessage).toHaveBeenCalledWith(
      'No changes between aaaaaaaa and bbbbbbbb.',
    );
    expect(vscodeState.executeCommand).not.toHaveBeenCalled();
  });
});

function comparison(changes: GitCompareResult['changes']): GitCompareResult {
  return {
    base: 'a'.repeat(40),
    target: 'b'.repeat(40),
    changes,
    stats: { files: changes.length, additions: 4, deletions: 2 },
  };
}

function createGateway(): ToolboxGateway {
  return {
    execute: vi.fn(),
    getCapabilities: vi.fn(() => []),
  } as unknown as ToolboxGateway;
}

type UriLike = {
  readonly value: string;
};
