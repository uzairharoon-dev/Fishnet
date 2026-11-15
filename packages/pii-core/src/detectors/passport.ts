import { createPatternDetector } from './pattern';

/**
 * Passport numbers have no checksum and look like many other IDs
 * (PK: two letters + 7 digits, e.g. AB1234567). Reported only with a context word.
 */
export const passportDetector = createPatternDetector({
  id: 'passport',
  type: 'PASSPORT',
  patterns: [{ regex: /\b[A-Z]{1,2}\d{6,8}\b/g, score: 0.3 }],
  contextWords: ['passport', 'passport no', 'passport number', 'travel document', 'پاسپورٹ'],
});
