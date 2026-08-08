import { describe, expect, it } from 'vitest';
import type { ToolExecutionContext } from '../../orchestration/tool-execution-context';
import { SystemInfoHandler } from './system-info-handler';
import type { RuntimeInfoPort } from './system-info-model';

const context: ToolExecutionContext = {
  signal: new AbortController().signal,
  requestId: 'system-info-test',
  source: 'extension-api',
  logger: {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
};

describe('SystemInfoHandler', () => {
  it('maps the runtime port snapshot and registered capabilities', async () => {
    const port: RuntimeInfoPort = {
      readRuntimeInfo: () => ({
        extensionVersion: '0.1.0',
        vscodeVersion: '1.100.0',
        nodeVersion: '20.0.0',
        uiLanguage: 'zh-cn',
        isWorkspaceTrusted: false,
        isRemoteEnvironment: true,
        runtimeId: 'vscode-node-extension-host',
      }),
    };
    const handler = new SystemInfoHandler(port, () => [
      { command: 'system.getRuntimeInfo', available: true },
    ]);

    const result = await handler.execute({}, context);

    expect(result).toEqual({
      apiVersion: 1,
      extensionVersion: '0.1.0',
      vscodeVersion: '1.100.0',
      nodeVersion: '20.0.0',
      uiLanguage: 'zh-cn',
      isWorkspaceTrusted: false,
      isRemoteEnvironment: true,
      runtimeId: 'vscode-node-extension-host',
      capabilities: [{ command: 'system.getRuntimeInfo', available: true }],
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
