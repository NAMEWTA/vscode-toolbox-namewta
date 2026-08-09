import type {
  GitReviewChangeDescriptor,
  GitReviewItemContent,
} from './git-review-model';

export type GitReviewCancellationSignal = {
  readonly aborted: boolean;
  addEventListener?(
    type: 'abort',
    listener: () => void,
    options?: { readonly once?: boolean },
  ): void;
  removeEventListener?(type: 'abort', listener: () => void): void;
};

export type GitReviewContentRequest = {
  readonly repositoryRoot: string;
  readonly item: GitReviewChangeDescriptor;
};

export type GitReviewPort = {
  listChanges(
    repositoryRoot: string,
    signal: GitReviewCancellationSignal,
  ): Promise<readonly GitReviewChangeDescriptor[]>;
  readItemContent(
    request: GitReviewContentRequest,
    signal: GitReviewCancellationSignal,
  ): Promise<GitReviewItemContent>;
};

export type { GitReviewChangeDescriptor, GitReviewItemContent };
