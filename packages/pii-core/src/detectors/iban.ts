import { CONTEXT_BOOST, hasContextBefore } from '../context';
import type { Detector, Finding } from '../types';
import { IBAN_LENGTHS, ibanChecksumOk } from '../validators/iban';

const START = /\b([A-Za-z]{2})(\d{2})/g;
const CONTEXT = ['iban', 'account', 'bank', 'transfer', 'a/c'];
const SCORE = 0.85;

/**
 * Not a plain pattern detector: IBANs are often written in groups of four with
 * spaces, so a greedy regex can swallow the next word. Instead read exactly as
 * many characters as the country's IBAN length, skipping single spaces.
 */
export const ibanDetector: Detector = {
  id: 'iban',
  types: ['IBAN'],
  detect(text) {
    const findings: Finding[] = [];
    for (const m of text.matchAll(START)) {
      const country = m[1]?.toUpperCase() ?? '';
      const length = IBAN_LENGTHS[country];
      if (!length) continue;

      let compact = '';
      let i = m.index;
      while (i < text.length && compact.length < length) {
        const ch = text[i] ?? '';
        if (/[A-Za-z0-9]/.test(ch)) {
          compact += ch.toUpperCase();
        } else if (ch === ' ' && /[A-Za-z0-9]/.test(text[i + 1] ?? '') && compact.length >= 4) {
          // single space between groups
        } else {
          break;
        }
        i++;
      }
      if (compact.length !== length || /[A-Za-z0-9]/.test(text[i] ?? '')) continue;
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(compact) || !ibanChecksumOk(compact)) continue;

      const start = m.index;
      findings.push({
        type: 'IBAN',
        start,
        end: i,
        value: text.slice(start, i),
        confidence: Math.min(
          1,
          SCORE + (hasContextBefore(text, start, CONTEXT) ? CONTEXT_BOOST : 0),
        ),
        detectorId: 'iban',
      });
    }
    return findings;
  },
};
