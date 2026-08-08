// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ToolMessageClient } from '../platform/webview-message-client';
import { ToolboxApp } from './ToolboxApp';

const strings = {
  eyebrow: 'Foundation',
  title: 'vscode-toolbox-namewta',
  description: 'Description',
  runtimeStatusTitle: 'Runtime status',
  refresh: 'Refresh',
  refreshing: 'Refreshing',
  loadingRuntimeInfo: 'Loading runtime information',
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
} as const;

function createClient(execute: ToolMessageClient['execute']): ToolMessageClient {
  return { execute };
}

describe('ToolboxApp', () => {
  it('loads and displays runtime information', async () => {
    const execute = vi.fn<ToolMessageClient['execute']>().mockResolvedValue({
      ok: true,
      data: {
        apiVersion: 1,
        extensionVersion: '0.1.0',
        vscodeVersion: '1.100.0',
        nodeVersion: '20.0.0',
        uiLanguage: 'en',
        isWorkspaceTrusted: true,
        isRemoteEnvironment: false,
        runtimeId: 'vscode-node-extension-host',
        capabilities: [{ command: 'system.getRuntimeInfo', available: true }],
      },
    });

    render(<ToolboxApp client={createClient(execute)} strings={strings} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    await expect(screen.findByText('0.1.0')).resolves.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled();
  });

  it('displays a tool error and supports refresh', async () => {
    const execute = vi.fn<ToolMessageClient['execute']>().mockResolvedValue({
      ok: false,
      error: {
        code: 'internal-error',
        message: 'Unable to load runtime info.',
        retryable: false,
      },
    });

    render(<ToolboxApp client={createClient(execute)} strings={strings} />);
    await expect(screen.findByRole('alert')).resolves.toHaveTextContent(
      'Unable to load runtime info.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
  });
});
