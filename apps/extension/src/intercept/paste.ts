import { type Finding, type PlaceholderMap, redact, scanSync } from '@fishnet/pii-core';
import type { SiteAdapter } from '../adapters/types';
import { type InsertMethod, insertText, syntheticPastes } from '../editor/insert';
import type { Mode } from '../settings/mode';

export type PasteAction = 'warned' | 'redacted' | 'blocked' | 'failed';

export interface PasteResult {
  action: PasteAction;
  findings: Finding[];
  method?: InsertMethod;
}

export interface PasteGuardOptions {
  adapter: SiteAdapter;
  getMode(): Mode;
  /** Placeholder map for the current conversation. */
  getMap(): PlaceholderMap;
  scan?(text: string): Finding[];
  onResult?(result: PasteResult): void;
}

/**
 * Checks pasted text before the editor sees it.
 *
 * Listens on window in the capture phase, which runs before any handler the
 * site attaches to the editor. Clean pastes are never touched.
 */
export function installPasteGuard(target: Window, opts: PasteGuardOptions): () => void {
  const scan = opts.scan ?? ((text: string) => scanSync(text));

  const onPaste = (event: Event) => {
    const e = event as ClipboardEvent;
    if (syntheticPastes.has(e)) return;

    const mode = opts.getMode();
    if (mode === 'off') return;

    const editor = opts.adapter.findEditor();
    if (!editor || !(e.target instanceof Node) || !editor.contains(e.target)) return;

    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!text) return;
    const findings = scan(text);
    if (findings.length === 0) return;

    if (mode === 'warn') {
      opts.onResult?.({ action: 'warned', findings });
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();

    if (mode === 'block') {
      opts.onResult?.({ action: 'blocked', findings });
      return;
    }

    // Only plain text is re-inserted; formatting from an HTML paste is dropped.
    const redacted = redact(text, findings, opts.getMap());
    const method = insertText(editor, redacted.text);
    opts.onResult?.(
      method ? { action: 'redacted', findings, method } : { action: 'failed', findings },
    );
  };

  target.addEventListener('paste', onPaste, { capture: true });
  return () => target.removeEventListener('paste', onPaste, { capture: true });
}
