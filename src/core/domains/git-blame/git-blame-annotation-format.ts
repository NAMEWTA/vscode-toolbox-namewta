import type { GitBlameLine } from './git-blame-model';

export type GitBlameDateFormatStyle =
  | 'Y/M/D'
  | 'YYYY-MM-DD'
  | 'DD.MM.YYYY'
  | 'relative';
export type GitBlameAuthorNameStyle = 'full' | 'first' | 'last';

export type GitBlameFormatConfiguration = {
  readonly dateFormatStyle: GitBlameDateFormatStyle;
  readonly authorNameStyle: GitBlameAuthorNameStyle;
  readonly mergeCommitLines: boolean;
  readonly nowEpochSeconds: number;
  readonly maxAuthorWidth: number;
};

export type FormattedGitBlameAnnotation = {
  readonly line: number;
  readonly commit: string;
  readonly text: string;
  readonly heatColor?: string;
};

export function formatGitBlameAnnotations(
  lines: readonly GitBlameLine[],
  config: GitBlameFormatConfiguration,
): readonly FormattedGitBlameAnnotation[] {
  const committedHashes = new Set(
    lines.filter((line) => isCommitted(line.commit)).map((line) => line.commit),
  );
  return lines.map((line, index) => {
    const previousCommit = lines[index - 1]?.commit;
    const shouldMerge = config.mergeCommitLines && previousCommit === line.commit;
    const text = shouldMerge ? '' : formatPrimaryText(line, config);
    const heatColor =
      committedHashes.size > 1 && isCommitted(line.commit)
        ? heatColorForCommit(line, config.nowEpochSeconds)
        : undefined;
    return {
      line: line.line,
      commit: line.commit,
      text,
      ...(heatColor === undefined ? {} : { heatColor }),
    };
  });
}

export function measureDisplayWidth(value: string): number {
  let width = 0;
  for (const character of Array.from(value)) {
    if (/\p{Mark}/u.test(character)) {
      continue;
    }
    width += isWideCharacter(character) ? 2 : 1;
  }
  return width;
}

function formatPrimaryText(
  line: GitBlameLine,
  config: GitBlameFormatConfiguration,
): string {
  const date = formatDate(line.authoredAt, config);
  const author = truncateDisplayWidth(
    formatAuthor(line.author, config.authorNameStyle),
    config.maxAuthorWidth,
  );
  return `${date} ${author}`;
}

function formatDate(authoredAt: number, config: GitBlameFormatConfiguration): string {
  if (config.dateFormatStyle === 'relative') {
    return formatRelativeAge(Math.max(0, config.nowEpochSeconds - authoredAt));
  }
  const date = new Date(authoredAt * 1_000);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  switch (config.dateFormatStyle) {
    case 'Y/M/D':
      return `${year}/${month}/${day}`;
    case 'YYYY-MM-DD':
      return `${year}-${padNumber(month)}-${padNumber(day)}`;
    case 'DD.MM.YYYY':
      return `${padNumber(day)}.${padNumber(month)}.${year}`;
  }
}

function formatRelativeAge(ageSeconds: number): string {
  const daySeconds = 86_400;
  if (ageSeconds >= 365 * daySeconds) {
    return `${Math.floor(ageSeconds / (365 * daySeconds))}y`;
  }
  if (ageSeconds >= 30 * daySeconds) {
    return `${Math.floor(ageSeconds / (30 * daySeconds))}mo`;
  }
  if (ageSeconds >= daySeconds) {
    return `${Math.floor(ageSeconds / daySeconds)}d`;
  }
  if (ageSeconds >= 3_600) {
    return `${Math.floor(ageSeconds / 3_600)}h`;
  }
  return `${Math.floor(ageSeconds / 60)}m`;
}

function formatAuthor(author: string, style: GitBlameAuthorNameStyle): string {
  const names = author.trim().split(/\s+/u);
  if (style === 'first') {
    return names[0] ?? author;
  }
  if (style === 'last') {
    return names.at(-1) ?? author;
  }
  return author;
}

function truncateDisplayWidth(value: string, maxWidth: number): string {
  if (measureDisplayWidth(value) <= maxWidth) {
    return value;
  }
  const targetWidth = Math.max(1, maxWidth - 1);
  let result = '';
  for (const character of Array.from(value)) {
    if (measureDisplayWidth(result + character) > targetWidth) {
      break;
    }
    result += character;
  }
  return `${result}…`;
}

function heatColorForCommit(line: GitBlameLine, nowEpochSeconds: number): string {
  const hue = Number.parseInt(line.commit.slice(0, 8), 16) % 360;
  const ageDays = Math.max(0, nowEpochSeconds - line.authoredAt) / 86_400;
  const saturation = Math.round(Math.max(35, 75 - Math.min(40, ageDays / 30)));
  return `hsl(${hue} ${saturation}% 50%)`;
}

function isCommitted(commit: string): boolean {
  return !/^0+$/u.test(commit);
}

function isWideCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;
  const wideRanges: readonly (readonly [number, number])[] = [
    [0x1100, 0x115f],
    [0x2e80, 0xa4cf],
    [0xac00, 0xd7a3],
    [0xf900, 0xfaff],
    [0x1f300, 0x1faff],
  ];
  return wideRanges.some(([start, end]) => codePoint >= start && codePoint <= end);
}

function padNumber(value: number): string {
  return value.toString().padStart(2, '0');
}
