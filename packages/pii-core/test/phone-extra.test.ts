import { describe, expect, it } from 'vitest';
import { scanSync } from '../src';

const phones = (text: string) => scanSync(text, { enabledTypes: ['PHONE'] }).map((f) => f.value);

describe('phone edge cases', () => {
  it('splits numbers in CSV rows', () => {
    expect(phones('Ali,ali@x.pk,+92 312 0514402,35202-1234567-1')).toEqual(['+92 312 0514402']);
  });

  it('does not report IP addresses as phones', () => {
    expect(phones('server 76.24.200.147')).toEqual([]);
  });

  it('needs context for bare digit runs', () => {
    expect(phones('order 8798833601 shipped')).toEqual([]);
    expect(phones('call 3001234567')).toEqual(['3001234567']);
  });
});
