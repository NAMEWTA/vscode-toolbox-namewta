import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Toolbox 命令清单', () => {
  it('声明可打包的 PNG 扩展图标并保留 SVG 源文件', () => {
    const manifest = readJson('package.json');

    expect(manifest.icon).toBe('media/icon.png');
    expect(existsSync(path.resolve(process.cwd(), 'media/icon.png'))).toBe(true);
    expect(existsSync(path.resolve(process.cwd(), 'media/icon.svg'))).toBe(true);
  });

  it('让全部可见命令从 toolbox- 开始并保持稳定命令 ID', () => {
    const manifest = readJson('package.json');
    const contributes = record(manifest.contributes);
    const commands = records(contributes.commands);
    const english = readJson('package.nls.json');
    const chinese = readJson('package.nls.zh-cn.json');

    expect(commands).toHaveLength(19);
    for (const command of commands) {
      expect(command.command).toEqual(
        expect.stringMatching(/^vscodeToolboxNamewta\./u),
      );
      expect(command.category).toBeUndefined();
      const key = localizationKey(command.title);
      expect(english[key]).toEqual(expect.stringMatching(/^toolbox-/u));
      expect(chinese[key]).toEqual(expect.stringMatching(/^toolbox-/u));
    }

    const menus = record(contributes.menus);
    const editorContext = records(menus['editor/context']);
    expect(editorContext.map((item) => item.command)).toEqual(
      expect.arrayContaining([
        'vscodeToolboxNamewta.copyReference.editor.relative',
        'vscodeToolboxNamewta.copyReference.editor.absolute',
      ]),
    );
    const commandPalette = records(menus.commandPalette);
    expect(commandPalette).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'vscodeToolboxNamewta.copyReference.editor.relative',
          when: 'false',
        }),
        expect.objectContaining({
          command: 'vscodeToolboxNamewta.copyReference.editor.absolute',
          when: 'false',
        }),
      ]),
    );
  });
});

function localizationKey(value: unknown): string {
  if (typeof value !== 'string' || !/^%[^%]+%$/u.test(value)) {
    throw new Error('命令标题本地化键无效。');
  }
  return value.slice(1, -1);
}

function readJson(fileName: string): Record<string, unknown> {
  const value: unknown = JSON.parse(
    readFileSync(path.resolve(process.cwd(), fileName), 'utf8'),
  );
  return record(value);
}

function records(value: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error('命令清单结构无效。');
  }
  return value;
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('命令清单结构无效。');
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
