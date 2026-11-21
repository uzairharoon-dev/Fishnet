import { type Finding, PlaceholderMap } from '@fishnet/pii-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatgptAdapter as adapter } from '../adapters/chatgpt';
import type { Mode } from '../settings/mode';
import type { ReviewChoice } from '../ui/review';
import { installSubmitGuard, type SubmitResult } from './submit';

const originalExec = document.execCommand;

/** What the browser does for execCommand('insertText') on a selection. */
function fakeExecCommand(_cmd: string, _ui?: boolean, text?: string): boolean {
  const range = document.getSelection()?.getRangeAt(0);
  if (!range) return false;
  range.deleteContents();
  range.insertNode(document.createTextNode(text ?? ''));
  return true;
}

let mode: Mode;
let choice: ReviewChoice;
let reviewed: Finding[][];
let results: SubmitResult[];
/** Messages the site sent, as the text in the editor at send time. */
let sent: string[];
let uninstall: () => void;

const editor = () => adapter.findEditor() as HTMLElement;
const sendButton = () => adapter.findSendButton() as HTMLButtonElement;
const editorText = () => adapter.getText(editor()).text;

function type(text: string) {
  const p = editor().querySelector('p') as HTMLElement;
  p.textContent = text;
}

function pressEnter(init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
    ...init,
  });
  editor().querySelector('p')?.dispatchEvent(event);
  return event;
}

/** Lets the guard finish its async work (review and settle). */
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  document.execCommand = fakeExecCommand;
  document.body.innerHTML = `<form>
    <div contenteditable="true" class="ProseMirror" id="prompt-textarea"><p></p></div>
    <button data-testid="send-button" type="button">Send</button>
  </form>`;

  // Stand-in for the site: Enter and the send button both send the editor text.
  sent = [];
  editor().addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sent.push(editorText());
    }
  });
  sendButton().addEventListener('click', () => sent.push(editorText()));

  mode = 'redact';
  choice = 'redact';
  reviewed = [];
  results = [];
  uninstall = installSubmitGuard(window, {
    adapter,
    getMode: () => mode,
    getMap: () => new PlaceholderMap(),
    review: async (findings) => {
      reviewed.push(findings);
      return choice;
    },
    settle: async () => {},
    onResult: (r) => results.push(r),
  });
});

afterEach(() => {
  uninstall();
  document.execCommand = originalExec;
  document.body.innerHTML = '';
});

describe('submit guard', () => {
  it('sends clean messages instantly, untouched', () => {
    type('what is a monad?');
    const event = pressEnter();
    expect(sent).toEqual(['what is a monad?']);
    expect(event.defaultPrevented).toBe(true); // by the site, not Fishnet
    expect(results).toEqual([]);
  });

  it('leaves Shift+Enter alone', () => {
    type('mail ahmed@acme.pk');
    const event = pressEnter({ shiftKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(sent).toEqual([]);
    expect(results).toEqual([]);
  });

  it('leaves the Enter that commits an IME composition alone', () => {
    type('mail ahmed@acme.pk');
    pressEnter({ isComposing: true });
    expect(results).toEqual([]);
  });

  it('redact: replaces findings, then sends', async () => {
    type('mail ahmed@acme.pk card 4111 1111 1111 1111');
    pressEnter();
    expect(sent).toEqual([]);
    await flush();
    expect(sent).toEqual(['mail [EMAIL_1] card [CARD_1]']);
    expect(results[0]?.action).toBe('redacted');
  });

  it('redact: also catches the send button', async () => {
    type('mail ahmed@acme.pk');
    sendButton().click();
    expect(sent).toEqual([]);
    await flush();
    expect(sent).toEqual(['mail [EMAIL_1]']);
  });

  it('redact: does not send if findings remain', async () => {
    document.execCommand = () => false;
    type('mail ahmed@acme.pk');
    pressEnter();
    await flush();
    expect(sent).toEqual([]);
    expect(results[0]?.action).toBe('failed');
  });

  it('warn: sends as typed and reports', () => {
    mode = 'warn';
    type('mail ahmed@acme.pk');
    pressEnter();
    expect(sent).toEqual(['mail ahmed@acme.pk']);
    expect(results[0]?.action).toBe('warned');
  });

  it('off: does nothing', () => {
    mode = 'off';
    type('mail ahmed@acme.pk');
    pressEnter();
    expect(sent).toEqual(['mail ahmed@acme.pk']);
    expect(results).toEqual([]);
  });

  it('block: asks, then redacts and sends', async () => {
    mode = 'block';
    type('mail ahmed@acme.pk');
    pressEnter();
    expect(sent).toEqual([]);
    await flush();
    expect(reviewed[0]?.map((f) => f.type)).toEqual(['EMAIL']);
    expect(sent).toEqual(['mail [EMAIL_1]']);
    expect(results[0]?.action).toBe('redacted');
  });

  it('block: Send anyway sends the original', async () => {
    mode = 'block';
    choice = 'send';
    type('mail ahmed@acme.pk');
    pressEnter();
    await flush();
    expect(sent).toEqual(['mail ahmed@acme.pk']);
    expect(results[0]?.action).toBe('sent-anyway');
  });

  it('block: Edit sends nothing and keeps the text', async () => {
    mode = 'block';
    choice = 'edit';
    type('mail ahmed@acme.pk');
    pressEnter();
    await flush();
    expect(sent).toEqual([]);
    expect(editorText()).toBe('mail ahmed@acme.pk');
    expect(results[0]?.action).toBe('cancelled');
  });

  it('block: swallows repeat submits while the review is open', async () => {
    mode = 'block';
    let answer: (c: ReviewChoice) => void = () => {};
    uninstall();
    uninstall = installSubmitGuard(window, {
      adapter,
      getMode: () => mode,
      getMap: () => new PlaceholderMap(),
      review: vi.fn(() => new Promise<ReviewChoice>((r) => (answer = r))),
      settle: async () => {},
    });
    type('mail ahmed@acme.pk');
    pressEnter();
    const repeat = pressEnter();
    sendButton().click();
    expect(repeat.defaultPrevented).toBe(true);
    expect(sent).toEqual([]);
    answer('send');
    await flush();
    expect(sent).toEqual(['mail ahmed@acme.pk']);
  });

  it('falls back to Enter when there is no send button', async () => {
    sendButton().remove();
    type('mail ahmed@acme.pk');
    pressEnter();
    await flush();
    expect(sent).toEqual(['mail [EMAIL_1]']);
  });

  it('stops listening after uninstall', () => {
    uninstall();
    type('mail ahmed@acme.pk');
    pressEnter();
    expect(sent).toEqual(['mail ahmed@acme.pk']);
  });
});
