import { isValidCard } from '../validators/card';
import { createPatternDetector } from './pattern';

export const creditCardDetector = createPatternDetector({
  id: 'credit-card',
  type: 'CREDIT_CARD',
  patterns: [
    // 4-4-4-4 with an optional 1-3 digit tail. The separator must be the same throughout.
    { regex: /\b\d{4}([ -]?)\d{4}\1\d{4}\1\d{4}(?:\1\d{1,3})?\b/g, score: 0.9 },
    // Amex style 4-6-5 and Diners 4-6-4.
    { regex: /\b\d{4}([ -])\d{6}\1\d{4,5}\b/g, score: 0.9 },
    // Unbroken 13-19 digits.
    { regex: /\b\d{13,19}\b/g, score: 0.9 },
  ],
  validate: (match) => isValidCard(match.replace(/[ -]/g, '')),
  contextWords: ['card', 'credit', 'debit', 'visa', 'mastercard', 'amex', 'cc', 'payment'],
});
