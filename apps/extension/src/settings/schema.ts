import type { EntityType } from '@fishnet/pii-core';
import type { SiteId } from '../adapters/types';
import { DEFAULT_MODE, isMode, type Mode } from './mode';

/**
 * Everything the user can change. Stored in storage.local only, never
 * storage.sync, which would upload it to the Google account.
 */
export interface Settings {
  /** Mode per site; a missing site uses DEFAULT_MODE. */
  siteModes: Partial<Record<SiteId, Mode>>;
  /** Detectors the user turned off. Stored as a deny list so new detectors start on. */
  disabledTypes: EntityType[];
}

export const SITES: readonly { id: SiteId; name: string; host: string }[] = [
  { id: 'chatgpt', name: 'ChatGPT', host: 'chatgpt.com' },
];

/** Detectors shown in the options page, grouped for scanning by eye. */
export const DETECTOR_GROUPS: readonly { name: string; types: readonly EntityType[] }[] = [
  {
    name: 'Secrets',
    types: [
      'PRIVATE_KEY',
      'AWS_ACCESS_KEY',
      'AWS_SECRET_KEY',
      'GITHUB_TOKEN',
      'JWT',
      'SECRET_ASSIGNMENT',
    ],
  },
  { name: 'Financial', types: ['CREDIT_CARD', 'IBAN'] },
  { name: 'Identity', types: ['CNIC', 'PASSPORT'] },
  { name: 'Contact', types: ['EMAIL', 'PHONE'] },
  { name: 'Network', types: ['IP_ADDRESS'] },
];

const TOGGLEABLE = new Set<EntityType>(DETECTOR_GROUPS.flatMap((g) => g.types));

export const DEFAULT_SETTINGS: Settings = { siteModes: {}, disabledTypes: [] };

/** Turns whatever is in storage into valid settings; unknown or broken values fall back to defaults. */
export function normalizeSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return { siteModes: {}, disabledTypes: [] };
  const { siteModes, disabledTypes } = raw as Record<string, unknown>;

  const modes: Settings['siteModes'] = {};
  if (siteModes && typeof siteModes === 'object') {
    for (const site of SITES) {
      const m = (siteModes as Record<string, unknown>)[site.id];
      if (isMode(m)) modes[site.id] = m;
    }
  }
  const disabled = Array.isArray(disabledTypes)
    ? [...new Set(disabledTypes.filter((t): t is EntityType => TOGGLEABLE.has(t)))]
    : [];
  return { siteModes: modes, disabledTypes: disabled };
}

export function modeFor(settings: Settings, site: SiteId): Mode {
  return settings.siteModes[site] ?? DEFAULT_MODE;
}

export function withSiteMode(settings: Settings, site: SiteId, mode: Mode): Settings {
  return { ...settings, siteModes: { ...settings.siteModes, [site]: mode } };
}

export function isTypeEnabled(settings: Settings, type: EntityType): boolean {
  return !settings.disabledTypes.includes(type);
}

export function withTypeEnabled(settings: Settings, type: EntityType, enabled: boolean): Settings {
  const rest = settings.disabledTypes.filter((t) => t !== type);
  return { ...settings, disabledTypes: enabled ? rest : [...rest, type] };
}

/** Types to pass to scanSync's `enabledTypes`. */
export function enabledTypes(settings: Settings): EntityType[] {
  return [...TOGGLEABLE].filter((t) => isTypeEnabled(settings, t));
}
