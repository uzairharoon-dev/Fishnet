/**
 * Builds the benchmark datasets in bench/data:
 *   synthetic.jsonl    template prompts with generated values (seeded, reproducible)
 *   negatives.jsonl    text with nothing sensitive in it
 *   handlabeled.jsonl  converted from handlabeled.src.txt
 *
 * Run: pnpm bench:gen
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMarked, type Sample, writeJsonl } from './lib';

const DATA = join(import.meta.dirname, 'data');
const SYNTHETIC_COUNT = 150;

// mulberry32: small seeded PRNG so the dataset is identical on every run.
let seed = 0x5eed;
function rand(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T>(xs: readonly T[]): T => xs[int(0, xs.length - 1)] as T;
const digits = (n: number) => Array.from({ length: n }, () => int(0, 9)).join('');
const chars = (alphabet: string, n: number) =>
  Array.from({ length: n }, () => alphabet[int(0, alphabet.length - 1)]).join('');

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALNUM = `${UPPER}abcdefghijklmnopqrstuvwxyz0123456789`;
const B64 = `${ALNUM}+/`;

const FIRST = [
  'Ahmed',
  'Ayesha',
  'Bilal',
  'Fatima',
  'Hamza',
  'Sana',
  'Usman',
  'Zainab',
  'Omar',
  'Hira',
  'John',
  'Maria',
  'Wei',
  'Priya',
];
const LAST = [
  'Khan',
  'Malik',
  'Raza',
  'Siddiqui',
  'Qureshi',
  'Chaudhry',
  'Butt',
  'Smith',
  'Garcia',
  'Chen',
];
const DOMAINS = ['acme.pk', 'gmail.com', 'outlook.com', 'techno.io', 'bank.com.pk', 'startup.dev'];
const MOBILE_PREFIXES = [
  '300',
  '301',
  '303',
  '305',
  '308',
  '311',
  '312',
  '315',
  '321',
  '322',
  '323',
  '331',
  '333',
  '334',
  '336',
  '340',
  '342',
  '345',
  '347',
];
const ENV_KEYS = [
  'DB_PASSWORD',
  'API_KEY',
  'SECRET_KEY',
  'STRIPE_SECRET',
  'JWT_SECRET',
  'REDIS_PASSWORD',
  'SMTP_PASSWORD',
];

function luhnCheckDigit(partial: string): string {
  let sum = 0;
  for (let i = 0; i < partial.length; i++) {
    let d = Number(partial[partial.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return String((10 - (sum % 10)) % 10);
}

function mod97(s: string): number {
  let r = 0;
  for (const ch of s) {
    const v = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) r = (r * 10 + Number(d)) % 97;
  }
  return r;
}

function iban(country: string, bban: string): string {
  const check = 98 - mod97(`${bban}${country}00`);
  return `${country}${String(check).padStart(2, '0')}${bban}`;
}

const base64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const person = () => `${pick(FIRST)} ${pick(LAST)}`;

/** Each slot returns marked text; only the {{TYPE|...}} part is a gold entity. */
const SLOTS: Record<string, () => string> = {
  PERSON: () => `{{PERSON|${person()}}}`,
  EMAIL: () => {
    const f = pick(FIRST).toLowerCase();
    const l = pick(LAST).toLowerCase();
    const local = pick([`${f}.${l}`, `${f}${int(1, 99)}`, `${f[0]}${l}`, `${f}_${l}`]);
    return `{{EMAIL|${local}@${pick(DOMAINS)}}}`;
  },
  PHONE: () => {
    const p = pick(MOBILE_PREFIXES);
    const n = digits(7);
    const value = pick([
      `0${p}-${n}`,
      `0${p}${n}`,
      `+92 ${p} ${n}`,
      `+92${p}${n}`,
      `+92 42 35${digits(6)}`,
      `042-35${digits(6)}`,
    ]);
    return `{{PHONE|${value}}}`;
  },
  CNIC: () => `{{CNIC|${int(1, 7)}${digits(4)}-${digits(7)}-${int(0, 9)}}}`,
  CNIC_BARE: () => `CNIC {{CNIC|${int(1, 7)}${digits(12)}}}`,
  CARD: () => {
    const kind = pick(['visa', 'mc', 'amex', 'discover'] as const);
    if (kind === 'amex') {
      const partial = pick(['34', '37']) + digits(12);
      const n = partial + luhnCheckDigit(partial);
      return `{{CREDIT_CARD|${pick([n, `${n.slice(0, 4)} ${n.slice(4, 10)} ${n.slice(10)}`])}}}`;
    }
    const prefix = { visa: '4', mc: String(int(51, 55)), discover: '6011' }[kind];
    const partial = prefix + digits(15 - prefix.length);
    const n = partial + luhnCheckDigit(partial);
    const groups = n.match(/.{4}/g) ?? [];
    return `{{CREDIT_CARD|${pick([n, groups.join(' '), groups.join('-')])}}}`;
  },
  IBAN: () => {
    const value =
      rand() < 0.6
        ? iban('PK', chars(UPPER, 4) + digits(16))
        : iban('GB', chars(UPPER, 4) + digits(14));
    return `{{IBAN|${rand() < 0.5 ? value : (value.match(/.{1,4}/g) ?? []).join(' ')}}}`;
  },
  IP: () => {
    const value =
      rand() < 0.8
        ? pick([
            `${int(11, 223)}.${int(0, 255)}.${int(0, 255)}.${int(1, 254)}`,
            `10.${int(0, 255)}.${int(0, 255)}.${int(1, 254)}`,
            `192.168.${int(0, 255)}.${int(1, 254)}`,
          ])
        : `2001:db8:${chars('0123456789abcdef', 4)}::${chars('0123456789abcdef', 3)}`;
    return `{{IP_ADDRESS|${value}}}`;
  },
  PASSPORT: () => `passport number {{PASSPORT|${chars(UPPER, 2)}${digits(7)}}}`,
  AWS_KEY: () => `{{AWS_ACCESS_KEY|AKIA${chars('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', 16)}}}`,
  AWS_SECRET: () => {
    const value = `${chars(UPPER, 1)}${chars('abcdefghij', 1)}${int(0, 9)}${chars(B64, 37)}`;
    return `aws_secret_access_key = {{AWS_SECRET_KEY|${value}}}`;
  },
  GITHUB: () => `{{GITHUB_TOKEN|ghp_${chars(ALNUM, 36)}}}`,
  JWT: () => {
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64url(JSON.stringify({ sub: digits(6), name: person() }));
    return `{{JWT|${header}.${payload}.${chars(`${ALNUM}-_`, 43)}}}`;
  },
  PRIVATE_KEY: () => {
    const lines = Array.from({ length: 3 }, () => chars(B64, 64));
    return `{{PRIVATE_KEY|-----BEGIN RSA PRIVATE KEY-----\n${lines.join('\n')}\n-----END RSA PRIVATE KEY-----}}`;
  },
  ENV: () => `${pick(ENV_KEYS)}={{SECRET_ASSIGNMENT|${chars(ALNUM, int(12, 24))}}}`,
};

const TEMPLATES = [
  'Draft a reply to {PERSON} about the invoice for {EMAIL}.',
  'Can you format this contact card: {PERSON}, {PHONE}, {EMAIL}',
  'Customer {PERSON} with {CNIC_BARE} wants to change the number to {PHONE}.',
  'Refund failed for card {CARD}. Customer email is {EMAIL}, please write an apology.',
  'Please check whether this IBAN looks right for the transfer: {IBAN}',
  'Why does my server at {IP} refuse ssh connections after reboot?',
  'Here is my .env, why does the app crash?\nNODE_ENV=production\nPORT=3000\n{ENV}\n',
  'Translate to Urdu: Dear {PERSON}, your CNIC {CNIC} has been verified.',
  'My boto3 script fails with {AWS_KEY} and\n{AWS_SECRET}\nwhat is wrong?',
  'git push fails, I set the remote to https://{GITHUB}@github.com/acme/api.git',
  'Decode this token and explain the claims: {JWT}',
  'Is this key format right for paramiko?\n{PRIVATE_KEY}',
  'Summarize: {PERSON} ({EMAIL}, {PHONE}) complained about billing.',
  'Write a visa letter for {PERSON}, {PASSPORT}, travelling next month.',
  'Clean up this CSV row: {PERSON},{EMAIL},{PHONE},{CNIC}',
  'Convert this curl to python: curl -H "Authorization: Bearer {JWT}" https://api.acme.pk/v1/me',
  'Our nginx logs show attacks from {IP} and {IP}, how do I block them?',
  'Fix this docker-compose:\nservices:\n  db:\n    environment:\n      - {ENV}\n',
  'Pay the vendor: account title Acme Traders, {IBAN}, amount 45,000 PKR.',
  'Make this message polite: send the money to {CARD} now or call {PHONE}',
  'Why is my GitHub Action failing? I hardcoded token {GITHUB} in the workflow.',
  'Explain this error: AccessDenied for key {AWS_KEY} in region me-south-1',
  'Fill this KYC form: name {PERSON}, CNIC {CNIC}, mobile {PHONE}, email {EMAIL}',
  'Rewrite: Hi {PERSON}, I have shared the VPN details, connect to {IP} with {ENV}',
  'Here is the customer record: {PERSON} | {EMAIL} | card ending {CARD}',
];

function synthetic(): Sample[] {
  return Array.from({ length: SYNTHETIC_COUNT }, (_, i) => {
    const template = TEMPLATES[i % TEMPLATES.length] ?? '';
    const marked = template.replace(/\{([A-Z_]+)\}/g, (_m, slot: string) => {
      const gen = SLOTS[slot];
      if (!gen) throw new Error(`unknown slot ${slot}`);
      return gen();
    });
    return { id: `syn-${String(i).padStart(4, '0')}`, ...parseMarked(marked), source: 'synthetic' };
  });
}

const HAND_NEGATIVES = [
  'Can you explain how UUIDs like 3f2b8c1e-9d4a-4f6b-a2c7-5e8d1f0b9a3c are generated?',
  'Revert commit 4b825dc642cb6eb9a060e54bf8d69288fbee4904 and explain why.',
  'The build started at 2026-11-15T09:30:00Z and took 12:45:10 to finish.',
  'Upgrade from v2.3.1.4 to version 3.0.0.1 broke the plugin.',
  'Set max_tokens = 4096 and temperature = 0.7 in the request.',
  'In C++, std::vector and std::map are both in the standard library.',
  'Order number 1234567812345678 has not shipped yet.',
  'PASSWORD=changeme is the placeholder in our .env.example file.',
  'Use API_KEY=${API_KEY} so the key comes from the environment.',
  'const token = getToken(); then pass token to the client.',
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.',
  'The meeting is on 15/11/2026 at 10:30, room 4B.',
  'Our revenue grew from 1,250,000 to 1,875,000 PKR this quarter.',
  'Write a Python function that validates an email address with a regex.',
  'What is the difference between IPv4 and IPv6 addressing?',
  'Explain how the Luhn algorithm checks credit card numbers.',
  'How do I generate an RSA key pair with ssh-keygen?',
  'Tracking number 1Z999AA10123456784 shows it is in Karachi.',
  'Section 4.2.1 of the spec covers retries; see also table 7.',
  'Invoice INV-2026-00042 totals 18,500 rupees including tax.',
  'The hash sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08 matches.',
  'Call the function with ids [101, 202, 303] and limit 50.',
  'docker run -p 8080:80 nginx:1.27 starts the server.',
  'The password reset link expires in 24 hours.',
  'Our office is open 9 to 5, Monday to Friday.',
  'token = response.token is undefined after login, why?',
  'ISBN 978-3-16-148410-0 is the second edition.',
  'Set the timeout to 30000 ms and retries to 3.',
  'npm install react@19.2.4 react-dom@19.2.4',
  'The coordinates are 31.5204, 74.3587 roughly.',
];

function negatives(): Sample[] {
  const generated = Array.from({ length: 20 }, () =>
    pick([
      () =>
        `Request id ${chars('0123456789abcdef', 8)}-${chars('0123456789abcdef', 4)}-${chars('0123456789abcdef', 4)}-${chars('0123456789abcdef', 4)}-${chars('0123456789abcdef', 12)} failed.`,
      () => `Cherry-pick ${chars('0123456789abcdef', 40)} onto main.`,
      () =>
        `Released ${int(2020, 2026)}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')} as v${int(1, 9)}.${int(0, 20)}.${int(0, 40)}.`,
      () => `Your order ${digits(10)} of ${int(2, 9)} items is packed.`,
      () => `Tests took ${int(1, 59)}.${digits(3)} seconds on ${int(2, 64)} cores.`,
    ])(),
  );
  return [...HAND_NEGATIVES, ...generated].map((text, i) => ({
    id: `neg-${String(i).padStart(4, '0')}`,
    text,
    entities: [],
    source: 'negative',
  }));
}

function handlabeled(): Sample[] {
  return readFileSync(join(DATA, 'handlabeled.src.txt'), 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line, i) => ({
      id: `hand-${String(i).padStart(4, '0')}`,
      // Lines use a literal \n for line breaks inside a sample.
      ...parseMarked(line.replace(/\\n/g, '\n')),
      source: 'handlabeled',
    }));
}

const sets = { synthetic: synthetic(), negatives: negatives(), handlabeled: handlabeled() };
for (const [name, samples] of Object.entries(sets)) {
  writeJsonl(join(DATA, `${name}.jsonl`), samples);
  console.log(`${name}.jsonl: ${samples.length} samples`);
}
