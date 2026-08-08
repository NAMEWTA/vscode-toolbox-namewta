import type * as vscode from 'vscode';
import type { VscodeToolboxNamewtaExtensionApi } from '../core/contracts';
import { createExtensionRuntime } from './bootstrap/create-extension-runtime';

export function activate(
  context: vscode.ExtensionContext,
): VscodeToolboxNamewtaExtensionApi {
  const runtime = createExtensionRuntime(context);
  context.subscriptions.push(runtime);
  return runtime.publicApi;
}

export function deactivate(): void {
  // 运行时资源统一由 context.subscriptions 持有并释放。
}
