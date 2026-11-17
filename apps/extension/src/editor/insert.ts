/**
 * Inserts text at the caret the way a user paste would, so the site's editor
 * (ProseMirror, Quill, React textarea) updates its own state, undo history
 * and send button.
 */

/** Paste events Fishnet dispatched itself; the paste guard must let these through. */
export const syntheticPastes = new WeakSet<Event>();

export type InsertMethod = 'paste-event' | 'exec-command' | 'set-range-text';

export function insertText(editor: HTMLElement, text: string): InsertMethod | null {
  editor.focus();

  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    // insertText fires a real `input` event, which React-controlled fields need.
    if (document.execCommand?.('insertText', false, text)) return 'exec-command';
    const start = editor.selectionStart ?? editor.value.length;
    const end = editor.selectionEnd ?? start;
    editor.setRangeText(text, start, end, 'end');
    editor.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
    );
    return 'set-range-text';
  }

  // Rich editors: replay a plain-text paste. The editor's own paste handler
  // turns newlines into paragraphs exactly as for a real paste.
  if (typeof DataTransfer !== 'undefined') {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    const event = new ClipboardEvent('paste', {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    });
    syntheticPastes.add(event);
    editor.dispatchEvent(event);
    // An editor that handled the paste cancels the default action.
    if (event.defaultPrevented) return 'paste-event';
  }

  if (document.execCommand?.('insertText', false, text)) return 'exec-command';
  return null;
}
