export type WebviewStrings = {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly runtimeStatusTitle: string;
  readonly refresh: string;
  readonly refreshing: string;
  readonly loadingRuntimeInfo: string;
  readonly extensionLabel: string;
  readonly apiLabel: string;
  readonly vscodeLabel: string;
  readonly nodeLabel: string;
  readonly languageLabel: string;
  readonly workspaceLabel: string;
  readonly environmentLabel: string;
  readonly runtimeLabel: string;
  readonly toolsLabel: string;
  readonly trusted: string;
  readonly restricted: string;
  readonly remote: string;
  readonly local: string;
  readonly unknownError: string;
};

export type WebviewBootstrap = {
  readonly version: 1;
  readonly language: string;
  readonly requestTimeoutMs: number;
  readonly strings: WebviewStrings;
};

const WEBVIEW_STRING_KEYS = [
  'eyebrow',
  'title',
  'description',
  'runtimeStatusTitle',
  'refresh',
  'refreshing',
  'loadingRuntimeInfo',
  'extensionLabel',
  'apiLabel',
  'vscodeLabel',
  'nodeLabel',
  'languageLabel',
  'workspaceLabel',
  'environmentLabel',
  'runtimeLabel',
  'toolsLabel',
  'trusted',
  'restricted',
  'remote',
  'local',
  'unknownError',
] as const satisfies readonly (keyof WebviewStrings)[];

export function isWebviewBootstrap(value: unknown): value is WebviewBootstrap {
  if (!isRecord(value) || value.version !== 1) {
    return false;
  }

  return (
    typeof value.language === 'string' &&
    value.language.length > 0 &&
    isWebviewTimeout(value.requestTimeoutMs) &&
    hasWebviewStrings(value.strings)
  );
}

function hasWebviewStrings(value: unknown): value is WebviewStrings {
  if (!isRecord(value)) {
    return false;
  }

  return WEBVIEW_STRING_KEYS.every(
    (key) => typeof value[key] === 'string' && value[key].length > 0,
  );
}

function isWebviewTimeout(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 1_000 &&
    value <= 120_000
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
