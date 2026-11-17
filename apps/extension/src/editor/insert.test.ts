import { afterEach, describe, expect, it, vi } from 'vitest';
import { insertText, syntheticPastes } from './insert';

// jsdom has no DataTransfer or ClipboardEvent; these stand-ins carry the data
// the same way.
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

const originalExec = document.execCommand;

afterEach(() => {
  vi.unstubAllGlobals();
  document.execCommand = originalExec;
  document.body.innerHTML = '';
});

describe('insertText into a textarea', () => {
  it('replaces the selection and fires input', () => {
    document.body.innerHTML = '<textarea>hello world</textarea>';
    const ta = document.querySelector('textarea') as HTMLTextAreaElement;
    ta.setSelectionRange(6, 11);
    const onInput = vi.fn();
    ta.addEventListener('input', onInput);

    expect(insertText(ta, '[EMAIL_1]')).toBe('set-range-text');
    expect(ta.value).toBe('hello [EMAIL_1]');
    expect(ta.selectionStart).toBe(15);
    expect(onInput).toHaveBeenCalledOnce();
  });
});

describe('insertText into a rich editor', () => {
  it('dispatches a plain-text paste the editor can handle', () => {
    vi.stubGlobal('DataTransfer', FakeDataTransfer);
    vi.stubGlobal('ClipboardEvent', FakeClipboardEvent);
    document.body.innerHTML = '<div contenteditable="true"><p></p></div>';
    const editor = document.querySelector('div') as HTMLElement;

    let received = '';
    editor.addEventListener('paste', (e) => {
      received = (e as unknown as FakeClipboardEvent).clipboardData?.getData('text/plain') ?? '';
      expect(syntheticPastes.has(e)).toBe(true);
      e.preventDefault(); // what ProseMirror does
    });

    expect(insertText(editor, 'line [CNIC_1]\nnext')).toBe('paste-event');
    expect(received).toBe('line [CNIC_1]\nnext');
  });

  it('falls back to execCommand when nothing handles the paste', () => {
    vi.stubGlobal('DataTransfer', FakeDataTransfer);
    vi.stubGlobal('ClipboardEvent', FakeClipboardEvent);
    const exec = vi.fn(() => true);
    document.execCommand = exec;
    document.body.innerHTML = '<div contenteditable="true"></div>';

    expect(insertText(document.querySelector('div') as HTMLElement, 'x')).toBe('exec-command');
    expect(exec).toHaveBeenCalledWith('insertText', false, 'x');
  });
});
