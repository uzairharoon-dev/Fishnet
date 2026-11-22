import { scanSync } from '@fishnet/pii-core';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  enabledTypes,
  isTypeEnabled,
  modeFor,
  normalizeSettings,
  withSiteMode,
  withTypeEnabled,
} from './schema';

describe('settings', () => {
  it('defaults to redact everywhere with every detector on', () => {
    expect(modeFor(DEFAULT_SETTINGS, 'chatgpt')).toBe('redact');
    expect(enabledTypes(DEFAULT_SETTINGS)).toContain('EMAIL');
    expect(enabledTypes(DEFAULT_SETTINGS)).toHaveLength(13);
  });

  it('normalizes broken or unknown storage values', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('junk')).toEqual(DEFAULT_SETTINGS);
    expect(
      normalizeSettings({
        siteModes: { chatgpt: 'block', gemini: 'off', other: 'nope' },
        disabledTypes: ['EMAIL', 'EMAIL', 'NOT_A_TYPE', 42, 'PERSON'],
      }),
    ).toEqual({ siteModes: { chatgpt: 'block' }, disabledTypes: ['EMAIL'] });
    expect(normalizeSettings({ siteModes: { chatgpt: 'loud' } }).siteModes).toEqual({});
  });

  it('updates without mutating', () => {
    const s = withSiteMode(DEFAULT_SETTINGS, 'chatgpt', 'warn');
    expect(modeFor(s, 'chatgpt')).toBe('warn');
    expect(DEFAULT_SETTINGS.siteModes).toEqual({});

    const off = withTypeEnabled(s, 'PHONE', false);
    expect(isTypeEnabled(off, 'PHONE')).toBe(false);
    expect(
      withTypeEnabled(withTypeEnabled(off, 'PHONE', false), 'PHONE', false).disabledTypes,
    ).toEqual(['PHONE']);
    expect(isTypeEnabled(withTypeEnabled(off, 'PHONE', true), 'PHONE')).toBe(true);
    expect(s.disabledTypes).toEqual([]);
  });

  it('a disabled detector does not hide what other detectors find', () => {
    const settings = withTypeEnabled(DEFAULT_SETTINGS, 'EMAIL', false);
    const found = scanSync('mail ahmed@acme.pk or call 0300-1234567', {
      enabledTypes: enabledTypes(settings),
    });
    expect(found.map((f) => f.type)).toEqual(['PHONE']);
  });
});
