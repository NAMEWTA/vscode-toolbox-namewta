import type { ToolError } from './tool-error-contract';

export type ToolResult<TData> =
  | { readonly ok: true; readonly data: TData }
  | { readonly ok: false; readonly error: ToolError };
