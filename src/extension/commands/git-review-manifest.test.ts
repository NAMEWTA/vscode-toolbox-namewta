import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const COMMAND_IDS = [
  'vscodeToolboxNamewta.gitReview.start',
  'vscodeToolboxNamewta.gitReview.previous',
  'vscodeToolboxNamewta.gitReview.next',
  'vscodeToolboxNamewta.gitReview.markReviewedAndNext',
  'vscodeToolboxNamewta.gitReview.retry',
  'vscodeToolboxNamewta.gitReview.skip',
  'vscodeToolboxNamewta.gitReview.refresh',
  'vscodeToolboxNamewta.gitReview.end',
  'vscodeToolboxNamewta.gitReview.stageItem',
  'vscodeToolboxNamewta.gitReview.unstageItem',
  'vscodeToolboxNamewta.gitReview.discardItem',
] as const;

describe('Git Review Manifest', () => {
  it('贡献会话和条目命令、Source Control 入口和队列视图，且不贡献 Review 快捷键', () => {
    const manifest = readJson('package.json');
    const contributes = record(manifest.contributes);
    const commands = records(contributes.commands);
    const menus = record(contributes.menus);
    const views = record(contributes.views);

    expect(commands.map(commandId)).toEqual(expect.arrayContaining([...COMMAND_IDS]));
    expect(records(menus['scm/title']).map(commandId)).toContain(
      'vscodeToolboxNamewta.gitReview.start',
    );
    expect(records(views.scm).map(viewId)).toContain(
      'vscodeToolboxNamewta.gitReview.queue',
    );
    expect(records(menus['view/item/context']).map(commandId)).toEqual(
      expect.arrayContaining([
        'vscodeToolboxNamewta.gitReview.stageItem',
        'vscodeToolboxNamewta.gitReview.unstageItem',
        'vscodeToolboxNamewta.gitReview.discardItem',
      ]),
    );
    expect(
      records(contributes.keybindings)
        .map(commandId)
        .filter((command): command is string => typeof command === 'string')
        .filter((command) => command.startsWith('vscodeToolboxNamewta.gitReview.')),
    ).toEqual([]);
  });

  it('为新增 Manifest 文案提供英文和简体中文资源', () => {
    const english = readJson('package.nls.json');
    const chinese = readJson('package.nls.zh-cn.json');

    for (const commandId of COMMAND_IDS) {
      const key = `commands.${commandId.slice('vscodeToolboxNamewta.'.length)}`;
      expect(english[key]).toEqual(expect.any(String));
      expect(chinese[key]).toEqual(expect.any(String));
    }
    expect(english['views.gitReview.queue']).toEqual(expect.any(String));
    expect(chinese['views.gitReview.queue']).toEqual(expect.any(String));
  });
});

function readJson(fileName: string): Record<string, unknown> {
  const filePath = path.resolve(process.cwd(), fileName);
  const value: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  return record(value);
}

function records(value: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error('Git Review Manifest structure is invalid.');
  }
  return value;
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Git Review Manifest structure is invalid.');
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function commandId(value: Record<string, unknown>): string | undefined {
  return typeof value.command === 'string' ? value.command : undefined;
}

function viewId(value: Record<string, unknown>): string | undefined {
  return typeof value.id === 'string' ? value.id : undefined;
}
