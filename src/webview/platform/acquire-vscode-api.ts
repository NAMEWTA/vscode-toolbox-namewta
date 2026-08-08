export type VscodeApi = {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

declare function acquireVsCodeApi(): VscodeApi;

let cachedApi: VscodeApi | undefined;

export function getVscodeApi(): VscodeApi {
  cachedApi ??= acquireVsCodeApi();
  return cachedApi;
}
