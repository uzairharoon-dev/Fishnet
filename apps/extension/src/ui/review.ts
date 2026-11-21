import type { Finding } from '@fishnet/pii-core';
import { maskValue, SEVERITY, TYPE_LABELS } from './describe';

/** redact: replace findings, then send. send: send as typed. edit: go back to the editor. */
export type ReviewChoice = 'redact' | 'send' | 'edit';

const MAX_ROWS = 8;

const STYLES = `
:host {
  --bg: #ffffff; --fg: #1f2328; --muted: #59636e; --border: #d1d9e0;
  --chip: #f6f8fa; --high: #cf222e; --medium: #9a6700; --accent: #0969da; --accent-fg: #ffffff;
  all: initial;
  position: fixed; inset: 0; z-index: 2147483647;
  display: grid; place-items: center;
  background: rgba(0, 0, 0, 0.45);
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :host {
    --bg: #1f2328; --fg: #e6edf3; --muted: #9198a1; --border: #3d444d;
    --chip: #262c36; --high: #ff7b72; --medium: #d29922; --accent: #4493f8; --accent-fg: #0d1117;
  }
}
.dialog {
  background: var(--bg); color: var(--fg); border: 1px solid var(--border);
  border-radius: 12px; padding: 18px; width: min(440px, calc(100vw - 32px));
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
}
h2 { font-size: 16px; margin: 0 0 4px; }
.sub { color: var(--muted); margin: 0 0 12px; }
ul { list-style: none; margin: 0 0 16px; padding: 0; display: grid; gap: 6px; }
li { display: flex; align-items: center; gap: 8px; background: var(--chip); border-radius: 6px; padding: 6px 8px; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.dot.high { background: var(--high); }
.dot.medium { background: var(--medium); }
.type { font-weight: 600; }
.value { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.more { color: var(--muted); }
.actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
button {
  font: inherit; color: inherit; cursor: pointer; padding: 6px 12px; border-radius: 6px;
  background: none; border: 1px solid var(--border);
}
button:hover { background: rgba(127, 127, 127, 0.12); }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.redact { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); font-weight: 600; }
.redact:hover { background: var(--accent); opacity: 0.9; }
`;

/**
 * Modal shown before a message with findings is sent (block mode). Lives in a
 * closed shadow root so the site's CSS and scripts cannot reach it. Shows
 * masked values only.
 */
export class ReviewDialog {
  private host: HTMLElement | null = null;
  private settle: ((choice: ReviewChoice) => void) | null = null;
  /** Closed to page scripts; kept here for tests. */
  root: ShadowRoot | null = null;

  constructor(private doc: Document = document) {}

  get isOpen(): boolean {
    return this.host !== null;
  }

  /** Opens the dialog; resolves when the user picks. Opening again replaces the pending one with 'edit'. */
  open(findings: Finding[]): Promise<ReviewChoice> {
    this.close('edit');
    const doc = this.doc;
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
      const node = doc.createElement(tag);
      if (cls) node.className = cls;
      if (text) node.textContent = text;
      return node;
    };

    const host = doc.createElement('fishnet-review');
    const root = host.attachShadow({ mode: 'closed' });
    const style = el('style');
    style.textContent = STYLES;

    const dialog = el('div', 'dialog');
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'fishnet-review-title');
    const n = findings.length;
    const title = el('h2', undefined, `This message has ${n} sensitive item${n === 1 ? '' : 's'}`);
    title.id = 'fishnet-review-title';
    dialog.append(title, el('p', 'sub', 'Checked on this device. Nothing has been sent yet.'));

    const list = el('ul');
    for (const f of findings.slice(0, MAX_ROWS)) {
      const row = el('li');
      row.append(
        el('span', `dot ${SEVERITY[f.type]}`),
        el('span', 'type', TYPE_LABELS[f.type]),
        el('span', 'value', maskValue(f.type, f.value)),
      );
      list.append(row);
    }
    if (n > MAX_ROWS) list.append(el('li', 'more', `+${n - MAX_ROWS} more`));
    dialog.append(list);

    const actions = el('div', 'actions');
    const button = (choice: ReviewChoice, label: string) => {
      const b = el('button', choice, label);
      b.addEventListener('click', () => this.close(choice));
      actions.append(b);
      return b;
    };
    button('edit', 'Edit');
    button('send', 'Send anyway');
    const primary = button('redact', 'Redact & send');
    dialog.append(actions);

    // Keys must not reach the site's editor shortcuts while the dialog is open.
    host.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close('edit');
      }
    });
    // Click on the backdrop means "not now".
    host.addEventListener('click', (e) => {
      if (e.composedPath()[0] === host) this.close('edit');
    });

    root.append(style, dialog);
    doc.body.append(host);
    this.host = host;
    this.root = root;
    primary.focus();

    return new Promise((resolve) => {
      this.settle = resolve;
    });
  }

  /** Closes the dialog, resolving the pending promise with `choice`. */
  close(choice: ReviewChoice = 'edit'): void {
    this.host?.remove();
    this.host = null;
    this.root = null;
    const settle = this.settle;
    this.settle = null;
    settle?.(choice);
  }
}
