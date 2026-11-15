import { type CountryCode, findPhoneNumbersInText } from 'libphonenumber-js/min';
import { CONTEXT_BOOST, hasContextBefore } from '../context';
import type { Detector, Finding } from '../types';

const DEFAULT_REGION: CountryCode = 'PK';
const CONTEXT = ['phone', 'call', 'mobile', 'cell', 'whatsapp', 'contact', 'tel', 'number', 'sms'];
const SCORE = 0.75;

export const phoneDetector: Detector = {
  id: 'phone',
  types: ['PHONE'],
  detect(text, ctx) {
    const defaultCountry = (ctx.defaultRegion ?? DEFAULT_REGION) as CountryCode;
    const findings: Finding[] = [];
    for (const { startsAt, endsAt } of findPhoneNumbersInText(text, { defaultCountry })) {
      findings.push({
        type: 'PHONE',
        start: startsAt,
        end: endsAt,
        value: text.slice(startsAt, endsAt),
        confidence: Math.min(
          1,
          SCORE + (hasContextBefore(text, startsAt, CONTEXT) ? CONTEXT_BOOST : 0),
        ),
        detectorId: 'phone',
      });
    }
    return findings;
  },
};
