import { scanSync } from '@fishnet/pii-core';
import { afterEach, describe, expect, it } from 'vitest';
import { ReviewDialog } from './review';

const findings = () => scanSync('mail ahmed@acme.pk, card 4111 1111 1111 1111');
let dialog: ReviewDialog;

afterEach(() => {
  dialog.close();
  document.body.innerHTML = '';
});

const q = (sel: string) => dialog.root?.querySelector<HTMLElement>(sel) ?? null;

describe('ReviewDialog', () => {
  it('shows masked findings and focuses Redact & send', () => {
    dialog = new ReviewDialog();
    void dialog.open(findings());
    expect(dialog.isOpen).toBe(true);
    expect(q('h2')?.textContent).toBe('This message has 2 sensitive items');
    const text = dialog.root?.textContent ?? '';
    expect(text).toContain('ah•••@acme.pk');
    expect(text).not.toContain('ahmed@acme.pk');
    expect(text).not.toContain('4111 1111 1111 1111');
    expect(dialog.root?.activeElement).toBe(q('.redact'));
  });

  it.each([
    ['.redact', 'redact'],
    ['.send', 'send'],
    ['.edit', 'edit'],
  ] as const)('%s resolves with %s and closes', async (sel, choice) => {
    dialog = new ReviewDialog();
    const result = dialog.open(findings());
    q(sel)?.click();
    await expect(result).resolves.toBe(choice);
    expect(dialog.isOpen).toBe(false);
    expect(document.querySelector('fishnet-review')).toBeNull();
  });

  it('Escape means edit and does not reach the page', async () => {
    dialog = new ReviewDialog();
    let pageSawKey = false;
    document.addEventListener('keydown', () => {
      pageSawKey = true;
    });
    const result = dialog.open(findings());
    q('.redact')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    );
    await expect(result).resolves.toBe('edit');
    expect(pageSawKey).toBe(false);
  });

  it('opening again settles the previous one as edit', async () => {
    dialog = new ReviewDialog();
    const first = dialog.open(findings());
    void dialog.open(findings());
    await expect(first).resolves.toBe('edit');
    expect(document.querySelectorAll('fishnet-review')).toHaveLength(1);
  });
});
