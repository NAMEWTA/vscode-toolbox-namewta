import { isWebviewBootstrap, type WebviewBootstrap } from '../../core/contracts';

const BOOTSTRAP_ELEMENT_ID = 'toolbox-bootstrap';

export function readWebviewBootstrap(documentRoot: Document): WebviewBootstrap {
  const element = documentRoot.getElementById(BOOTSTRAP_ELEMENT_ID);
  if (element === null) {
    throw new Error('vscode-toolbox-namewta Webview bootstrap was not found.');
  }

  const rawBootstrap = element.textContent;
  if (rawBootstrap === null || rawBootstrap.length === 0) {
    throw new Error('vscode-toolbox-namewta Webview bootstrap is empty.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBootstrap);
  } catch (error: unknown) {
    throw new Error('vscode-toolbox-namewta Webview bootstrap is invalid JSON.', {
      cause: error,
    });
  }

  if (!isWebviewBootstrap(parsed)) {
    throw new Error('vscode-toolbox-namewta Webview bootstrap failed validation.');
  }

  return parsed;
}
