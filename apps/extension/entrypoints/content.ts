import { type Finding, scanSync } from '@fishnet/pii-core';
import { getAdapter } from '../src/adapters/registry';
import { ConversationMaps } from '../src/conversation-maps';
import { replaceFindings } from '../src/editor/replace';
import { installPasteGuard } from '../src/intercept/paste';
import { installSubmitGuard } from '../src/intercept/submit';
import { DEFAULT_MODE, isMode, type Mode } from '../src/settings/mode';
import { Banner } from '../src/ui/banner';
import { SEVERITY } from '../src/ui/describe';
import { Highlighter } from '../src/ui/highlights';
import { ReviewDialog } from '../src/ui/review';

const RESCAN_DELAY_MS = 250;
const EDITOR_TIMEOUT_MS = 10_000;

/** Mode per site id. Temporary until the full settings schema (D8). */
const siteModes = storage.defineItem<Record<string, Mode>>('local:siteModes', { fallback: {} });

export default defineContentScript({
  matches: ['https://chatgpt.com/*'],
  async main(ctx) {
    const adapter = getAdapter(new URL(location.href));
    if (!adapter) return;

    let mode: Mode = DEFAULT_MODE;
    const applyModes = (modes: Record<string, Mode> | null) => {
      const m = modes?.[adapter.id];
      mode = isMode(m) ? m : DEFAULT_MODE;
    };
    applyModes(await siteModes.getValue());
    ctx.onInvalidated(
      siteModes.watch((modes) => {
        applyModes(modes);
        scheduleScan();
      }),
    );

    const maps = new ConversationMaps();
    const uninstallPasteGuard = installPasteGuard(window, {
      adapter,
      getMode: () => mode,
      getMap: () => currentMap(),
      onResult: ({ action, findings, method }) => {
        // Types only, never values.
        const types = findings.map((f) => f.type).join(', ');
        if (action === 'failed') {
          console.warn(`[Fishnet] could not insert redacted paste (${types})`);
        } else {
          console.info(`[Fishnet] paste ${action}: ${types}${method ? ` via ${method}` : ''}`);
        }
      },
    });
    ctx.onInvalidated(uninstallPasteGuard);

    const review = new ReviewDialog();
    ctx.onInvalidated(() => review.close());
    const uninstallSubmitGuard = installSubmitGuard(window, {
      adapter,
      getMode: () => mode,
      getMap: () => currentMap(),
      review: (findings) => review.open(findings),
      onResult: ({ action, findings }) => {
        // Types only, never values.
        const types = findings.map((f) => f.type).join(', ');
        if (action === 'failed') {
          console.warn(`[Fishnet] held back a message that could not be redacted (${types})`);
        } else {
          console.info(`[Fishnet] submit ${action}: ${types}`);
        }
        scheduleScan();
      },
    });
    ctx.onInvalidated(uninstallSubmitGuard);

    const currentMap = () => maps.get(adapter.conversationId(new URL(location.href)));
    const highlighter = new Highlighter();
    ctx.onInvalidated(() => highlighter.destroy());

    // Highlights and banner show what is in the editor now. Typed text is
    // only changed on a click or on send; pastes are handled by the guard above.
    const scanEditor = () => {
      const editor = adapter.findEditor();
      if (!editor || mode === 'off') {
        highlighter.clear();
        banner.update([]);
        return;
      }
      const index = adapter.getText(editor);
      const findings = scanSync(index.text);
      highlighter.show(
        findings.flatMap((f) => {
          const range = index.offsetToRange(f.start, f.end);
          return range ? [{ range, severity: SEVERITY[f.type] }] : [];
        }),
      );
      banner.update(findings);
    };

    const redactInEditor = (findings: Finding[]) => {
      const editor = adapter.findEditor();
      if (editor) replaceFindings(adapter, editor, findings, currentMap());
      scanEditor();
    };

    const banner = new Banner({
      onRedactAll: redactInEditor,
      onRedact: (f) => redactInEditor([f]),
      onLocate: (f) => {
        const editor = adapter.findEditor();
        const range = editor && adapter.getText(editor).offsetToRange(f.start, f.end);
        if (!range) return;
        range.startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        highlighter.flash(range);
      },
    });
    ctx.onInvalidated(() => banner.destroy());

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
    scheduleScan();
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      checkEditor();
      scheduleScan();
    });
  },
});
