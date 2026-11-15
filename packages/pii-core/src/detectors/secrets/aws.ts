import { createPatternDetector } from '../pattern';

export const awsAccessKeyDetector = createPatternDetector({
  id: 'aws-access-key',
  type: 'AWS_ACCESS_KEY',
  // AKIA = long-term user key, ASIA = temporary STS key.
  patterns: [{ regex: /\b(?:AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16}\b/g, score: 0.95 }],
});

/**
 * Secret keys are 40 base64 characters with no prefix, so on their own they look
 * like any other random string. Reported only next to an AWS context word.
 */
export const awsSecretKeyDetector = createPatternDetector({
  id: 'aws-secret-key',
  type: 'AWS_SECRET_KEY',
  patterns: [{ regex: /(?<![A-Za-z0-9/+])[A-Za-z0-9/+]{40}(?![A-Za-z0-9/+=])/g, score: 0.3 }],
  // Lowercase hex (git SHAs) and other single-alphabet strings are not secrets.
  validate: (m) => /[A-Z]/.test(m) && /[a-z]/.test(m) && /\d/.test(m),
  // Large boost so it beats the generic SECRET_ASSIGNMENT on AWS_SECRET_ACCESS_KEY=...
  contextBoost: 0.65,
  contextWords: [
    'aws_secret_access_key',
    'aws_secret_key',
    'secret_access_key',
    'secretaccesskey',
    'aws secret',
    'secret access key',
  ],
});
