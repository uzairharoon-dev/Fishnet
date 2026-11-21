import type { Severity } from './describe';

/**
 * Paints findings with the CSS Custom Highlight API. Highlights are drawn by
 * the browser over existing text, so the editor's DOM is never changed and
 * ProseMirror has nothing to fight with.
 */

const NAMES: Record<Severity | 'flash', string> = {
  high: 'fishnet-high',
  medium: 'fishnet-medium',
  flash: 'fishnet-flash',
};
const STYLE_ID = 'fishnet-highlight-style';
const FLASH_MS = 1200;

// ::highlight() rules must live in the page, not in a shadow root.
const CSS_RULES = `
::highlight(${NAMES.high}) { background-color: rgba(239, 68, 68, 0.28); text-decoration: underline wavy rgb(220, 38, 38); }
::highlight(${NAMES.medium}) { background-color: rgba(245, 158, 11, 0.25); text-decoration: underline dotted rgb(217, 119, 6); }
::highlight(${NAMES.flash}) { background-color: rgba(59, 130, 246, 0.45); }
`;

export interface HighlightItem {
  range: Range;
  severity: Severity;
}

export function highlightsSupported(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

export class Highlighter {
  private flashTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private doc: Document = document) {
    if (!highlightsSupported() || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS_RULES;
    doc.head.append(style);
  }

  show(items: HighlightItem[]): void {
    if (!highlightsSupported()) return;
    for (const severity of ['high', 'medium'] as const) {
      const ranges = items.filter((i) => i.severity === severity).map((i) => i.range);
      if (ranges.length) CSS.highlights.set(NAMES[severity], new Highlight(...ranges));
      else CSS.highlights.delete(NAMES[severity]);
    }
  }

  /** Briefly marks one range, e.g. when its chip in the banner is clicked. */
  flash(range: Range): void {
    if (!highlightsSupported()) return;
    clearTimeout(this.flashTimer);
    CSS.highlights.set(NAMES.flash, new Highlight(range));
    this.flashTimer = setTimeout(() => CSS.highlights.delete(NAMES.flash), FLASH_MS);
  }

  clear(): void {
    if (!highlightsSupported()) return;
    for (const name of Object.values(NAMES)) CSS.highlights.delete(name);
  }

  destroy(): void {
    clearTimeout(this.flashTimer);
    this.clear();
    this.doc.getElementById(STYLE_ID)?.remove();
  }
}
