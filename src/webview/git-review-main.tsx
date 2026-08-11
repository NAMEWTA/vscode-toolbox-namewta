import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { GitReviewWebviewAction } from '../core/contracts';
import { GitReviewApp } from './git-review/GitReviewApp';
import './git-review/git-review.css';
import { getVscodeApi } from './platform/acquire-vscode-api';
import { readGitReviewBootstrap } from './platform/read-git-review-bootstrap';
import {
  createWindowTransport,
  WebviewMessageClient,
} from './platform/webview-message-client';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('vscode-toolbox-namewta Git Review root element was not found.');
}

const bootstrap = readGitReviewBootstrap(document);
const api = getVscodeApi();
const client = new WebviewMessageClient(createWindowTransport(api), {
  requestTimeoutMs: bootstrap.requestTimeoutMs,
});
const postAction = (message: GitReviewWebviewAction): void => api.postMessage(message);

window.addEventListener('unload', () => client.dispose(), { once: true });

createRoot(rootElement).render(
  <StrictMode>
    <GitReviewApp
      client={client}
      initialSnapshot={bootstrap.snapshot}
      strings={bootstrap.strings}
      postAction={postAction}
    />
  </StrictMode>,
);
