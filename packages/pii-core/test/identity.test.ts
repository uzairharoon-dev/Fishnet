import { describe, expect, it } from 'vitest';
import { type EntityType, scanSync } from '../src';

const found = (text: string, type: EntityType) =>
  scanSync(text, { enabledTypes: [type] }).map((f) => f.value);

describe('CNIC', () => {
  it('finds a dashed CNIC with offsets', () => {
    const text = 'My ID is 35202-1234567-1 thanks';
    const [f] = scanSync(text);
    expect(f).toMatchObject({ type: 'CNIC', value: '35202-1234567-1' });
    expect(text.slice(f?.start, f?.end)).toBe('35202-1234567-1');
  });

  it('finds a bare CNIC only with a context word', () => {
    expect(found('CNIC: 3520212345671', 'CNIC')).toEqual(['3520212345671']);
    expect(found('شناختی کارڈ 3520212345671', 'CNIC')).toEqual(['3520212345671']);
    expect(found('tracking 3520212345671', 'CNIC')).toEqual([]);
  });

  it('ignores an invalid province digit and wrong grouping', () => {
    expect(found('95202-1234567-1 and 3520-12345678-1', 'CNIC')).toEqual([]);
  });

  it('wins over phone numbers on the same digits', () => {
    expect(scanSync('35202-1234567-1').map((f) => f.type)).toEqual(['CNIC']);
  });
});

describe('phone', () => {
  it.each([
    ['call me on 0300-1234567', '0300-1234567'],
    ['call me on 0300 1234567', '0300 1234567'],
    ['whatsapp +92 300 1234567', '+92 300 1234567'],
    ['office +92 42 35761234', '+92 42 35761234'],
    ['UK mobile +44 7911 123456', '+44 7911 123456'],
  ])('finds the number in "%s"', (text, value) => {
    expect(found(text, 'PHONE')).toEqual([value]);
  });

  it('reports correct offsets', () => {
    const text = 'ring 0321-7654321 later';
    const [f] = scanSync(text, { enabledTypes: ['PHONE'] });
    expect(text.slice(f?.start, f?.end)).toBe('0321-7654321');
  });

  it('boosts confidence with a context word', () => {
    const [plain] = scanSync('0300-1234567', { enabledTypes: ['PHONE'] });
    const [boosted] = scanSync('phone 0300-1234567', { enabledTypes: ['PHONE'] });
    expect(boosted?.confidence).toBeGreaterThan(plain?.confidence ?? 1);
  });

  it('uses the default region from the context', () => {
    expect(
      scanSync('call 020 7946 0958', { enabledTypes: ['PHONE'], context: { defaultRegion: 'GB' } }),
    ).toHaveLength(1);
  });

  it.each(['released 2024-11-15', 'order #100234 shipped', 'version 1.2.3', 'total 12,500 rupees'])(
    'ignores "%s"',
    (text) => expect(found(text, 'PHONE')).toEqual([]),
  );
});

describe('passport', () => {
  it('finds a passport number with a context word', () => {
    expect(found('Passport no: AB1234567', 'PASSPORT')).toEqual(['AB1234567']);
  });

  it('ignores the same shape without context', () => {
    expect(found('invoice AB1234567 attached', 'PASSPORT')).toEqual([]);
  });

  it('ignores lowercase and too-short ids', () => {
    expect(found('passport ab1234567 or AB12345', 'PASSPORT')).toEqual([]);
  });
});

describe('mixed prompt', () => {
  it('finds every type in one message', () => {
    const text =
      'Email ahmed@acme.pk, call 0300-1234567, CNIC 35202-1234567-1, ' +
      'card 4111 1111 1111 1111, IBAN PK36SCBL0000001123456702, passport AB1234567, host 10.0.0.5';
    expect(scanSync(text).map((f) => f.type)).toEqual([
      'EMAIL',
      'PHONE',
      'CNIC',
      'CREDIT_CARD',
      'IBAN',
      'PASSPORT',
      'IP_ADDRESS',
    ]);
  });
});
