import { describe, expect, it } from 'vitest';
import { BADGE_COLORS, badgeFor, isFishnetMessage } from './messages';

describe('badgeFor', () => {
  it('is empty with no findings', () => {
    expect(badgeFor(0, false).text).toBe('');
  });

  it('shows the count, capped at 99+', () => {
    expect(badgeFor(3, false)).toEqual({ text: '3', color: BADGE_COLORS.medium });
    expect(badgeFor(120, true)).toEqual({ text: '99+', color: BADGE_COLORS.high });
  });
});

describe('isFishnetMessage', () => {
  it('accepts only known messages', () => {
    expect(isFishnetMessage({ type: 'fishnet:status' })).toBe(true);
    expect(isFishnetMessage({ type: 'fishnet:findings', count: 1, high: false })).toBe(true);
    expect(isFishnetMessage({ type: 'other' })).toBe(false);
    expect(isFishnetMessage(null)).toBe(false);
    expect(isFishnetMessage('fishnet:status')).toBe(false);
  });
});
