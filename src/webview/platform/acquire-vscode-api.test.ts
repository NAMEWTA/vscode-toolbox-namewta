// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('getVscodeApi', () => {
  it('acquires and caches the VS Code Webview API', async () => {
    const api = {
      postMessage: vi.fn(),
      getState: vi.fn(),
      setState: vi.fn(),
    };
    const acquire = vi.fn(() => api);
    vi.stubGlobal('acquireVsCodeApi', acquire);
    const { getVscodeApi } = await import('./acquire-vscode-api');

    expect(getVscodeApi()).toBe(api);
    expect(getVscodeApi()).toBe(api);
    expect(acquire).toHaveBeenCalledOnce();
  });
});
