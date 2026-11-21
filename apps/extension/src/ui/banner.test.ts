import { type Finding, scanSync } from '@fishnet/pii-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Banner, type BannerHandlers } from './banner';

let handlers: BannerHandlers;
let banner: Banner;

const text = 'mail ahmed@acme.pk, card 4111 1111 1111 1111';
const findings = (): Finding[] => scanSync(text);
const q = (sel: string) => banner.root.querySelector<HTMLElement>(sel);
const qa = (sel: string) => [...banner.root.querySelectorAll<HTMLElement>(sel)];

beforeEach(() => {
  handlers = { onRedactAll: vi.fn(), onRedact: vi.fn(), onLocate: vi.fn() };
  banner = new Banner(handlers);
});

afterEach(() => {
  banner.destroy();
  document.body.innerHTML = '';
});

describe('Banner', () => {
  it('stays hidden with no findings', () => {
    banner.update([]);
    expect(banner.host.isConnected).toBe(false);
  });

  it('lists findings with masked values only', () => {
    banner.update(findings());
    expect(banner.host.isConnected).toBe(true);
    expect(q('.title')?.textContent).toBe('Fishnet found 2 sensitive items');
    const chips = qa('.locate').map((c) => c.textContent);
    expect(chips).toEqual(['Emailah•••@acme.pk', 'Card411••••111']);
    expect(banner.root.textContent).not.toContain('ahmed@acme.pk');
    expect(banner.root.textContent).not.toContain('4111 1111 1111 1111');
  });

  it('calls the handlers', () => {
    const f = findings();
    banner.update(f);
    qa('.locate')[1]?.click();
    qa('.redact')[0]?.click();
    q('.primary')?.click();
    expect(handlers.onLocate).toHaveBeenCalledWith(f[1]);
    expect(handlers.onRedact).toHaveBeenCalledWith(f[0]);
    expect(handlers.onRedactAll).toHaveBeenCalledWith(f);
  });

  it('stays dismissed until the findings change', () => {
    banner.update(findings());
    q('.close')?.click();
    expect(banner.host.isConnected).toBe(false);
    banner.update(findings());
    expect(banner.host.isConnected).toBe(false);
    banner.update(scanSync('now a@b.co'));
    expect(banner.host.isConnected).toBe(true);
  });

  it('caps the list and says how many more', () => {
    const many = scanSync(Array.from({ length: 9 }, (_, i) => `u${i}@acme.pk`).join(' '));
    banner.update(many);
    expect(qa('.locate')).toHaveLength(6);
    expect(q('.more')?.textContent).toBe('+3 more');
  });

  it('does not rebuild when nothing changed', () => {
    banner.update(findings());
    const card = q('.card');
    banner.update(findings());
    expect(q('.card')).toBe(card);
  });
});
