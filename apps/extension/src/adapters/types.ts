import { buildTextIndex, type TextIndex } from '../editor/text-index';

export type SiteId = 'chatgpt';

/**
 * Everything Fishnet needs to know about one site's DOM. Selectors change
 * often, so each site keeps them in one file with fallbacks, and every lookup
 * re-queries instead of caching (SPAs replace the editor on navigation).
 */
export interface SiteAdapter {
  id: SiteId;
  matches(url: URL): boolean;
  findEditor(): HTMLElement | null;
  getText(editor: HTMLElement): TextIndex;
  findSendButton(): HTMLElement | null;
  /** Enter that sends the message: not Shift+Enter, not an IME composition commit. */
  isSubmitKey(e: KeyboardEvent): boolean;
  /** Stable id for the open conversation, or null for a new chat. */
  conversationId(url: URL): string | null;
}

/** First element matching any selector, in priority order. */
export function queryFirst(selectors: readonly string[], root: ParentNode = document) {
  for (const selector of selectors) {
    const el = root.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}

/** Text index for either a contenteditable editor or a plain textarea. */
export function indexEditor(editor: HTMLElement): TextIndex {
  if (editor instanceof HTMLTextAreaElement) {
    // Textarea internals have no DOM ranges; highlighting needs an overlay (D6).
    return { text: editor.value, offsetToRange: () => null };
  }
  return buildTextIndex(editor);
}

export function isPlainEnter(e: KeyboardEvent): boolean {
  return (
    e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && !e.isComposing
  );
}
