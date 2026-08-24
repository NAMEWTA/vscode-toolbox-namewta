import { describe, expect, it } from 'vitest';
import { isWebviewBootstrap, type WebviewStrings } from './webview-bootstrap-contract';

const strings: WebviewStrings = {
  eyebrow: 'Foundation',
  title: 'vscode-toolbox-namewta',
  description: 'Description',
  runtimeStatusTitle: 'Runtime status',
  refresh: 'Refresh',
  refreshing: 'Refreshing',
  loadingRuntimeInfo: 'Loading',
  extensionLabel: 'Extension',
  apiLabel: 'API',
  vscodeLabel: 'VS Code',
  nodeLabel: 'Node',
  languageLabel: 'Language',
  workspaceLabel: 'Workspace',
  environmentLabel: 'Environment',
  runtimeLabel: 'Runtime',
  toolsLabel: 'Tools',
  trusted: 'Trusted',
  restricted: 'Restricted',
  remote: 'Remote',
  local: 'Local',
  unknownError: 'Unknown error',
};

describe('Webview bootstrap contract', () => {
  it('accepts a complete, bounded bootstrap payload', () => {
    expect(
      isWebviewBootstrap({
        version: 1,
        language: 'en',
        requestTimeoutMs: 10_000,
        strings,
      }),
    ).toBe(true);
  });

  it('rejects incomplete strings and unsafe timeouts', () => {
    expect(
      isWebviewBootstrap({
        version: 1,
        language: 'en',
        requestTimeoutMs: 999,
        strings,
      }),
    ).toBe(false);
    expect(
      isWebviewBootstrap({
        version: 1,
        language: 'en',
        requestTimeoutMs: 10_000,
        strings: { title: 'Incomplete' },
      }),
    ).toBe(false);
  });
});
