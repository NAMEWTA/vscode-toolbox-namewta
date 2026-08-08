import { describe, expect, it } from 'vitest';
import { ApplicationError } from './application-error';

describe('ApplicationError', () => {
  it('preserves structured metadata and cause', () => {
    const cause = new Error('root cause');
    const error = new ApplicationError('Operation failed.', {
      code: 'timeout',
      retryable: true,
      details: { timeoutMs: 1000 },
      cause,
    });

    expect(error).toMatchObject({
      name: 'ApplicationError',
      message: 'Operation failed.',
      code: 'timeout',
      retryable: true,
      details: { timeoutMs: 1000 },
      cause,
    });
  });

  it('defaults retryability to false', () => {
    const error = new ApplicationError('Invalid.', { code: 'invalid-input' });
    expect(error.retryable).toBe(false);
  });
});
