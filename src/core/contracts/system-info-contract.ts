export type RuntimeCapability = {
  readonly command: string;
  readonly available: boolean;
  readonly reason?: string;
};

export type RuntimeInfoSnapshot = {
  readonly extensionVersion: string;
  readonly vscodeVersion: string;
  readonly nodeVersion: string;
  readonly uiLanguage: string;
  readonly isWorkspaceTrusted: boolean;
  readonly isRemoteEnvironment: boolean;
  readonly runtimeId: 'vscode-node-extension-host';
};

export type RuntimeInfo = RuntimeInfoSnapshot & {
  readonly apiVersion: 1;
  readonly capabilities: readonly RuntimeCapability[];
};
