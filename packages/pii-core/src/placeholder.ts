import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import type { EntityType, Finding } from './types';

/** Short, readable token labels. The AI sees these, so they should read naturally. */
const LABELS: Record<EntityType, string> = {
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  CREDIT_CARD: 'CARD',
  IBAN: 'IBAN',
  CNIC: 'CNIC',
  PASSPORT: 'PASSPORT',
  IP_ADDRESS: 'IP',
  AWS_ACCESS_KEY: 'AWS_KEY',
  AWS_SECRET_KEY: 'AWS_SECRET',
  GITHUB_TOKEN: 'GITHUB_TOKEN',
  JWT: 'JWT',
  PRIVATE_KEY: 'PRIVATE_KEY',
  SECRET_ASSIGNMENT: 'SECRET',
  PERSON: 'PERSON',
  ORG: 'ORG',
  LOCATION: 'LOCATION',
  CUSTOM: 'CUSTOM',
};

const LABEL_SET = new Set(Object.values(LABELS));

/**
 * Tokens as written, plus small variants a model might produce when it echoes
 * them back: [Email_1], [EMAIL 1], [email-1].
 */
export const TOKEN_RE = /\[([A-Za-z]+(?:_[A-Za-z]+)*)[_ -](\d{1,4})\]/g;

/** Same value written differently should get the same token. */
export function normalizeValue(type: EntityType, value: string): string {
  switch (type) {
    case 'EMAIL':
      return value.toLowerCase();
    case 'PHONE':
      return parsePhoneNumberFromString(value, 'PK')?.number ?? value.replace(/[^\d+]/g, '');
    case 'CREDIT_CARD':
    case 'IBAN':
    case 'CNIC':
      return value.replace(/[\s-]/g, '').toUpperCase();
    default:
      return value;
  }
}

export interface PlaceholderEntry {
  token: string;
  type: EntityType;
  value: string;
}

export interface SerializedMap {
  entries: PlaceholderEntry[];
}

/** Two-way map between real values and placeholder tokens for one conversation. */
export class PlaceholderMap {
  private byKey = new Map<string, string>();
  private byToken = new Map<string, PlaceholderEntry>();
  private counters = new Map<string, number>();

  /**
   * Token for this value, creating one if needed.
   * `isTaken` lets the caller skip tokens that already appear in the text.
   */
  getOrCreate(type: EntityType, value: string, isTaken: (token: string) => boolean = () => false) {
    const key = `${type}:${normalizeValue(type, value)}`;
    const existing = this.byKey.get(key);
    if (existing) return existing;

    const label = LABELS[type];
    let n = this.counters.get(label) ?? 0;
    let token: string;
    do {
      n++;
      token = `[${label}_${n}]`;
    } while (this.byToken.has(token) || isTaken(token));
    this.counters.set(label, n);
    this.byKey.set(key, token);
    this.byToken.set(token, { token, type, value });
    return token;
  }

  lookup(token: string): string | undefined {
    return this.byToken.get(token)?.value;
  }

  entries(): PlaceholderEntry[] {
    return [...this.byToken.values()];
  }

  get size(): number {
    return this.byToken.size;
  }

  toJSON(): SerializedMap {
    return { entries: this.entries() };
  }

  static fromJSON(data: SerializedMap): PlaceholderMap {
    const map = new PlaceholderMap();
    for (const { token, type, value } of data.entries) {
      map.byKey.set(`${type}:${normalizeValue(type, value)}`, token);
      map.byToken.set(token, { token, type, value });
      const m = token.match(/^\[(.+)_(\d+)\]$/);
      if (m?.[1] && m[2]) {
        map.counters.set(m[1], Math.max(map.counters.get(m[1]) ?? 0, Number(m[2])));
      }
    }
    return map;
  }
}

export interface Replacement {
  /** Offsets in the original text. */
  start: number;
  end: number;
  token: string;
}

/** Replaces each finding with its token. Findings must not overlap (scan output never does). */
export function redact(text: string, findings: Finding[], map: PlaceholderMap) {
  const sorted = [...findings].sort((a, b) => a.start - b.start);
  const replacements: Replacement[] = [];
  let out = '';
  let last = 0;
  for (const f of sorted) {
    const token = map.getOrCreate(f.type, f.value, (t) => text.includes(t));
    out += text.slice(last, f.start) + token;
    replacements.push({ start: f.start, end: f.end, token });
    last = f.end;
  }
  return { text: out + text.slice(last), replacements };
}

/** Puts real values back. Unknown tokens (ones the model made up) are left as they are. */
export function restore(text: string, map: PlaceholderMap) {
  const restored: Replacement[] = [];
  let out = '';
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const label = m[1]?.toUpperCase() ?? '';
    if (!LABEL_SET.has(label)) continue;
    const token = `[${label}_${Number(m[2])}]`;
    const value = map.lookup(token);
    if (value === undefined) continue;
    out += text.slice(last, m.index);
    // Offsets refer to the restored output text.
    restored.push({ start: out.length, end: out.length + value.length, token });
    out += value;
    last = m.index + m[0].length;
  }
  return { text: out + text.slice(last), restored };
}
