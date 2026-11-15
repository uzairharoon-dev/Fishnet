import { luhn } from './luhn';

/** Issuer prefix and allowed lengths. Ranges are inclusive and compared on the leading digits. */
const ISSUERS: { name: string; prefixes: [number, number][]; lengths: number[] }[] = [
  { name: 'visa', prefixes: [[4, 4]], lengths: [13, 16, 19] },
  {
    name: 'mastercard',
    prefixes: [
      [51, 55],
      [2221, 2720],
    ],
    lengths: [16],
  },
  {
    name: 'amex',
    prefixes: [
      [34, 34],
      [37, 37],
    ],
    lengths: [15],
  },
  {
    name: 'discover',
    prefixes: [
      [6011, 6011],
      [644, 649],
      [65, 65],
    ],
    lengths: [16, 17, 18, 19],
  },
  { name: 'jcb', prefixes: [[3528, 3589]], lengths: [16, 17, 18, 19] },
  {
    name: 'diners',
    prefixes: [
      [300, 305],
      [36, 36],
      [38, 39],
    ],
    lengths: [14, 15, 16, 17, 18, 19],
  },
  { name: 'unionpay', prefixes: [[62, 62]], lengths: [16, 17, 18, 19] },
];

export function cardIssuer(digits: string): string | undefined {
  return ISSUERS.find(
    ({ prefixes, lengths }) =>
      lengths.includes(digits.length) &&
      prefixes.some(([lo, hi]) => {
        const n = Number(digits.slice(0, String(lo).length));
        return n >= lo && n <= hi;
      }),
  )?.name;
}

/** Digits only, known issuer prefix and length, passes Luhn, not one repeated digit. */
export function isValidCard(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return cardIssuer(digits) !== undefined && luhn(digits);
}
