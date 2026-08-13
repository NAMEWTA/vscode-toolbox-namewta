import type { GitBlameReaderBlock } from '../../core/domains/git-blame/public-api';

const READER_COMMIT_COLOR_COUNT = 12;

export type ReaderCommitColor = number | 'working-tree';

/** 为相邻提交提供稳定但可区分的色块，避免同一提交在文件中反复变色。 */
export function createReaderCommitColorMap(
  blocks: readonly GitBlameReaderBlock[],
): ReadonlyMap<string, ReaderCommitColor> {
  const colors = new Map<string, ReaderCommitColor>();
  let previous: ReaderCommitColor | undefined;
  for (const block of blocks) {
    const key = block.kind === 'uncommitted' ? 'working-tree' : block.commit;
    if (!colors.has(key)) {
      let color: ReaderCommitColor =
        key === 'working-tree'
          ? 'working-tree'
          : hashCommit(key) % READER_COMMIT_COLOR_COUNT;
      if (color === previous && typeof color === 'number') {
        color = (color + 1) % READER_COMMIT_COLOR_COUNT;
      }
      colors.set(key, color);
    }
    previous = colors.get(key);
  }
  return colors;
}

function hashCommit(commit: string): number {
  let hash = 0;
  for (const character of commit) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  return hash;
}
