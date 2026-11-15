import { createPatternDetector } from '../pattern';

function decodeBase64Url(s: string): string | undefined {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    return atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  } catch {
    return undefined;
  }
}

/** True if the first segment decodes to a JSON object with an "alg" field. */
export function hasJwtHeader(token: string): boolean {
  const json = decodeBase64Url(token.split('.')[0] ?? '');
  if (!json) return false;
  try {
    const header: unknown = JSON.parse(json);
    return typeof header === 'object' && header !== null && 'alg' in header;
  } catch {
    return false;
  }
}

export const jwtDetector = createPatternDetector({
  id: 'jwt',
  type: 'JWT',
  // Header and payload are base64url JSON, so both start with "eyJ" ('{"').
  patterns: [{ regex: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, score: 0.95 }],
  validate: hasJwtHeader,
});
