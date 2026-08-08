import { describe, expect, it } from 'vitest';
import { assertNever } from './assert-never';

describe('assertNever', () => {
  it('throws with context for an impossible runtime value', () => {
    const invoke = (): void => {
      Reflect.apply(assertNever, undefined, ['unexpected', 'test switch']);
    };
    expect(invoke).toThrow('Unexpected value in test switch: unexpected');
  });
});
