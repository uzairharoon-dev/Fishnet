import { describe, expect, it } from 'vitest';
import { cardIssuer, isValidCard, isValidIBAN, luhn, scanSync } from '../src';

const found = (text: string, type: 'CREDIT_CARD' | 'IBAN') =>
  scanSync(text, { enabledTypes: [type] }).map((f) => f.value);

describe('luhn', () => {
  it.each(['4111111111111111', '79927398713', '0'])('passes %s', (n) => expect(luhn(n)).toBe(true));
  it.each(['4111111111111112', '79927398710', '12ab'])('fails %s', (n) =>
    expect(luhn(n)).toBe(false),
  );
});

describe('card validator', () => {
  it.each([
    ['4111111111111111', 'visa'],
    ['5555555555554444', 'mastercard'],
    ['2223003122003222', 'mastercard'],
    ['378282246310005', 'amex'],
    ['6011111111111117', 'discover'],
    ['3530111333300000', 'jcb'],
  ])('accepts %s as %s', (n, issuer) => {
    expect(isValidCard(n)).toBe(true);
    expect(cardIssuer(n)).toBe(issuer);
  });

  it.each([
    ['4111111111111112', 'fails Luhn'],
    ['0000000000000000', 'repeated digit'],
    ['9999999999999995', 'unknown issuer'],
    ['37828224631000', 'Amex with wrong length'],
  ])('rejects %s (%s)', (n) => expect(isValidCard(n)).toBe(false));
});

describe('credit card detector', () => {
  it.each([
    'pay with 4111 1111 1111 1111 today',
    'pay with 4111-1111-1111-1111 today',
    'pay with 4111111111111111 today',
  ])('finds the card in "%s"', (text) => {
    const [f] = scanSync(text);
    expect(f?.type).toBe('CREDIT_CARD');
    expect(f?.value.replace(/\D/g, '')).toBe('4111111111111111');
    expect(text.slice(f?.start, f?.end)).toBe(f?.value);
  });

  it('finds Amex in 4-6-5 grouping', () => {
    expect(found('amex 3782 822463 10005', 'CREDIT_CARD')).toEqual(['3782 822463 10005']);
  });

  it('does not take a trailing year into the card', () => {
    expect(found('card 4111 1111 1111 1111 2027', 'CREDIT_CARD')).toEqual(['4111 1111 1111 1111']);
  });

  it('ignores 16 random digits that fail Luhn', () => {
    expect(found('order 4111 1111 1111 1112 shipped', 'CREDIT_CARD')).toEqual([]);
  });

  it('ignores mixed separators', () => {
    expect(found('4111 1111-1111 1111', 'CREDIT_CARD')).toEqual([]);
  });
});

describe('IBAN', () => {
  it.each([
    'GB82WEST12345698765432',
    'GB82 WEST 1234 5698 7654 32',
    'DE89 3704 0044 0532 0130 00',
    'PK36SCBL0000001123456702',
    'pk36 scbl 0000 0011 2345 6702',
  ])('accepts %s', (iban) => expect(isValidIBAN(iban)).toBe(true));

  it.each([
    ['GB82WEST12345698765433', 'bad checksum'],
    ['GB82WEST1234569876543', 'wrong length'],
    ['ZZ82WEST12345698765432', 'unknown country'],
  ])('rejects %s (%s)', (iban) => expect(isValidIBAN(iban)).toBe(false));

  it('finds a spaced IBAN without swallowing the next word', () => {
    const text = 'Send to GB82 WEST 1234 5698 7654 32 to finish';
    const [f] = scanSync(text);
    expect(f).toMatchObject({ type: 'IBAN', value: 'GB82 WEST 1234 5698 7654 32' });
    expect(text.slice(f?.start, f?.end)).toBe(f?.value);
  });

  it('finds a compact PK IBAN', () => {
    expect(found('IBAN: PK36SCBL0000001123456702.', 'IBAN')).toEqual(['PK36SCBL0000001123456702']);
  });

  it('ignores an IBAN-shaped string with a bad checksum', () => {
    expect(found('ref GB82WEST12345698765433', 'IBAN')).toEqual([]);
  });

  it('ignores an IBAN glued to more characters', () => {
    expect(found('GB82WEST12345698765432X', 'IBAN')).toEqual([]);
  });
});
