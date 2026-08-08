import * as vscode from 'vscode';
import type {
  RuntimeInfoPort,
  RuntimeInfoSnapshot,
} from '../../core/domains/system-info/public-api';

export class VscodeRuntimeInfoAdapter implements RuntimeInfoPort {
  public constructor(private readonly extensionVersion: string) {}

  public readRuntimeInfo(): RuntimeInfoSnapshot {
    return {
      extensionVersion: this.extensionVersion,
      vscodeVersion: vscode.version,
      nodeVersion: process.versions.node,
      uiLanguage: vscode.env.language,
      isWorkspaceTrusted: vscode.workspace.isTrusted,
      isRemoteEnvironment: vscode.env.remoteName !== undefined,
      runtimeId: 'vscode-node-extension-host',
    };
  }
}
