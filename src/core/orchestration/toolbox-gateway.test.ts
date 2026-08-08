import { describe, expect, it, vi } from 'vitest';
import { ApplicationError } from '../kernel/application-error';
import type { ToolLogger } from './tool-execution-context';
import type { ToolHandler } from './tool-handler';
import { ToolRegistry } from './tool-registry';
import { DefaultToolboxGateway } from './toolbox-gateway';

function createLogger(): ToolLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createGateway(
  execute: ToolHandler<'system.getRuntimeInfo'>['execute'],
): DefaultToolboxGateway {
  const registry = new ToolRegistry();
  registry.register({ command: 'system.getRuntimeInfo', execute });
  return new DefaultToolboxGateway(registry, createLogger());
}

describe('DefaultToolboxGateway', () => {
  it('returns a successful result', async () => {
    const gateway = createGateway(() =>
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
    );

    await expect(gateway.execute('system.getRuntimeInfo', {})).resolves.toMatchObject({
      ok: true,
    });
  });

  it('maps ApplicationError to ToolError', async () => {
    const gateway = createGateway(() =>
      Promise.reject(
        new ApplicationError('Unavailable', {
          code: 'capability-unavailable',
          retryable: true,
        }),
      ),
    );

    await expect(gateway.execute('system.getRuntimeInfo', {})).resolves.toEqual({
      ok: false,
      error: {
        code: 'capability-unavailable',
        message: 'Unavailable',
        retryable: true,
      },
    });
  });

  it('maps unknown errors without exposing internals', async () => {
    const gateway = createGateway(() => Promise.reject(new Error('secret details')));

    const result = await gateway.execute('system.getRuntimeInfo', {});

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'internal-error',
        message: 'An unexpected error occurred while executing the tool.',
        retryable: false,
      },
    });
  });

  it('returns cancelled before invoking the handler', async () => {
    const execute = vi.fn<ToolHandler<'system.getRuntimeInfo'>['execute']>();
    const gateway = createGateway(execute);
    const controller = new AbortController();
    controller.abort();

    const result = await gateway.execute(
      'system.getRuntimeInfo',
      {},
      {
        signal: controller.signal,
      },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'cancelled' },
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
