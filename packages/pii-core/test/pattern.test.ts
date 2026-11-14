import { describe, expect, it } from 'vitest';
import { CONTEXT_BOOST, createPatternDetector, hasContextBefore } from '../src';

describe('hasContextBefore', () => {
  it('matches whole words case-insensitively', () => {
    expect(hasContextBefore('My CNIC is 12345', 11, ['cnic'])).toBe(true);
  });

  it('does not match inside another word', () => {
    expect(hasContextBefore('the clinic number 12345', 18, ['nic'])).toBe(false);
  });

  it('only looks inside the window', () => {
    const text = `cnic ${'x '.repeat(40)}12345`;
    expect(hasContextBefore(text, text.indexOf('12345'), ['cnic'])).toBe(false);
  });
});

describe('createPatternDetector', () => {
  it('rejects patterns without the g flag', () => {
    expect(() =>
      createPatternDetector({ id: 'bad', type: 'CUSTOM', patterns: [{ regex: /x/, score: 1 }] }),
    ).toThrow(/g flag/);
  });

  it('drops matches that fail validation and uses numeric scores', () => {
    const d = createPatternDetector({
      id: 'digits',
      type: 'CUSTOM',
      patterns: [{ regex: /\d+/g, score: 0.5 }],
      validate: (m) => (m.length > 2 ? 0.9 : false),
    });
    const found = d.detect('1 22 333', {});
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ value: '333', confidence: 0.9, start: 5, end: 8 });
  });

  it('applies the context boost', () => {
    const d = createPatternDetector({
      id: 'code',
      type: 'CUSTOM',
      patterns: [{ regex: /\b\d{4}\b/g, score: 0.3 }],
      contextWords: ['pin'],
    });
    expect(d.detect('pin 1234', {})[0]?.confidence).toBeCloseTo(0.3 + CONTEXT_BOOST);
    expect(d.detect('year 1234', {})[0]?.confidence).toBe(0.3);
  });

  it('honours invalidate', () => {
    const d = createPatternDetector({
      id: 'word',
      type: 'CUSTOM',
      patterns: [{ regex: /secret/g, score: 1 }],
      invalidate: (_m, text, start) => text[start - 1] === '#',
    });
    expect(d.detect('#secret secret', {}).map((f) => f.start)).toEqual([8]);
  });
});
