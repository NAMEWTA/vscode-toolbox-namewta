import {
  GitReviewEndHandler,
  GitReviewGetItemContentHandler,
  GitReviewStageItemHandler,
  GitReviewUnstageItemHandler,
  GitReviewDiscardItemHandler,
  GitReviewMarkReviewedAndNextHandler,
  GitReviewMarkStaleHandler,
  GitReviewNextHandler,
  GitReviewPreviousHandler,
  GitReviewRefreshHandler,
  GitReviewRetryHandler,
  GitReviewSessionService,
  GitReviewSkipHandler,
  GitReviewStartHandler,
  type GitReviewPort,
} from '../../../core/domains/git-review/public-api';
import type { ToolRegistry } from '../../../core/orchestration/public-api';

export function registerGitReviewHandlers(
  registry: ToolRegistry,
  port: GitReviewPort,
): GitReviewSessionService {
  const session = new GitReviewSessionService(port);
  registry.register(new GitReviewStartHandler(session));
  registry.register(new GitReviewPreviousHandler(session));
  registry.register(new GitReviewNextHandler(session));
  registry.register(new GitReviewMarkReviewedAndNextHandler(session));
  registry.register(new GitReviewRetryHandler(session));
  registry.register(new GitReviewSkipHandler(session));
  registry.register(new GitReviewRefreshHandler(session));
  registry.register(new GitReviewEndHandler(session));
  registry.register(new GitReviewMarkStaleHandler(session));
  registry.register(new GitReviewGetItemContentHandler(session));
  registry.register(new GitReviewStageItemHandler(session));
  registry.register(new GitReviewUnstageItemHandler(session));
  registry.register(new GitReviewDiscardItemHandler(session));
  return session;
}
