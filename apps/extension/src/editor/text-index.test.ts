import { describe, expect, it } from 'vitest';
import { buildTextIndex } from './text-index';

function editor(html: string): HTMLElement {
  const el = document.createElement('div');
  el.contentEditable = 'true';
  el.innerHTML = html;
  document.body.replaceChildren(el);
  return el;
}

describe('buildTextIndex text', () => {
  it('reads a single paragraph', () => {
    expect(buildTextIndex(editor('<p>hello world</p>')).text).toBe('hello world');
  });

  it('joins paragraphs with newlines and ignores trailing breaks', () => {
    const el = editor(
      '<p>line one</p><p><br class="ProseMirror-trailingBreak"></p><p>line three</p>',
    );
    expect(buildTextIndex(el).text).toBe('line one\n\nline three');
  });

  it('treats a plain <br> as a newline', () => {
    expect(buildTextIndex(editor('<p>a<br>b</p>')).text).toBe('a\nb');
  });

  it('keeps inline marks and code block newlines', () => {
    const el = editor('<p>mail <strong>ahmed</strong>@acme.pk</p><pre><code>A=1\nB=2</code></pre>');
    expect(buildTextIndex(el).text).toBe('mail ahmed@acme.pk\nA=1\nB=2');
  });

  it('reads list items as lines', () => {
    expect(buildTextIndex(editor('<ul><li>one</li><li>two</li></ul>')).text).toBe('one\ntwo');
  });

  it('returns empty text for an empty editor', () => {
    expect(buildTextIndex(editor('<p><br class="ProseMirror-trailingBreak"></p>')).text).toBe('');
  });
});

describe('offsetToRange', () => {
  it('maps offsets inside one text node', () => {
    const idx = buildTextIndex(editor('<p>call 0300-1234567 now</p>'));
    expect(idx.offsetToRange(5, 17)?.toString()).toBe('0300-1234567');
  });

  it('maps offsets across inline nodes', () => {
    const idx = buildTextIndex(editor('<p>mail <strong>ahmed</strong>@acme.pk</p>'));
    const start = idx.text.indexOf('ahmed');
    expect(idx.offsetToRange(start, start + 13)?.toString()).toBe('ahmed@acme.pk');
  });

  it('maps offsets in a later paragraph', () => {
    const idx = buildTextIndex(editor('<p>first</p><p>second 10.0.0.1</p>'));
    const start = idx.text.indexOf('10.0.0.1');
    expect(idx.offsetToRange(start, start + 8)?.toString()).toBe('10.0.0.1');
  });

  it('spans paragraphs and snaps off virtual newlines', () => {
    const idx = buildTextIndex(editor('<p>aaa</p><p>bbb</p>'));
    // "aaa\nbbb": 2..5 covers "a\nb"
    expect(idx.offsetToRange(2, 5)?.toString()).toBe('ab');
    // A range of only the virtual newline covers nothing.
    expect(idx.offsetToRange(3, 4)).toBeNull();
  });

  it('returns null for empty or out-of-bounds ranges', () => {
    const idx = buildTextIndex(editor('<p>abc</p>'));
    expect(idx.offsetToRange(2, 2)).toBeNull();
    expect(idx.offsetToRange(5, 9)).toBeNull();
  });
});
