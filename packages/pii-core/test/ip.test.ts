import { describe, expect, it } from 'vitest';
import { isValidIPv4, isValidIPv6, scanSync } from '../src';

const ips = (text: string) => scanSync(text, { enabledTypes: ['IP_ADDRESS'] }).map((f) => f.value);

describe('IP validators', () => {
  it.each(['0.0.0.0', '10.0.0.1', '192.168.1.254', '255.255.255.255'])('accepts IPv4 %s', (ip) => {
    expect(isValidIPv4(ip)).toBe(true);
  });

  it.each(['256.1.1.1', '1.2.3', '01.2.3.4', '1.2.3.4.5'])('rejects IPv4 %s', (ip) => {
    expect(isValidIPv4(ip)).toBe(false);
  });

  it.each(['2001:0db8:85a3:0000:0000:8a2e:0370:7334', '2001:db8::8a2e:370:7334', 'fe80::1'])(
    'accepts IPv6 %s',
    (ip) => expect(isValidIPv6(ip)).toBe(true),
  );

  it.each(['12:30:45', '1::2::3', '2001:db8:::1', 'gggg::1', '1:2:3:4:5:6:7:8:9'])(
    'rejects IPv6 %s',
    (ip) => expect(isValidIPv6(ip)).toBe(false),
  );
});

describe('IP detector', () => {
  it('finds IPv4 with offsets', () => {
    const text = 'ssh into 10.20.30.40 now';
    const [f] = scanSync(text);
    expect(f).toMatchObject({ type: 'IP_ADDRESS', value: '10.20.30.40' });
    expect(text.slice(f?.start, f?.end)).toBe('10.20.30.40');
  });

  it('finds IPv4 with a port and at sentence end', () => {
    expect(ips('db at 192.168.0.10:5432 and backup 172.16.0.2.')).toEqual([
      '192.168.0.10',
      '172.16.0.2',
    ]);
  });

  it('finds IPv6', () => {
    expect(ips('server 2001:db8::8a2e:370:7334 is down')).toEqual(['2001:db8::8a2e:370:7334']);
  });

  it('ignores invalid octets and longer dotted numbers', () => {
    expect(ips('999.1.1.1 and 1.2.3.4.5 and section 3.1.4.1.5')).toEqual([]);
  });

  it('ignores version strings', () => {
    expect(ips('upgrade to v1.2.3.4 or version 2.0.0.1')).toEqual([]);
  });

  it('ignores clock times and C++ scopes', () => {
    expect(ips('meeting at 12:30:45, use std::vector')).toEqual([]);
  });

  it('boosts confidence with context words', () => {
    const [plain] = scanSync('see 8.8.8.8');
    const [boosted] = scanSync('server ip 8.8.8.8');
    expect(boosted?.confidence).toBeGreaterThan(plain?.confidence ?? 1);
  });
});
