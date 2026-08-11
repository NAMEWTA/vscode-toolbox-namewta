import type {
  GitReviewChangeDescriptor,
  GitReviewItemContent,
} from './git-review-model';
import type { GitReviewItemPatch } from './git-review-patch-model';

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

export type GitReviewMutation = 'stage' | 'unstage' | 'discard';

export type GitReviewMutationRequest = GitReviewContentRequest & {
  readonly mutation: GitReviewMutation;
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
  readItemPatch(
    request: GitReviewContentRequest,
    signal: GitReviewCancellationSignal,
  ): Promise<GitReviewItemPatch>;
  mutateItem(
    request: GitReviewMutationRequest,
    signal: GitReviewCancellationSignal,
  ): Promise<readonly GitReviewChangeDescriptor[]>;
};

export type { GitReviewChangeDescriptor, GitReviewItemContent, GitReviewItemPatch };
