import {
  isGitReviewItemContentInput,
  isGitReviewStartInput,
} from '../domains/git-review/git-review-model';
import { isGitReviewItemActionInput } from '../domains/git-review/git-review-item-action';

const EMPTY_INPUT_COMMANDS = new Set([
  'gitReview.previous',
  'gitReview.next',
  'gitReview.markReviewedAndNext',
  'gitReview.retry',
  'gitReview.skip',
  'gitReview.refresh',
  'gitReview.end',
  'gitReview.markStale',
]);

const ITEM_ACTION_COMMANDS = new Set([
  'gitReview.stageItem',
  'gitReview.unstageItem',
  'gitReview.discardItem',
]);

export function isGitReviewToolCommandInput(command: string, input: unknown): boolean {
  if (command === 'gitReview.start') {
    return isGitReviewStartInput(input);
  }
  if (command === 'gitReview.getItemContent') {
    return isGitReviewItemContentInput(input);
  }
  if (ITEM_ACTION_COMMANDS.has(command)) {
    return isGitReviewItemActionInput(input);
  }
  return EMPTY_INPUT_COMMANDS.has(command) && isEmptyRecord(input);
}

function isEmptyRecord(value: unknown): value is Record<string, never> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}
