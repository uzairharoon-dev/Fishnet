import type { Detector, Finding } from '../../types';

const KEY = String.raw`[A-Za-z0-9_.-]*(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|auth[_-]?key|credentials?)[A-Za-z0-9_.-]*`;

/**
 * KEY=value, KEY: value, "key": "value" where the key names a secret.
 * The `d` flag gives the offsets of the value group, so only the value is reported.
 */
const ASSIGNMENT = new RegExp(
  String.raw`(?<![A-Za-z0-9_.-])(?<kq>["']?)(?<key>${KEY})\k<kq>\s*[:=]\s*(?<q>["']?)(?<value>[^\s"'\x60,;()<>{}]{3,})\k<q>(?=[\s,;)}\]]|$)`,
  'gimd',
);

const PLACEHOLDER =
  /^(?:x+|\*+|\.+|changeme|change_me|example|placeholder|null|none|nil|undefined|true|false|redacted|secret|password|token|todo|tbd|your[_-].*)$/i;
const SHORT_NUMBER = /^\d{1,7}$/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const MEMBER_ACCESS = /^[A-Za-z_$][\w$]*(?:\.[\w$]+)+$/;

export const secretAssignmentDetector: Detector = {
  id: 'secret-assignment',
  types: ['SECRET_ASSIGNMENT'],
  detect(text) {
    const findings: Finding[] = [];
    for (const m of text.matchAll(ASSIGNMENT)) {
      const { key = '', q = '', value = '' } = m.groups ?? {};
      const span = m.indices?.groups?.value;
      if (!span) continue;
      // max_tokens=4096, PASSWORD=changeme, token = response.token
      if (PLACEHOLDER.test(value) || SHORT_NUMBER.test(value) || MEMBER_ACCESS.test(value)) {
        continue;
      }

      // Quoted values and .env-style KEY=value are strong signals. An unquoted
      // plain identifier (token = getToken) is probably code, so it stays below
      // the default threshold.
      let confidence = 0.7;
      if (q || key === key.toUpperCase()) confidence = 0.9;
      else if (IDENTIFIER.test(value) && !/\d/.test(value)) confidence = 0.45;

      const [start, end] = span;
      findings.push({
        type: 'SECRET_ASSIGNMENT',
        start,
        end,
        value: text.slice(start, end),
        confidence,
        detectorId: 'secret-assignment',
      });
    }
    return findings;
  },
};
