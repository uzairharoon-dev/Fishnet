import { createPatternDetector } from '../pattern';

const LABEL = String.raw`-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----`;
const END = String.raw`-----END (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----`;

export const privateKeyDetector = createPatternDetector({
  id: 'private-key',
  type: 'PRIVATE_KEY',
  patterns: [
    { regex: new RegExp(`${LABEL}[\\s\\S]*?${END}`, 'g'), score: 1 },
    // A truncated paste with no END line: everything after BEGIN is key material.
    // Lower score so a complete block wins when both match.
    { regex: new RegExp(`${LABEL}[\\s\\S]*$`, 'g'), score: 0.9 },
  ],
});
