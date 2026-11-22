import { type Finding, scanSync } from '@fishnet/pii-core';
import { getAdapter } from '../src/adapters/registry';
import { ConversationMaps } from '../src/conversation-maps';
import { replaceFindings } from '../src/editor/replace';
import { installPasteGuard } from '../src/intercept/paste';
import { installSubmitGuard } from '../src/intercept/submit';
import { isFishnetMessage, type TabStatus } from '../src/messages';
import type { Mode } from '../src/settings/mode';
import { enabledTypes, modeFor, type Settings } from '../src/settings/schema';
import { loadSettings, watchSettings } from '../src/settings/store';
import { Banner } from '../src/ui/banner';
import { SEVERITY } from '../src/ui/describe';
import { Highlighter } from '../src/ui/highlights';
import { ReviewDialog } from '../src/ui/review';

const RESCAN_DELAY_MS = 250;
const EDITOR_TIMEOUT_MS = 10_000;

export default defineContentScript({
  matches: ['https://chatgpt.com/*'],
  async main(ctx) {
    const adapter = getAdapter(new URL(location.href));
    if (!adapter) return;

    // Settings changes from the popup or options page apply without a reload.
    let mode: Mode;
    let scan: (text: string) => Finding[];
    const applySettings = (settings: Settings) => {
      mode = modeFor(settings, adapter.id);
      const types = enabledTypes(settings);
      scan = (text) => scanSync(text, { enabledTypes: types });
    };
    applySettings(await loadSettings());
    ctx.onInvalidated(
      watchSettings((settings) => {
        applySettings(settings);
        scheduleScan();
      }),
    );

    // Counts for the popup and badge. Never values.
    let redacted = 0;
    let current: Finding[] = [];

    const maps = new ConversationMaps();
    const uninstallPasteGuard = installPasteGuard(window, {
      adapter,
      getMode: () => mode,
      getMap: () => currentMap(),
      scan: (text) => scan(text),
      onResult: ({ action, findings, method }) => {
        if (action === 'redacted') redacted += findings.length;
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
      scan: (text) => scan(text),
      onResult: ({ action, findings }) => {
        if (action === 'redacted') redacted += findings.length;
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
        report([]);
        return;
      }
      const index = adapter.getText(editor);
      const findings = scan(index.text);
      highlighter.show(
        findings.flatMap((f) => {
          const range = index.offsetToRange(f.start, f.end);
          return range ? [{ range, severity: SEVERITY[f.type] }] : [];
        }),
      );
      banner.update(findings);
      report(findings);
    };

    // Tell the background (for the badge) only when the findings change.
    let reportedKey = '';
    const report = (findings: Finding[]) => {
      current = findings;
      const high = findings.some((f) => SEVERITY[f.type] === 'high');
      const key = `${findings.length}:${high}`;
      if (key === reportedKey) return;
      reportedKey = key;
      browser.runtime
        .sendMessage({ type: 'fishnet:findings', count: findings.length, high })
        .catch(() => {}); // Extension reloaded; this script is about to be invalidated.
    };

    // The popup asks for this tab's status.
    const onMessage = (message: unknown, _sender: unknown, respond: (s: TabStatus) => void) => {
      if (!isFishnetMessage(message) || message.type !== 'fishnet:status') return;
      respond({
        site: adapter.id,
        mode,
        editorFound: !!adapter.findEditor(),
        findings: current.length,
        redacted,
      });
    };
    browser.runtime.onMessage.addListener(onMessage);
    ctx.onInvalidated(() => browser.runtime.onMessage.removeListener(onMessage));

    const redactInEditor = (findings: Finding[]) => {
      const editor = adapter.findEditor();
      if (editor) redacted += replaceFindings(adapter, editor, findings, currentMap());
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
