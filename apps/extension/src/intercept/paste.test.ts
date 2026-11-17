import { PlaceholderMap } from '@fishnet/pii-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatgptAdapter } from '../adapters/chatgpt';
import type { Mode } from '../settings/mode';
import { installPasteGuard, type PasteResult } from './paste';

class FakeDataTransfer {
  private data = new Map<string, string>();
  setData(type: string, value: string) {
    this.data.set(type, value);
  }
  getData(type: string) {
    return this.data.get(type) ?? '';
  }
}
class FakeClipboardEvent extends Event {
  clipboardData: FakeDataTransfer | null;
  constructor(type: string, init: EventInit & { clipboardData?: FakeDataTransfer }) {
    super(type, init);
    this.clipboardData = init.clipboardData ?? null;
  }
}

let mode: Mode;
let map: PlaceholderMap;
let results: PasteResult[];
let editorPastes: string[];
let uninstall: () => void;

/** Simulates a user paste on the first paragraph of the editor. */
function userPaste(text: string): FakeClipboardEvent {
  const data = new FakeDataTransfer();
  data.setData('text/plain', text);
  const event = new FakeClipboardEvent('paste', {
    clipboardData: data,
    bubbles: true,
    cancelable: true,
  });
  document.querySelector('#prompt-textarea p')?.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  vi.stubGlobal('DataTransfer', FakeDataTransfer);
  vi.stubGlobal('ClipboardEvent', FakeClipboardEvent);
  document.body.innerHTML =
    '<form><div contenteditable="true" class="ProseMirror" id="prompt-textarea"><p></p></div></form>';

  // Stand-in for ProseMirror: records every paste it receives and handles it.
  editorPastes = [];
  document.querySelector('#prompt-textarea')?.addEventListener('paste', (e) => {
    editorPastes.push(
      (e as unknown as FakeClipboardEvent).clipboardData?.getData('text/plain') ?? '',
    );
    e.preventDefault();
  });

  mode = 'redact';
  map = new PlaceholderMap();
  results = [];
  uninstall = installPasteGuard(window, {
    adapter: chatgptAdapter,
    getMode: () => mode,
    getMap: () => map,
    onResult: (r) => results.push(r),
  });
});

afterEach(() => {
  uninstall();
  vi.unstubAllGlobals();
});

describe('paste guard', () => {
  it('lets clean pastes through untouched', () => {
    userPaste('just a normal question');
    expect(editorPastes).toEqual(['just a normal question']);
    expect(results).toEqual([]);
  });

  it('redact: the editor only ever receives placeholders', () => {
    userPaste('Reply to ahmed@acme.pk, CNIC 35202-1234567-1');
    expect(editorPastes).toEqual(['Reply to [EMAIL_1], CNIC [CNIC_1]']);
    expect(results[0]).toMatchObject({ action: 'redacted', method: 'paste-event' });
    expect(map.lookup('[EMAIL_1]')).toBe('ahmed@acme.pk');
  });

  it('redact: reuses tokens across pastes in the same conversation', () => {
    userPaste('a@b.co');
    userPaste('c@d.co then a@b.co');
    expect(editorPastes).toEqual(['[EMAIL_1]', '[EMAIL_2] then [EMAIL_1]']);
  });

  it('warn: lets the original through and reports findings', () => {
    mode = 'warn';
    userPaste('mail ahmed@acme.pk');
    expect(editorPastes).toEqual(['mail ahmed@acme.pk']);
    expect(results[0]?.action).toBe('warned');
  });

  it('block: nothing reaches the editor', () => {
    mode = 'block';
    const event = userPaste('DB_PASSWORD=s3cr3t-Pa55');
    expect(editorPastes).toEqual([]);
    expect(event.defaultPrevented).toBe(true);
    expect(results[0]?.action).toBe('blocked');
  });

  it('off: does nothing', () => {
    mode = 'off';
    userPaste('mail ahmed@acme.pk');
    expect(editorPastes).toEqual(['mail ahmed@acme.pk']);
    expect(results).toEqual([]);
  });

  it('ignores pastes outside the editor', () => {
    document.body.insertAdjacentHTML('beforeend', '<input id="search">');
    const data = new FakeDataTransfer();
    data.setData('text/plain', 'ahmed@acme.pk');
    const event = new FakeClipboardEvent('paste', {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    });
    document.querySelector('#search')?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(results).toEqual([]);
  });

  it('stops listening after uninstall', () => {
    uninstall();
    userPaste('mail ahmed@acme.pk');
    expect(editorPastes).toEqual(['mail ahmed@acme.pk']);
  });
});
