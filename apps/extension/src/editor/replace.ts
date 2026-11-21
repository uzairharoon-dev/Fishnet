import type { Finding, PlaceholderMap } from '@fishnet/pii-core';
import type { SiteAdapter } from '../adapters/types';
import { insertText } from './insert';

/**
 * Replaces findings that are already in the editor with placeholder tokens.
 *
 * Works from the last finding to the first, so earlier offsets stay valid, and
 * rebuilds the text index before each step because the editor may re-render
 * its nodes after every change. Returns how many findings were replaced.
 */
export function replaceFindings(
  adapter: SiteAdapter,
  editor: HTMLElement,
  findings: Finding[],
  map: PlaceholderMap,
): number {
  let replaced = 0;
  // Focus first: focusing later would move the caret off the selection.
  editor.focus();
  for (const f of [...findings].sort((a, b) => b.start - a.start)) {
    const index = adapter.getText(editor);
    // The user may have typed since the scan; skip anything that moved.
    if (index.text.slice(f.start, f.end) !== f.value) continue;
    const token = map.getOrCreate(f.type, f.value, (t) => index.text.includes(t));

    if (editor instanceof HTMLTextAreaElement) {
      editor.setSelectionRange(f.start, f.end);
      if (insertText(editor, token)) replaced++;
      continue;
    }

    const range = index.offsetToRange(f.start, f.end);
    const selection = editor.ownerDocument.getSelection();
    if (!range || !selection) continue;
    selection.removeAllRanges();
    selection.addRange(range);
    if (insertText(editor, token, { preferExecCommand: true })) replaced++;
  }
  return replaced;
}
