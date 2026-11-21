import { describe, expect, it } from 'vitest';
import { maskValue } from './describe';

describe('maskValue', () => {
  it('keeps the email domain and hides most of the local part', () => {
    expect(maskValue('EMAIL', 'ahmed@acme.pk')).toBe('ah•••@acme.pk');
    expect(maskValue('EMAIL', 'a@b.co')).toBe('a•@b.co');
  });

  it('shows only the ends of long values', () => {
    expect(maskValue('CREDIT_CARD', '4111 1111 1111 1111')).toBe('411••••111');
    expect(maskValue('CNIC', '35202-1234567-1')).toBe('352••••7-1');
  });

  it('hides short values almost entirely', () => {
    expect(maskValue('SECRET_ASSIGNMENT', 'abc12')).toBe('a••••');
  });

  it('describes private keys by size only', () => {
    expect(maskValue('PRIVATE_KEY', '-----BEGIN\nAAAA\nBBBB\n-----END')).toBe('4-line key');
  });

  it('never returns the full value', () => {
    for (const v of ['0300-1234567', 'hunter2!', 'AKIAIOSFODNN7EXAMPLE', '10.0.0.1']) {
      expect(maskValue('SECRET_ASSIGNMENT', v)).not.toContain(v);
    }
  });
});
