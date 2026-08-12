export function formatGitBlameLocalDateTime(authoredAt: number): string {
  const date = new Date(authoredAt * 1_000);
  return `${date.getFullYear().toString().padStart(4, '0')}-${padNumber(
    date.getMonth() + 1,
  )}-${padNumber(date.getDate())} ${padNumber(date.getHours())}:${padNumber(
    date.getMinutes(),
  )}`;
}

function padNumber(value: number): string {
  return value.toString().padStart(2, '0');
}
