/** Four decimal octets, each 0-255, no leading zeros (so "01.02.03.04" is rejected). */
export function isValidIPv4(s: string): boolean {
  const parts = s.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => /^(?:0|[1-9]\d{0,2})$/.test(p) && Number(p) <= 255);
}

/** Full or "::"-compressed IPv6. Embedded IPv4 tails are not supported. */
export function isValidIPv6(s: string): boolean {
  const halves = s.split('::');
  if (halves.length > 2) return false;

  const groups = (part: string | undefined) => (part ? part.split(':') : []);
  const head = groups(halves[0]);
  const tail = groups(halves[1]);
  const all = [...head, ...tail];
  if (!all.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return false;

  if (halves.length === 1) return all.length === 8;
  // "::" stands for at least one zero group. Require 2+ explicit groups so
  // clock times and C++ scopes like "std::vector" are not reported.
  return all.length <= 7 && all.length >= 2;
}
