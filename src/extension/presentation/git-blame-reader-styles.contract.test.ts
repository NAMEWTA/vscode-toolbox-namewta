import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(
  path.resolve(process.cwd(), 'src/webview/git-blame-reader/reader-accessibility.css'),
  'utf8',
);

describe('Git Blame Reader responsive stylesheet', () => {
  it('separates the heading from controls at narrow widths', () => {
    expect(stylesheet).toContain('flex: 1 0 100%;');
    expect(stylesheet).toContain('overflow-wrap: anywhere;');
    expect(stylesheet).toContain('min-width: 80px;');
    expect(stylesheet).not.toContain('text-overflow: ellipsis;');
  });

  it('使用双列共享宽度保持软换行行高对齐', () => {
    expect(stylesheet).toContain('grid-template-columns: var(--blame-column-width)');
    expect(stylesheet).toContain('min-height: 24px;');
    expect(stylesheet).toContain('--blame-column-width: 360px;');
    expect(stylesheet).toContain('white-space: pre-wrap;');
  });

  it('保持两列文本可选择，并排除行号与拖动控件', () => {
    expect(stylesheet).toContain('white-space: pre-wrap;');
    expect(stylesheet).toContain('user-select: text;');
    expect(stylesheet).toContain('user-select: none;');
    expect(stylesheet).toContain('content: attr(data-line);');
  });

  it('使用离屏绘制抑制而不是窗口虚拟化', () => {
    expect(stylesheet).toContain('content-visibility: auto;');
    expect(stylesheet).toContain('contain-intrinsic-block-size:');
    expect(stylesheet).not.toContain('.blame-reader-virtual-row');
  });
});
