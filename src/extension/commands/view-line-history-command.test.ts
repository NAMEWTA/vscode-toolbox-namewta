import { describe, expect, it, vi } from 'vitest';
import type { ExecutableGitResource } from '../../core/domains/git-blame/public-api';
import type { VscodeGitResourceAdapter } from '../adapters/vscode-git-resource-adapter';
import type { GitLineHistoryQuickPick } from '../presentation/git-line-history-quick-pick';
import { ViewLineHistoryCommand } from './view-line-history-command';

const vscodeState = vi.hoisted(() => {
  class Uri {
    public constructor(public readonly fsPath: string) {}

    public toString(): string {
      return `file://${this.fsPath}`;
    }
  }

  return {
    Uri,
    activeTextEditor: undefined as unknown,
    showInformationMessage: vi.fn(),
  };
});

vi.mock('vscode', () => ({
  Uri: vscodeState.Uri,
  l10n: { t: (value: string): string => value },
  window: {
    get activeTextEditor(): unknown {
      return vscodeState.activeTextEditor;
    },
    showInformationMessage: vscodeState.showInformationMessage,
  },
}));

describe('查看行历史命令', () => {
  it('接受行号右键菜单提供的对象上下文并保留一基行号', async () => {
    const quickPick = createQuickPick();
    const resourceAdapter = createResourceAdapter();
    const command = new ViewLineHistoryCommand(quickPick, resourceAdapter);
    const uri = new vscodeState.Uri('/workspace/repository/src/main.ts');

    await command.execute({ uri, lineNumber: 15 });

    expect(resourceAdapter.resolve).toHaveBeenCalledWith(uri);
    expect(quickPick.show).toHaveBeenCalledWith({
      resource: RESOURCE,
      ref: 'HEAD',
      path: 'src/main.ts',
      line: 15,
    });
  });

  it('拒绝字段不完整的行号菜单对象', async () => {
    const command = new ViewLineHistoryCommand(
      createQuickPick(),
      createResourceAdapter(),
    );

    await expect(
      command.execute({ uri: new vscodeState.Uri('/workspace/repository/main.ts') }),
    ).rejects.toMatchObject({ code: 'invalid-input' });
  });
});

const RESOURCE: ExecutableGitResource = {
  repositoryRoot: '/workspace/repository',
  relativePath: 'src/main.ts',
};

function createQuickPick(): GitLineHistoryQuickPick & {
  readonly show: ReturnType<typeof vi.fn>;
} {
  return {
    show: vi.fn<GitLineHistoryQuickPick['show']>().mockResolvedValue(undefined),
    dispose: vi.fn(),
  } as unknown as GitLineHistoryQuickPick & {
    readonly show: ReturnType<typeof vi.fn>;
  };
}

function createResourceAdapter(): VscodeGitResourceAdapter & {
  readonly resolve: ReturnType<typeof vi.fn>;
} {
  return {
    resolve: vi.fn<VscodeGitResourceAdapter['resolve']>().mockResolvedValue(RESOURCE),
  } as unknown as VscodeGitResourceAdapter & {
    readonly resolve: ReturnType<typeof vi.fn>;
  };
}
