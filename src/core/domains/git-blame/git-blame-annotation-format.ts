import type { GitBlameLine } from './git-blame-model';

export type GitBlameDateFormatStyle =
  | 'Y/M/D'
  | 'YYYY-MM-DD'
  | 'YYYY-MM-DD HH:mm'
  | 'DD.MM.YYYY'
  | 'relative';

export type GitBlameAuthorNameStyle = 'full' | 'first' | 'last';

export type GitBlameFormatConfiguration = {
  readonly dateFormatStyle: GitBlameDateFormatStyle;
  readonly authorNameStyle: GitBlameAuthorNameStyle;
  readonly showCommitNumber: boolean;
  readonly mergeCommitLines: boolean;
  readonly nowEpochSeconds: number;
  readonly maxAuthorWidth: number;
};

export type FormattedGitBlameAnnotation = {
  readonly line: number;
  readonly commit: string;
  readonly text: string;
  readonly heatColor?: string;
  readonly heatBackgroundColor?: string;
};

export function formatGitBlameAnnotations(
  lines: readonly GitBlameLine[],
  config: GitBlameFormatConfiguration,
): readonly FormattedGitBlameAnnotation[] {
  const committed = lines.filter((line) => isCommitted(line.commit));
  const dates = new Map(
    committed.map((line) => [line.line, formatDate(line.authoredAt, config)]),
  );
  const authors = new Map(
    committed.map((line) => [
      line.line,
      truncateDisplayWidth(
        formatAuthor(line.author, config.authorNameStyle),
        config.maxAuthorWidth,
      ),
    ]),
  );
  const dateWidth = maxDisplayWidth(dates.values());
  const authorWidth = maxDisplayWidth(authors.values());
  const commitNumberWidth = config.showCommitNumber
    ? Math.max(0, ...committed.map((line) => String(line.revisionNumber ?? '').length))
    : 0;

  return lines.map((line, index) => {
    const shouldMerge =
      config.mergeCommitLines && lines[index - 1]?.commit === line.commit;
    const lineCommitted = isCommitted(line.commit);
    const text =
      !lineCommitted || shouldMerge
        ? ''
        : formatPrimaryText(
            line,
            dates.get(line.line) ?? '',
            authors.get(line.line) ?? '',
            dateWidth,
            authorWidth,
            commitNumberWidth,
            config.showCommitNumber,
          );
    const colors = lineCommitted
      ? heatColorsForCommit(line, config.nowEpochSeconds)
      : undefined;
    return {
      line: line.line,
      commit: line.commit,
      text,
      ...(colors === undefined
        ? {}
        : {
            heatColor: colors.color,
            heatBackgroundColor: colors.backgroundColor,
          }),
    };
  });
}

export function measureDisplayWidth(value: string): number {
  let width = 0;
  for (const character of Array.from(value)) {
    if (/\p{Mark}/u.test(character)) continue;
    width += isWideCharacter(character) ? 2 : 1;
  }
  return width;
}

export function formatGitBlameLocalDateTime(authoredAt: number): string {
  const date = new Date(authoredAt * 1_000);
  return `${date.getFullYear().toString().padStart(4, '0')}-${padNumber(
    date.getMonth() + 1,
  )}-${padNumber(date.getDate())} ${padNumber(date.getHours())}:${padNumber(
    date.getMinutes(),
  )}`;
}

function formatPrimaryText(
  line: GitBlameLine,
  date: string,
  author: string,
  dateWidth: number,
  authorWidth: number,
  commitNumberWidth: number,
  showCommitNumber: boolean,
): string {
  const commitNumber =
    showCommitNumber && line.revisionNumber !== undefined
      ? ` ${String(line.revisionNumber).padStart(commitNumberWidth, '\u2007')}`
      : '';
  return `${padDisplayWidth(date, dateWidth)} ${padDisplayWidth(author, authorWidth)}${commitNumber}`;
}

function formatDate(authoredAt: number, config: GitBlameFormatConfiguration): string {
  if (config.dateFormatStyle === 'relative') {
    return formatRelativeAge(Math.max(0, config.nowEpochSeconds - authoredAt));
  }
  const date = new Date(authoredAt * 1_000);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  switch (config.dateFormatStyle) {
    case 'Y/M/D':
      return `${year}/${month}/${day}`;
    case 'YYYY-MM-DD':
      return `${year}-${padNumber(month)}-${padNumber(day)}`;
    case 'YYYY-MM-DD HH:mm':
      return formatGitBlameLocalDateTime(authoredAt);
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
  if (ageSeconds >= daySeconds) return `${Math.floor(ageSeconds / daySeconds)}d`;
  if (ageSeconds >= 3_600) return `${Math.floor(ageSeconds / 3_600)}h`;
  return `${Math.floor(ageSeconds / 60)}m`;
}

function formatAuthor(author: string, style: GitBlameAuthorNameStyle): string {
  const names = author.trim().split(/\s+/u);
  if (style === 'first') return names[0] ?? author;
  if (style === 'last') return names.at(-1) ?? author;
  return author;
}

function truncateDisplayWidth(value: string, maxWidth: number): string {
  if (measureDisplayWidth(value) <= maxWidth) return value;
  const targetWidth = Math.max(1, maxWidth - 1);
  let result = '';
  for (const character of Array.from(value)) {
    if (measureDisplayWidth(result + character) > targetWidth) break;
    result += character;
  }
  return `${result}…`;
}

function padDisplayWidth(value: string, width: number): string {
  return `${value}${'\u2007'.repeat(Math.max(0, width - measureDisplayWidth(value)))}`;
}

function maxDisplayWidth(values: Iterable<string>): number {
  return Math.max(0, ...Array.from(values, measureDisplayWidth));
}

function heatColorsForCommit(
  line: GitBlameLine,
  nowEpochSeconds: number,
): { readonly color: string; readonly backgroundColor: string } {
  const hue = Number.parseInt(line.commit.slice(0, 8), 16) % 360;
  const ageDays = Math.max(0, nowEpochSeconds - line.authoredAt) / 86_400;
  const saturation = Math.round(Math.max(42, 78 - Math.min(36, ageDays / 30)));
  return {
    color: `hsl(${hue} ${saturation}% 50%)`,
    backgroundColor: `hsl(${hue} ${saturation}% 50% / 16%)`,
  };
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
