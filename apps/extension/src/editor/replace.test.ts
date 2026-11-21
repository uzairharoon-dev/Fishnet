import { PlaceholderMap, scanSync } from '@fishnet/pii-core';
import { afterEach, describe, expect, it } from 'vitest';
import { chatgptAdapter as adapter } from '../adapters/chatgpt';
import { replaceFindings } from './replace';

const originalExec = document.execCommand;

/** What the browser does for execCommand('insertText') on a selection. */
function fakeExecCommand(_cmd: string, _ui?: boolean, text?: string): boolean {
  const range = document.getSelection()?.getRangeAt(0);
  if (!range) return false;
  range.deleteContents();
  range.insertNode(document.createTextNode(text ?? ''));
  return true;
}

afterEach(() => {
  document.execCommand = originalExec;
  document.body.innerHTML = '';
});

describe('replaceFindings', () => {
  it('replaces findings in a rich editor, keeping the rest', () => {
    document.execCommand = fakeExecCommand;
    document.body.innerHTML = `<form><div contenteditable="true" class="ProseMirror" id="prompt-textarea">
      <p>mail <strong>ahmed</strong>@acme.pk now</p><p>CNIC 35202-1234567-1</p></div></form>`;
    const editor = adapter.findEditor() as HTMLElement;
    const map = new PlaceholderMap();

    const findings = scanSync(adapter.getText(editor).text);
    expect(replaceFindings(adapter, editor, findings, map)).toBe(2);
    expect(adapter.getText(editor).text.trim()).toBe('mail [EMAIL_1] now\nCNIC [CNIC_1]');
    expect(map.lookup('[CNIC_1]')).toBe('35202-1234567-1');
  });

  it('replaces findings in a textarea', () => {
    document.body.innerHTML = '<form><textarea></textarea></form>';
    const ta = adapter.findEditor() as HTMLTextAreaElement;
    ta.value = 'a@b.co and 0300-1234567';
    const map = new PlaceholderMap();

    replaceFindings(adapter, ta, scanSync(ta.value), map);
    expect(ta.value).toBe('[EMAIL_1] and [PHONE_1]');
  });

  it('skips findings whose text has changed since the scan', () => {
    document.body.innerHTML = '<form><textarea></textarea></form>';
    const ta = adapter.findEditor() as HTMLTextAreaElement;
    ta.value = 'mail a@b.co';
    const findings = scanSync(ta.value);
    ta.value = 'mail x@y.co';

    expect(replaceFindings(adapter, ta, findings, new PlaceholderMap())).toBe(0);
    expect(ta.value).toBe('mail x@y.co');
  });
});
