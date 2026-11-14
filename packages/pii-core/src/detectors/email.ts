import { createPatternDetector } from './pattern';

export const emailDetector = createPatternDetector({
  id: 'email',
  type: 'EMAIL',
  patterns: [
    {
      regex: /\b[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,24}\b/g,
      score: 0.95,
    },
  ],
  // Skip user@host in connection strings like postgres://admin@db.io.
  invalidate: (match, text, start) => {
    const before = text.slice(Math.max(0, start - 64), start);
    return /[a-z][a-z0-9+.-]*:\/\/[^\s]*$/i.test(before + match.split('@')[0]);
  },
});
