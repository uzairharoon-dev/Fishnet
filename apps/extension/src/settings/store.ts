import { storage } from '#imports';
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from './schema';

/** The one settings item. Read by content scripts, written by the popup and options page. */
const item = storage.defineItem<Settings>('local:settings', { fallback: DEFAULT_SETTINGS });

export async function loadSettings(): Promise<Settings> {
  return normalizeSettings(await item.getValue());
}

export function saveSettings(settings: Settings): Promise<void> {
  return item.setValue(normalizeSettings(settings));
}

/** Calls `cb` with the new settings whenever any page changes them. Returns an unwatch function. */
export function watchSettings(cb: (settings: Settings) => void): () => void {
  return item.watch((value) => cb(normalizeSettings(value)));
}
