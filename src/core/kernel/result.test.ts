import { describe, expect, it } from 'vitest';
import { err, ok } from './result';

describe('Result factories', () => {
  it('creates successful and failed discriminated results', () => {
    expect(ok('value')).toEqual({ ok: true, data: 'value' });
    expect(err('failure')).toEqual({ ok: false, error: 'failure' });
  });
});
