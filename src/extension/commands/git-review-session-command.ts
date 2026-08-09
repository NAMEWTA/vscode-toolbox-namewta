import { ApplicationError } from '../../core/kernel/application-error';

export type GitReviewSessionCommandAction =
  | 'start'
  | 'previous'
  | 'next'
  | 'markReviewedAndNext'
  | 'retry'
  | 'skip'
  | 'refresh'
  | 'end';

export type GitReviewSessionCommandTarget = {
  start(): Promise<void>;
  previous(): Promise<void>;
  next(): Promise<void>;
  markReviewedAndNext(): Promise<void>;
  retry(): Promise<void>;
  skip(): Promise<void>;
  refresh(): Promise<void>;
  end(): Promise<void>;
};

const COMMAND_IDS: Readonly<Record<GitReviewSessionCommandAction, string>> = {
  start: 'vscodeToolboxNamewta.gitReview.start',
  previous: 'vscodeToolboxNamewta.gitReview.previous',
  next: 'vscodeToolboxNamewta.gitReview.next',
  markReviewedAndNext: 'vscodeToolboxNamewta.gitReview.markReviewedAndNext',
  retry: 'vscodeToolboxNamewta.gitReview.retry',
  skip: 'vscodeToolboxNamewta.gitReview.skip',
  refresh: 'vscodeToolboxNamewta.gitReview.refresh',
  end: 'vscodeToolboxNamewta.gitReview.end',
};

export class GitReviewSessionCommand {
  public readonly id: string;

  public constructor(
    private readonly action: GitReviewSessionCommandAction,
    private readonly target: GitReviewSessionCommandTarget,
  ) {
    this.id = COMMAND_IDS[action];
  }

  public execute(...args: readonly unknown[]): Promise<void> {
    if (args.length !== 0) {
      throw invalidInputError();
    }
    switch (this.action) {
      case 'start':
        return this.target.start();
      case 'previous':
        return this.target.previous();
      case 'next':
        return this.target.next();
      case 'markReviewedAndNext':
        return this.target.markReviewedAndNext();
      case 'retry':
        return this.target.retry();
      case 'skip':
        return this.target.skip();
      case 'refresh':
        return this.target.refresh();
      case 'end':
        return this.target.end();
    }
  }
}

export function createGitReviewSessionCommands(
  target: GitReviewSessionCommandTarget,
): readonly GitReviewSessionCommand[] {
  return (
    [
      'start',
      'previous',
      'next',
      'markReviewedAndNext',
      'retry',
      'skip',
      'refresh',
      'end',
    ] as const
  ).map((action) => new GitReviewSessionCommand(action, target));
}

function invalidInputError(): ApplicationError {
  return new ApplicationError('Git Review command input is invalid.', {
    code: 'invalid-input',
  });
}
