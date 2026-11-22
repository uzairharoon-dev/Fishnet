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

export const MODE_LABELS: Record<Mode, { name: string; hint: string }> = {
  off: { name: 'Off', hint: 'Do not check anything' },
  warn: { name: 'Warn', hint: 'Highlight findings, send as typed' },
  redact: { name: 'Redact', hint: 'Replace findings with placeholders' },
  block: { name: 'Block', hint: 'Ask before sending anything found' },
};
