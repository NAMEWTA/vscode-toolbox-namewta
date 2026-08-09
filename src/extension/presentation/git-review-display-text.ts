export function displayGitReviewText(value: string): string {
  let display = '';
  for (const character of value) {
    const code = character.charCodeAt(0);
    display +=
      code <= 0x1f || code === 0x7f
        ? `\\u${code.toString(16).padStart(4, '0')}`
        : character;
  }
  return display;
}
