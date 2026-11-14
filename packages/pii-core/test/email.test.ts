import { describe, expect, it } from 'vitest';
import { scanSync } from '../src';

describe('email detector', () => {
  it('finds an email with correct offsets', () => {
    const text = 'Draft a reply to Ahmed about invoice for ahmed@acme.pk please';
    const [f] = scanSync(text);
    expect(f).toMatchObject({ type: 'EMAIL', value: 'ahmed@acme.pk' });
    expect(text.slice(f?.start, f?.end)).toBe('ahmed@acme.pk');
  });

  it('finds several emails', () => {
    expect(scanSync('a@b.co, x.y+tag@sub.example.org')).toHaveLength(2);
  });

  it('ignores text without an email', () => {
    expect(scanSync('meet me @ 5pm at the office')).toEqual([]);
  });

  it('skips user@host in connection strings', () => {
    expect(scanSync('postgres://admin@db.internal.io:5432/app')).toEqual([]);
  });
});
