import { isValidIPv4, isValidIPv6 } from '../validators/ip';
import { createPatternDetector } from './pattern';

const IP_CONTEXT = ['ip', 'ip address', 'host', 'server', 'ssh', 'connect', 'address', 'vpn'];

export const ipv4Detector = createPatternDetector({
  id: 'ipv4',
  type: 'IP_ADDRESS',
  // Lookarounds stop matches inside longer dotted numbers like 1.2.3.4.5.
  patterns: [{ regex: /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.]*\d)/g, score: 0.6 }],
  validate: isValidIPv4,
  contextWords: IP_CONTEXT,
  // "v1.2.3.4" and "version 1.2.3.4" are version strings, not addresses.
  invalidate: (_match, text, start) =>
    /(?:\bv|version\s*)$/i.test(text.slice(Math.max(0, start - 10), start)),
});

export const ipv6Detector = createPatternDetector({
  id: 'ipv6',
  type: 'IP_ADDRESS',
  patterns: [{ regex: /(?<![\w:])(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(?![\w:])/gi, score: 0.8 }],
  validate: isValidIPv6,
  contextWords: IP_CONTEXT,
});
