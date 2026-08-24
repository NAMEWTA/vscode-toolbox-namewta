import type { GitBlameReaderBlock } from '../../core/domains/git-blame/public-api';

const READER_COMMIT_COLOR_ORDER = [0, 4, 2, 6, 1, 5, 3, 7] as const;

export type ReaderCommitColor = number | 'working-tree';

/** 为相邻提交提供稳定但可区分的色块，避免同一提交在文件中反复变色。 */
export function createReaderCommitColorMap(
  blocks: readonly GitBlameReaderBlock[],
): ReadonlyMap<string, ReaderCommitColor> {
  const colors = new Map<string, ReaderCommitColor>();
  let nextColor = 0;
  for (const block of blocks) {
    const key = block.kind === 'uncommitted' ? 'working-tree' : block.commit;
    if (!colors.has(key)) {
      const color: ReaderCommitColor =
        key === 'working-tree'
          ? 'working-tree'
          : READER_COMMIT_COLOR_ORDER[nextColor % READER_COMMIT_COLOR_ORDER.length]!;
      colors.set(key, color);
      if (key !== 'working-tree') nextColor += 1;
    }
  }
  return colors;
}
