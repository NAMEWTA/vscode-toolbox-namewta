export type GitReviewItemActionInput = {
  readonly itemId: string;
  readonly contentIdentity: string;
};

export function isGitReviewItemActionInput(
  value: unknown,
): value is GitReviewItemActionInput {
  return (
    isRecordWithKeys(value, ['itemId', 'contentIdentity']) &&
    isBoundedText(value.itemId, 4_128) &&
    isBoundedText(value.contentIdentity, 512)
  );
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    !value.includes('\0')
  );
}

function isRecordWithKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => key in value)
  );
}
