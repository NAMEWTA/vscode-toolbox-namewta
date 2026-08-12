import { StrictMode, useEffect, useState, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import type { GitBlameReaderModel } from '../core/domains/git-blame/public-api';
import {
  isExtensionToWebviewMessage,
  type ExtensionToWebviewMessage,
  type GitBlameReaderWebviewAction,
} from '../core/contracts';
import './git-blame-reader/reader-accessibility.css';
import { getVscodeApi } from './platform/acquire-vscode-api';
import {
  GitBlameReaderApp,
  type GitBlameReaderWebviewStrings,
} from './git-blame-reader/GitBlameReaderApp';

const root = document.getElementById('root');
const script = document.getElementById('git-blame-reader-model');
if (root === null || script === null)
  throw new Error('Git Blame Reader bootstrap is missing.');
const model = JSON.parse(script.textContent ?? '') as GitBlameReaderModel;
const stringsScript = document.getElementById('git-blame-reader-strings');
if (stringsScript === null) throw new Error('Git Blame Reader strings are missing.');
const strings = JSON.parse(
  stringsScript.textContent ?? '',
) as GitBlameReaderWebviewStrings;
const api = getVscodeApi();
const post = (message: GitBlameReaderWebviewAction): void => api.postMessage(message);
createRoot(root).render(
  <StrictMode>
    <ReaderRoot initialModel={model} strings={strings} post={post} />
  </StrictMode>,
);

function ReaderRoot({
  initialModel,
  strings,
  post,
}: {
  readonly initialModel: GitBlameReaderModel;
  readonly strings: GitBlameReaderWebviewStrings;
  readonly post: (message: GitBlameReaderWebviewAction) => void;
}): JSX.Element {
  const [model, setModel] = useState(initialModel);
  const [status, setStatus] = useState<string | undefined>();
  useEffect(() => {
    const listener = (event: MessageEvent<ExtensionToWebviewMessage>): void => {
      if (!isExtensionToWebviewMessage(event.data)) return;
      if (event.data.type === 'gitBlameReader.model') {
        setModel(event.data.model);
        setStatus(undefined);
      }
      if (
        event.data.type === 'gitBlameReader.state' &&
        event.data.generation === model.generation
      )
        setStatus(event.data.message);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [model.generation]);
  return (
    <GitBlameReaderApp model={model} strings={strings} status={status} post={post} />
  );
}
