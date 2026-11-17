import { scanSync } from '@fishnet/pii-core';
import { getAdapter } from '../src/adapters/registry';

const RESCAN_DELAY_MS = 250;
const EDITOR_TIMEOUT_MS = 10_000;

export default defineContentScript({
  matches: ['https://chatgpt.com/*'],
  main(ctx) {
    const adapter = getAdapter(new URL(location.href));
    if (!adapter) return;

    // D4: scan the editor and log what was found. Highlighting (D6) and
    // interception (D5, D7) build on this. Logs carry types and offsets only,
    // never the matched values.
    const scanEditor = () => {
      const editor = adapter.findEditor();
      if (!editor) return;
      const index = adapter.getText(editor);
      const findings = scanSync(index.text);
      if (findings.length === 0) return;
      console.debug(
        '[Fishnet] findings',
        findings.map((f) => ({
          type: f.type,
          start: f.start,
          end: f.end,
          confidence: f.confidence,
          // Textareas have no DOM ranges, so null there is expected.
          rangeMatches: index.offsetToRange(f.start, f.end)?.toString() === f.value || null,
        })),
      );
    };

    let timer: number | undefined;
    const scheduleScan = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = ctx.setTimeout(scanEditor, RESCAN_DELAY_MS);
    };

    const inEditor = (target: EventTarget | null) => {
      const editor = adapter.findEditor();
      return !!editor && target instanceof Node && editor.contains(target);
    };

    // Document-level listeners survive the site replacing the editor element.
    ctx.addEventListener(document, 'input', (e) => inEditor(e.target) && scheduleScan(), {
      capture: true,
    });
    ctx.addEventListener(document, 'paste', (e) => inEditor(e.target) && scheduleScan(), {
      capture: true,
    });

    // Health check: tell the developer (later, the popup) when selectors are out of date.
    const checkEditor = () => {
      ctx.setTimeout(() => {
        if (!adapter.findEditor()) {
          console.warn(`[Fishnet] no editor found on ${adapter.id}; the adapter may be outdated`);
        }
      }, EDITOR_TIMEOUT_MS);
    };
    checkEditor();
    ctx.addEventListener(window, 'wxt:locationchange', checkEditor);
  },
});
