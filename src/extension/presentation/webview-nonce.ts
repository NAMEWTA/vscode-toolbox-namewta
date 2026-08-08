import { randomBytes } from 'node:crypto';

export function createWebviewNonce(): string {
  return randomBytes(24).toString('base64url');
}
