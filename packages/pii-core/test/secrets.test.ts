import { describe, expect, it } from 'vitest';
import { type EntityType, hasJwtHeader, scanSync } from '../src';

const found = (text: string, type: EntityType) =>
  scanSync(text, { enabledTypes: [type] }).map((f) => f.value);

// Built from parts so the repo never contains a whole token-shaped string
// that secret scanners would flag.
const GH_TOKEN = `ghp_${'a1B2c3D4e5'.repeat(4)}`.slice(0, 40);
const AWS_ID = `AKIA${'IOSFODNN7EXAMPLE'}`;
const AWS_SECRET = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.' +
  'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('AWS', () => {
  it('finds an access key id', () => {
    expect(found(`key ${AWS_ID} here`, 'AWS_ACCESS_KEY')).toEqual([AWS_ID]);
  });

  it('finds a secret key next to its config name', () => {
    expect(found(`aws_secret_access_key = ${AWS_SECRET}`, 'AWS_SECRET_KEY')).toEqual([AWS_SECRET]);
  });

  it('ignores a 40-char string without context', () => {
    expect(found(`blob ${AWS_SECRET}`, 'AWS_SECRET_KEY')).toEqual([]);
  });

  it('ignores a git SHA even with context', () => {
    expect(found('aws secret 4b825dc642cb6eb9a060e54bf8d69288fbee4904', 'AWS_SECRET_KEY')).toEqual(
      [],
    );
  });
});

describe('GitHub', () => {
  it('finds a classic token', () => {
    expect(found(`token ${GH_TOKEN}`, 'GITHUB_TOKEN')).toEqual([GH_TOKEN]);
  });

  it('finds a fine-grained token', () => {
    const pat = `github_pat_${'11ABCDEFG0'.repeat(3)}_${'xYz9'.repeat(10)}`;
    expect(found(pat, 'GITHUB_TOKEN')).toEqual([pat]);
  });

  it('ignores a too-short prefix match', () => {
    expect(found('ghp_short123', 'GITHUB_TOKEN')).toEqual([]);
  });
});

describe('JWT', () => {
  it('validates the header', () => {
    expect(hasJwtHeader(JWT)).toBe(true);
    expect(hasJwtHeader('eyJub3RhbGciOjF9.eyJ4IjoxfQ.sig')).toBe(false); // {"notalg":1}
  });

  it('finds a JWT in a bearer header', () => {
    expect(found(`Authorization: Bearer ${JWT}`, 'JWT')).toEqual([JWT]);
  });

  it('ignores eyJ strings that are not JWTs', () => {
    expect(found('eyJhbGciOi.eyJzdWIi', 'JWT')).toEqual([]);
  });
});

describe('private key', () => {
  const block = [
    '-----BEGIN RSA PRIVATE KEY-----',
    'MIIEowIBAAKCAQEAu1SU1LfVLPHCozMxH2Mo4lgOEePzNm0tRgeLezV6ffAt0gun',
    '-----END RSA PRIVATE KEY-----',
  ].join('\n');

  it('finds a complete block', () => {
    expect(found(`here is my key:\n${block}\nthanks`, 'PRIVATE_KEY')).toEqual([block]);
  });

  it('finds an OpenSSH key', () => {
    const ssh = block.replaceAll('RSA', 'OPENSSH');
    expect(found(ssh, 'PRIVATE_KEY')).toEqual([ssh]);
  });

  it('finds a truncated block to the end of the text', () => {
    const cut = block.split('\n').slice(0, 2).join('\n');
    expect(found(`key:\n${cut}`, 'PRIVATE_KEY')).toEqual([cut]);
  });

  it('ignores public keys', () => {
    expect(
      found('-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----', 'PRIVATE_KEY'),
    ).toEqual([]);
  });
});

describe('secret assignment', () => {
  it('reports only the value span', () => {
    const text = 'DB_HOST=localhost\nDB_PASSWORD=s3cr3t-Pa55\n';
    const [f] = scanSync(text, { enabledTypes: ['SECRET_ASSIGNMENT'] });
    expect(f?.value).toBe('s3cr3t-Pa55');
    expect(text.slice(f?.start, f?.end)).toBe('s3cr3t-Pa55');
  });

  it.each([
    ['export STRIPE_SECRET_KEY=sk_live_abc123xyz', 'sk_live_abc123xyz'],
    ['"password": "hunter2!"', 'hunter2!'],
    ["api_key: 'Zx81kd9a'", 'Zx81kd9a'],
    ['my password: hunter2', 'hunter2'],
    ['client_secret=QWERTY123456', 'QWERTY123456'],
  ])('finds the value in %s', (text, value) => {
    expect(found(text, 'SECRET_ASSIGNMENT')).toEqual([value]);
  });

  it.each([
    'max_tokens = 4096',
    'PASSWORD=changeme',
    'API_KEY=${API_KEY}',
    'API_KEY=<your-key-here>',
    'token = response.token',
    'const token = getToken()',
    'password reset: click the link',
    'token = getToken',
  ])('ignores %s', (text) => {
    expect(found(text, 'SECRET_ASSIGNMENT')).toEqual([]);
  });

  it('lets a specific detector win over the generic assignment', () => {
    expect(scanSync(`GITHUB_TOKEN=${GH_TOKEN}`).map((f) => f.type)).toEqual(['GITHUB_TOKEN']);
  });
});
