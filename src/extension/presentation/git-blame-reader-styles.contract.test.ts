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

  it('keeps source code selectable without inherited inline-code framing', () => {
    expect(stylesheet).not.toContain('min-width: 320px;');
    expect(stylesheet).toContain('background: transparent;');
    expect(stylesheet).toContain('white-space: pre-wrap;');
    expect(stylesheet).toContain('user-select: text;');
  });
});
