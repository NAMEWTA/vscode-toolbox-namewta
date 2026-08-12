import type { GitBlameReaderBlock } from '../../core/domains/git-blame/public-api';

export function formatGitBlameReaderCommitDetail(block: GitBlameReaderBlock): string {
  return `${block.commit}\n${block.author} <${block.email}>\n${new Date(block.authoredAt * 1_000).toISOString()}\n${block.summary}`;
}
