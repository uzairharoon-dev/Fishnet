import { chatgptAdapter } from './chatgpt';
import type { SiteAdapter } from './types';

const ADAPTERS: readonly SiteAdapter[] = [chatgptAdapter];

export function getAdapter(url: URL): SiteAdapter | null {
  return ADAPTERS.find((a) => a.matches(url)) ?? null;
}
