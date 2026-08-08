import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToolboxApp } from './app/ToolboxApp';
import './app/toolbox-app.css';
import { getVscodeApi } from './platform/acquire-vscode-api';
import { readWebviewBootstrap } from './platform/read-webview-bootstrap';
import {
  createWindowTransport,
  WebviewMessageClient,
} from './platform/webview-message-client';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('vscode-toolbox-namewta Webview root element was not found.');
}

const bootstrap = readWebviewBootstrap(document);
const client = new WebviewMessageClient(createWindowTransport(getVscodeApi()), {
  requestTimeoutMs: bootstrap.requestTimeoutMs,
  onInvalidMessage: (message) => {
    // Webview 诊断信息不得序列化未经验证的未知数据。
    console.warn('Ignored an invalid extension message.', typeof message);
  },
});

window.addEventListener('unload', () => client.dispose(), { once: true });

createRoot(rootElement).render(
  <StrictMode>
    <ToolboxApp client={client} strings={bootstrap.strings} />
  </StrictMode>,
);
