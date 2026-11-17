/**
 * Turns a contenteditable editor into the plain text the user sees, and maps
 * offsets in that text back to DOM Ranges.
 *
 * Detectors work on strings; highlighting and replacing need DOM positions.
 * Block elements (paragraphs, list items, code blocks) become "\n" so offsets
 * match the text the site will send. Those newlines are virtual: they have no
 * text node, so a range boundary on one snaps to the nearest real character.
 */

const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TBODY',
  'TD',
  'TH',
  'THEAD',
  'TR',
  'UL',
]);

interface Segment {
  node: Text;
  /** Offset of the node's first character in `text`. */
  start: number;
}

export interface TextIndex {
  text: string;
  /** DOM range covering text[start, end), or null if it covers no real characters. */
  offsetToRange(start: number, end: number): Range | null;
}

export function buildTextIndex(root: HTMLElement): TextIndex {
  const segments: Segment[] = [];
  let text = '';

  const newline = () => {
    if (text.length > 0 && !text.endsWith('\n')) text += '\n';
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node as Text;
      if (t.data.length === 0) return;
      segments.push({ node: t, start: text.length });
      text += t.data;
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === 'BR') {
      // ProseMirror puts a trailing <br> in empty paragraphs to give them height.
      // It is not a line break in the content.
      if (!node.classList.contains('ProseMirror-trailingBreak')) text += '\n';
      return;
    }
    const block = BLOCK_TAGS.has(node.tagName);
    if (block) newline();
    const before = text.length;
    for (const child of node.childNodes) walk(child);
    if (!block) return;
    // An empty paragraph is a blank line of its own.
    if (text.length === before && before > 0) text += '\n';
    else newline();
  };

  for (const child of root.childNodes) walk(child);
  // Newlines after the last block are not part of the message.
  text = text.replace(/\n+$/, '');

  /** Segment containing `offset`, or the first one after it (side 'after') / last one before it. */
  const locate = (
    offset: number,
    side: 'after' | 'before',
  ): { node: Text; offset: number } | null => {
    if (side === 'after') {
      for (const s of segments) {
        const end = s.start + s.node.data.length;
        if (offset < end) return { node: s.node, offset: Math.max(0, offset - s.start) };
      }
      return null;
    }
    for (let i = segments.length - 1; i >= 0; i--) {
      const s = segments[i] as Segment;
      if (offset > s.start) {
        return { node: s.node, offset: Math.min(s.node.data.length, offset - s.start) };
      }
    }
    return null;
  };

  return {
    text,
    offsetToRange(start, end) {
      if (end <= start) return null;
      const from = locate(start, 'after');
      const to = locate(end, 'before');
      if (!from || !to) return null;
      const range = root.ownerDocument.createRange();
      range.setStart(from.node, from.offset);
      range.setEnd(to.node, to.offset);
      return range.collapsed ? null : range;
    },
  };
}
