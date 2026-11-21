import type { Finding } from '@fishnet/pii-core';
import { maskValue, SEVERITY, TYPE_LABELS } from './describe';

export interface BannerHandlers {
  onRedactAll(findings: Finding[]): void;
  onRedact(finding: Finding): void;
  /** Scroll to and flash a finding in the editor. */
  onLocate(finding: Finding): void;
}

const MAX_CHIPS = 6;

const STYLES = `
:host {
  --bg: #ffffff; --fg: #1f2328; --muted: #59636e; --border: #d1d9e0;
  --chip: #f6f8fa; --high: #cf222e; --medium: #9a6700; --accent: #0969da; --accent-fg: #ffffff;
  all: initial;
  position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
  width: min(360px, calc(100vw - 32px));
  font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :host {
    --bg: #1f2328; --fg: #e6edf3; --muted: #9198a1; --border: #3d444d;
    --chip: #262c36; --high: #ff7b72; --medium: #d29922; --accent: #4493f8; --accent-fg: #0d1117;
  }
}
.card {
  background: var(--bg); color: var(--fg); border: 1px solid var(--border);
  border-radius: 10px; padding: 12px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
.head { display: flex; align-items: center; gap: 8px; }
.title { font-weight: 600; flex: 1; }
.sub { color: var(--muted); margin: 2px 0 10px; }
ul { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 6px; }
li { display: flex; align-items: center; gap: 6px; background: var(--chip); border-radius: 6px; padding: 4px 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.dot.high { background: var(--high); }
.dot.medium { background: var(--medium); }
.locate { flex: 1; min-width: 0; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.type { font-weight: 600; margin-right: 6px; }
.more { color: var(--muted); padding: 0 6px; }
button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; padding: 2px 4px; border-radius: 4px; }
button:hover { background: rgba(127, 127, 127, 0.15); }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.actions { display: flex; justify-content: flex-end; gap: 8px; }
.primary { background: var(--accent); color: var(--accent-fg); padding: 5px 10px; font-weight: 600; }
.primary:hover { background: var(--accent); opacity: 0.9; }
`;

/** Bottom-corner card listing findings. Lives in a shadow root so the site's CSS cannot reach it. */
export class Banner {
  readonly host: HTMLElement;
  /** Closed to page scripts; kept here for rendering and tests. */
  readonly root: ShadowRoot;
  private findings: Finding[] = [];
  private renderedKey = '';
  private dismissedKey: string | null = null;

  constructor(
    private handlers: BannerHandlers,
    private doc: Document = document,
  ) {
    this.host = doc.createElement('fishnet-banner');
    this.root = this.host.attachShadow({ mode: 'closed' });
    const style = doc.createElement('style');
    style.textContent = STYLES;
    this.root.append(style);
  }

  update(findings: Finding[]): void {
    this.findings = findings;
    const key = findings.map((f) => `${f.type}:${f.start}:${f.value}`).join('|');
    if (findings.length === 0 || key === this.dismissedKey) {
      this.hide();
      return;
    }
    // Findings changed since the user dismissed: show again.
    this.dismissedKey = null;
    if (key === this.renderedKey && this.host.isConnected) return;
    this.renderedKey = key;
    this.render();
    if (!this.host.isConnected) this.doc.body.append(this.host);
  }

  hide(): void {
    this.host.remove();
    this.renderedKey = '';
  }

  destroy(): void {
    this.hide();
  }

  private render(): void {
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
      const node = this.doc.createElement(tag);
      if (cls) node.className = cls;
      if (text) node.textContent = text;
      return node;
    };
    const findings = this.findings;
    const card = el('div', 'card');
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');

    const head = el('div', 'head');
    const n = findings.length;
    head.append(el('span', 'title', `Fishnet found ${n} sensitive item${n === 1 ? '' : 's'}`));
    const close = el('button', 'close', '×');
    close.setAttribute('aria-label', 'Dismiss');
    close.addEventListener('click', () => {
      this.dismissedKey = this.renderedKey;
      this.hide();
    });
    head.append(close);
    card.append(head, el('p', 'sub', 'Checked on this device. Nothing was sent anywhere.'));

    const list = el('ul');
    for (const f of findings.slice(0, MAX_CHIPS)) {
      const item = el('li');
      item.append(el('span', `dot ${SEVERITY[f.type]}`));
      const locate = el('button', 'locate');
      locate.append(el('span', 'type', TYPE_LABELS[f.type]), maskValue(f.type, f.value));
      locate.title = 'Show in message';
      locate.addEventListener('click', () => this.handlers.onLocate(f));
      const redact = el('button', 'redact', 'Redact');
      redact.addEventListener('click', () => this.handlers.onRedact(f));
      item.append(locate, redact);
      list.append(item);
    }
    if (n > MAX_CHIPS) list.append(el('li', 'more', `+${n - MAX_CHIPS} more`));
    card.append(list);

    const actions = el('div', 'actions');
    const all = el('button', 'primary', n === 1 ? 'Redact' : 'Redact all');
    all.addEventListener('click', () => this.handlers.onRedactAll(this.findings));
    actions.append(all);
    card.append(actions);

    this.root.querySelector('.card')?.remove();
    this.root.append(card);
  }
}
