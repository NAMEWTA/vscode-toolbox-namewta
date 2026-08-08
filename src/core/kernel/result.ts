export type Result<TData, TError> =
  | { readonly ok: true; readonly data: TData }
  | { readonly ok: false; readonly error: TError };

export function ok<TData>(data: TData): Result<TData, never> {
  return { ok: true, data };
}

export function err<TError>(error: TError): Result<never, TError> {
  return { ok: false, error };
}
