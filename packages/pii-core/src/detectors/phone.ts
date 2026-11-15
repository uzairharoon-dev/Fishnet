import { type CountryCode, findPhoneNumbersInText } from 'libphonenumber-js/min';
import { CONTEXT_BOOST, hasContextBefore } from '../context';
import type { Detector, Finding } from '../types';

const DEFAULT_REGION: CountryCode = 'PK';
const CONTEXT = ['phone', 'call', 'mobile', 'cell', 'whatsapp', 'contact', 'tel', 'number', 'sms'];
const SCORE = 0.75;
/**
 * Without a "+", a leading trunk "0" or brackets, a number is usually an order id or
 * reference ("order 8798833601", "INV-2026-00042"). Those need a context word.
 */
const BARE_SCORE = 0.4;

export const phoneDetector: Detector = {
  id: 'phone',
  types: ['PHONE'],
  detect(text, ctx) {
    const defaultCountry = (ctx.defaultRegion ?? DEFAULT_REGION) as CountryCode;
    // libphonenumber reads "0300-1234567,35202-..." in CSV rows as one candidate.
    // Separators become line breaks, which end a candidate. The length is
    // unchanged, so offsets still match `text`.
    const parseable = text.replace(/[,;|]/g, '\n');
    const findings: Finding[] = [];
    for (const { startsAt, endsAt } of findPhoneNumbersInText(parseable, { defaultCountry })) {
      const value = text.slice(startsAt, endsAt);
      // Dotted quads are IP addresses.
      if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) continue;

      const base = /^[+0(]/.test(value) ? SCORE : BARE_SCORE;
      findings.push({
        type: 'PHONE',
        start: startsAt,
        end: endsAt,
        value,
        confidence: Math.min(
          1,
          base + (hasContextBefore(text, startsAt, CONTEXT) ? CONTEXT_BOOST : 0),
        ),
        detectorId: 'phone',
      });
    }
    return findings;
  },
};
