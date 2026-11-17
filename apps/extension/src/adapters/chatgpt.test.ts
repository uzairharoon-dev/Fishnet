import { scanSync } from '@fishnet/pii-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { chatgptAdapter as adapter } from './chatgpt';
import { getAdapter } from './registry';

// Trimmed copy of the chatgpt.com composer markup.
const COMPOSER = `
  <form class="w-full">
    <div class="relative">
      <textarea class="hidden" name="prompt-textarea" style="display:none"></textarea>
      <div contenteditable="true" translate="no" class="ProseMirror" id="prompt-textarea">
        <p>Draft a reply to Ahmed about <strong>ahmed@acme.pk</strong></p>
        <p><br class="ProseMirror-trailingBreak"></p>
        <p>CNIC 35202-1234567-1</p>
        <pre><code>DB_HOST=10.0.0.5
DB_PASSWORD=s3cr3t-Pa55</code></pre>
      </div>
    </div>
    <button data-testid="send-button" aria-label="Send prompt"><svg></svg></button>
  </form>`;

beforeEach(() => {
  document.body.innerHTML = COMPOSER;
});

describe('chatgpt adapter', () => {
  it('matches chatgpt.com only', () => {
    expect(getAdapter(new URL('https://chatgpt.com/c/abc'))?.id).toBe('chatgpt');
    expect(getAdapter(new URL('https://chatgpt.com.evil.io/'))).toBeNull();
    expect(getAdapter(new URL('https://claude.ai/new'))).toBeNull();
  });

  it('finds the ProseMirror editor, not the hidden textarea', () => {
    expect(adapter.findEditor()?.id).toBe('prompt-textarea');
    expect(adapter.findEditor()?.tagName).toBe('DIV');
  });

  it('falls back to a textarea composer', () => {
    document.body.innerHTML = '<form><textarea></textarea></form>';
    expect(adapter.findEditor()?.tagName).toBe('TEXTAREA');
  });

  it('finds the send button', () => {
    expect(adapter.findSendButton()?.getAttribute('aria-label')).toBe('Send prompt');
  });

  it('reads the conversation id from the URL', () => {
    expect(adapter.conversationId(new URL('https://chatgpt.com/c/6738-ab12'))).toBe('6738-ab12');
    expect(adapter.conversationId(new URL('https://chatgpt.com/'))).toBeNull();
  });

  it('treats only plain Enter as submit', () => {
    const key = (init: KeyboardEventInit) =>
      adapter.isSubmitKey(new KeyboardEvent('keydown', init));
    expect(key({ key: 'Enter' })).toBe(true);
    expect(key({ key: 'Enter', shiftKey: true })).toBe(false);
    expect(key({ key: 'Enter', isComposing: true })).toBe(false);
    expect(key({ key: 'a' })).toBe(false);
  });
});

describe('scanning the composer', () => {
  it('finds every item with offsets that map back to the DOM', () => {
    const editor = adapter.findEditor() as HTMLElement;
    const index = adapter.getText(editor);
    const findings = scanSync(index.text);

    expect(findings.map((f) => f.type)).toEqual([
      'EMAIL',
      'CNIC',
      'IP_ADDRESS',
      'SECRET_ASSIGNMENT',
    ]);
    for (const f of findings) {
      expect(index.text.slice(f.start, f.end)).toBe(f.value);
      expect(index.offsetToRange(f.start, f.end)?.toString()).toBe(f.value);
    }
  });

  it('reads a textarea composer by value', () => {
    document.body.innerHTML = '<form><textarea></textarea></form>';
    const editor = adapter.findEditor() as HTMLTextAreaElement;
    editor.value = 'call 0300-1234567';
    const index = adapter.getText(editor);
    expect(scanSync(index.text).map((f) => f.value)).toEqual(['0300-1234567']);
    expect(index.offsetToRange(5, 17)).toBeNull();
  });
});
