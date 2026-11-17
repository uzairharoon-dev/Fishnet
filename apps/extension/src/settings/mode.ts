/**
 * What Fishnet does when it finds something:
 *   off     nothing
 *   warn    let it through and show what was found
 *   redact  replace findings with placeholders
 *   block   stop it and ask
 */
export type Mode = 'off' | 'warn' | 'redact' | 'block';

export const MODES: readonly Mode[] = ['off', 'warn', 'redact', 'block'];

export const DEFAULT_MODE: Mode = 'redact';

export function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value);
}
