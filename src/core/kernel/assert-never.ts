export function assertNever(value: never, context: string): never {
  throw new Error(`Unexpected value in ${context}: ${String(value)}`);
}
