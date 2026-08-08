import { describe, expect, it } from 'vitest';
import { ApplicationError } from '../kernel/application-error';
import type { ToolExecutionContext } from './tool-execution-context';
import type { ToolHandler } from './tool-handler';
import { ToolRegistry } from './tool-registry';

const context: ToolExecutionContext = {
  signal: new AbortController().signal,
  requestId: 'test-request',
  source: 'extension-api',
  logger: {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
};

const handler: ToolHandler<'system.getRuntimeInfo'> = {
  command: 'system.getRuntimeInfo',
  execute: () =>
    Promise.resolve({
      apiVersion: 1,
      extensionVersion: '0.1.0',
      vscodeVersion: '1.100.0',
      nodeVersion: '20.0.0',
      uiLanguage: 'en',
      isWorkspaceTrusted: true,
      isRemoteEnvironment: false,
      runtimeId: 'vscode-node-extension-host',
      capabilities: [],
    }),
};

describe('ToolRegistry', () => {
  it('registers and executes a command handler', async () => {
    const registry = new ToolRegistry();
    registry.register(handler);

    await expect(
      registry.execute('system.getRuntimeInfo', {}, context),
    ).resolves.toMatchObject({ extensionVersion: '0.1.0' });
  });

  it('rejects duplicate command registrations', () => {
    const registry = new ToolRegistry();
    registry.register(handler);

    expect(() => registry.register(handler)).toThrow(ApplicationError);
  });

  it('throws a structured error for an unregistered command', async () => {
    const registry = new ToolRegistry();

    await expect(
      registry.execute('system.getRuntimeInfo', {}, context),
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('lists registered capabilities in stable order', () => {
    const registry = new ToolRegistry();
    registry.register(handler);

    expect(registry.getCapabilities()).toEqual([
      { command: 'system.getRuntimeInfo', available: true },
    ]);
  });
});
