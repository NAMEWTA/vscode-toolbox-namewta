import * as vscode from 'vscode';
import type { ClipboardPort } from '../../core/domains/copy-reference/public-api';

export class VscodeClipboardAdapter implements ClipboardPort {
  public writeText(text: string): Promise<void> {
    return Promise.resolve(vscode.env.clipboard.writeText(text));
  }
}
