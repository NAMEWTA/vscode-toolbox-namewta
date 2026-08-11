import {
  isGitReviewWebviewBootstrap,
  type GitReviewWebviewBootstrap,
} from '../../core/contracts';

export function readGitReviewBootstrap(
  documentRoot: Document,
): GitReviewWebviewBootstrap {
  const element = documentRoot.getElementById('git-review-bootstrap');
  if (element?.textContent === null || element?.textContent === undefined) {
    throw new Error('vscode-toolbox-namewta Git Review bootstrap was not found.');
  }
  let value: unknown;
  try {
    value = JSON.parse(element.textContent);
  } catch (error: unknown) {
    throw new Error('vscode-toolbox-namewta Git Review bootstrap is invalid JSON.', {
      cause: error,
    });
  }
  if (!isGitReviewWebviewBootstrap(value)) {
    throw new Error('vscode-toolbox-namewta Git Review bootstrap failed validation.');
  }
  return value;
}
