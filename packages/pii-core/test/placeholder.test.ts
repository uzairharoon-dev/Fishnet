import { describe, expect, it } from 'vitest';
import { normalizeValue, PlaceholderMap, redact, restore, scanSync } from '../src';

const redactAll = (text: string, map = new PlaceholderMap()) => redact(text, scanSync(text), map);

describe('normalizeValue', () => {
  it('lowercases emails', () => {
    expect(normalizeValue('EMAIL', 'Ahmed@ACME.pk')).toBe('ahmed@acme.pk');
  });

  it('puts local and international phones in one form', () => {
    expect(normalizeValue('PHONE', '0300-1234567')).toBe(
      normalizeValue('PHONE', '+92 300 1234567'),
    );
  });

  it('drops separators in cards and CNICs', () => {
    expect(normalizeValue('CREDIT_CARD', '4111 1111-1111 1111')).toBe('4111111111111111');
    expect(normalizeValue('CNIC', '35202-1234567-1')).toBe('3520212345671');
  });
});

describe('PlaceholderMap', () => {
  it('numbers tokens per type', () => {
    const map = new PlaceholderMap();
    expect(map.getOrCreate('EMAIL', 'a@b.co')).toBe('[EMAIL_1]');
    expect(map.getOrCreate('EMAIL', 'c@d.co')).toBe('[EMAIL_2]');
    expect(map.getOrCreate('PHONE', '0300-1234567')).toBe('[PHONE_1]');
  });

  it('reuses the token for the same normalized value', () => {
    const map = new PlaceholderMap();
    const a = map.getOrCreate('EMAIL', 'Ahmed@acme.pk');
    expect(map.getOrCreate('EMAIL', 'ahmed@ACME.pk')).toBe(a);
    expect(map.size).toBe(1);
  });

  it('uses short labels', () => {
    const map = new PlaceholderMap();
    expect(map.getOrCreate('CREDIT_CARD', '4111111111111111')).toBe('[CARD_1]');
    expect(map.getOrCreate('SECRET_ASSIGNMENT', 'hunter2')).toBe('[SECRET_1]');
    expect(map.getOrCreate('IP_ADDRESS', '10.0.0.1')).toBe('[IP_1]');
  });

  it('skips tokens the caller marks as taken', () => {
    const map = new PlaceholderMap();
    expect(map.getOrCreate('EMAIL', 'a@b.co', (t) => t === '[EMAIL_1]')).toBe('[EMAIL_2]');
  });

  it('survives a JSON round trip and keeps counting', () => {
    const map = new PlaceholderMap();
    map.getOrCreate('EMAIL', 'a@b.co');
    map.getOrCreate('EMAIL', 'c@d.co');
    const copy = PlaceholderMap.fromJSON(JSON.parse(JSON.stringify(map)));
    expect(copy.lookup('[EMAIL_2]')).toBe('c@d.co');
    expect(copy.getOrCreate('EMAIL', 'a@b.co')).toBe('[EMAIL_1]');
    expect(copy.getOrCreate('EMAIL', 'e@f.co')).toBe('[EMAIL_3]');
  });
});

describe('redact', () => {
  it('replaces findings with tokens', () => {
    const { text, replacements } = redactAll(
      'Reply to ahmed@acme.pk, CNIC 35202-1234567-1, cc ahmed@acme.pk',
    );
    expect(text).toBe('Reply to [EMAIL_1], CNIC [CNIC_1], cc [EMAIL_1]');
    expect(replacements.map((r) => r.token)).toEqual(['[EMAIL_1]', '[CNIC_1]', '[EMAIL_1]']);
  });

  it('keeps one map across messages in a conversation', () => {
    const map = new PlaceholderMap();
    redactAll('mail a@b.co', map);
    expect(redactAll('now mail c@d.co and a@b.co', map).text).toBe(
      'now mail [EMAIL_2] and [EMAIL_1]',
    );
  });

  it('does not reuse a token that is already in the text', () => {
    expect(redactAll('earlier [EMAIL_1], now a@b.co').text).toBe(
      'earlier [EMAIL_1], now [EMAIL_2]',
    );
  });

  it('returns the text unchanged with no findings', () => {
    expect(redactAll('nothing here').text).toBe('nothing here');
  });
});

describe('restore', () => {
  const map = new PlaceholderMap();
  map.getOrCreate('EMAIL', 'ahmed@acme.pk');
  map.getOrCreate('PHONE', '0300-1234567');

  it('puts real values back with offsets in the output', () => {
    const { text, restored } = restore('Email [EMAIL_1] or call [PHONE_1].', map);
    expect(text).toBe('Email ahmed@acme.pk or call 0300-1234567.');
    for (const r of restored) {
      expect(text.slice(r.start, r.end)).toBe(map.lookup(r.token));
    }
  });

  it('accepts variants a model may write', () => {
    expect(restore('[Email_1], [EMAIL 1], [email-1]', map).text).toBe(
      'ahmed@acme.pk, ahmed@acme.pk, ahmed@acme.pk',
    );
  });

  it('leaves unknown and made-up tokens alone', () => {
    expect(restore('[EMAIL_7] [FOO_1] [link]', map).text).toBe('[EMAIL_7] [FOO_1] [link]');
  });

  it('round-trips redacted prompts', () => {
    const prompts = [
      'Draft a reply to ahmed@acme.pk about card 4111 1111 1111 1111',
      'DB_PASSWORD=s3cr3t-Pa55\nHOST=10.0.0.5',
      'Customer CNIC 35202-1234567-1, phone +92 300 1234567, IBAN PK36SCBL0000001123456702',
      'Same email twice: a@b.co and a@b.co',
    ];
    for (const prompt of prompts) {
      const m = new PlaceholderMap();
      expect(restore(redactAll(prompt, m).text, m).text).toBe(prompt);
    }
  });

  it('restores spelling variants to the first spelling seen', () => {
    const m = new PlaceholderMap();
    expect(restore(redactAll('A@b.co and a@b.co', m).text, m).text).toBe('A@b.co and A@b.co');
  });
});
