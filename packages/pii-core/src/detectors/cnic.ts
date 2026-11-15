import { createPatternDetector } from './pattern';

/**
 * Pakistani CNIC: 5-digit locality, 7-digit serial, 1 gender digit.
 * The first digit is the province code, 1-7.
 */
export const cnicDetector = createPatternDetector({
  id: 'cnic',
  type: 'CNIC',
  patterns: [
    { regex: /\b[1-7]\d{4}-\d{7}-\d\b/g, score: 0.85 },
    // Without dashes it is just 13 digits, so it needs a context word to pass.
    { regex: /\b[1-7]\d{12}\b/g, score: 0.3 },
  ],
  contextWords: ['cnic', 'nic', 'nicop', 'identity card', 'id card', 'national id', 'شناختی'],
});
