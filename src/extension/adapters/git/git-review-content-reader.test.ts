import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readGitReviewWorkingContent } from './git-review-content-reader';

describe('Git Review 内容读取器', () => {
  it('允许文件系统根目录仓库读取其合法相对路径', async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'vscode-toolbox-namewta-review-content-'),
    );
    const filePath = path.join(directory, 'content.txt');
    try {
      await writeFile(filePath, 'content\n');

      await expect(
        readGitReviewWorkingContent('/', path.relative('/', filePath)),
      ).resolves.toEqual(Buffer.from('content\n'));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
