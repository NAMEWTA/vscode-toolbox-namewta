// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readWebviewBootstrap } from './read-webview-bootstrap';

const validBootstrap = {
  version: 1,
  language: 'en',
  requestTimeoutMs: 10_000,
  strings: {
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
  },
};

describe('readWebviewBootstrap', () => {
  it('parses and validates the bootstrap element', () => {
    document.body.innerHTML = `<script id="toolbox-bootstrap" type="application/json">${JSON.stringify(validBootstrap)}</script>`;
    expect(readWebviewBootstrap(document)).toEqual(validBootstrap);
  });

  it('rejects missing, invalid and incomplete bootstrap data', () => {
    document.body.innerHTML = '';
    expect(() => readWebviewBootstrap(document)).toThrow('not found');

    document.body.innerHTML = '<script id="toolbox-bootstrap">{</script>';
    expect(() => readWebviewBootstrap(document)).toThrow('invalid JSON');

    document.body.innerHTML = '<script id="toolbox-bootstrap">{}</script>';
    expect(() => readWebviewBootstrap(document)).toThrow('failed validation');
  });
});
