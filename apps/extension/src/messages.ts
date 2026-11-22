import type { SiteId } from './adapters/types';
import type { Mode } from './settings/mode';

/** What the content script reports about its tab. Counts only, never values. */
export interface TabStatus {
  site: SiteId;
  mode: Mode;
  /** False when the adapter's selectors no longer match the site. */
  editorFound: boolean;
  /** Findings in the editor right now. */
  findings: number;
  /** Items replaced with placeholders since the page loaded. */
  redacted: number;
}

export type FishnetMessage =
  /** Content script to background: findings in the editor changed. */
  | { type: 'fishnet:findings'; count: number; high: boolean }
  /** Popup to content script: reply with a TabStatus. */
  | { type: 'fishnet:status' };

export function isFishnetMessage(value: unknown): value is FishnetMessage {
  const type = (value as { type?: unknown } | null)?.type;
  return type === 'fishnet:findings' || type === 'fishnet:status';
}

export const BADGE_COLORS = { high: '#cf222e', medium: '#9a6700' } as const;

/** Toolbar badge for a tab: the number of findings, red when any is high severity. */
export function badgeFor(count: number, high: boolean): { text: string; color: string } {
  const text = count === 0 ? '' : count > 99 ? '99+' : String(count);
  return { text, color: high ? BADGE_COLORS.high : BADGE_COLORS.medium };
}
