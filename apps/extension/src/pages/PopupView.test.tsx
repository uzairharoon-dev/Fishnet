import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TabStatus } from '../messages';
import { PopupView } from './PopupView';
import { act, render } from './render';

const status: TabStatus = {
  site: 'chatgpt',
  mode: 'redact',
  editorFound: true,
  findings: 2,
  redacted: 5,
};

afterEach(() => {
  document.body.innerHTML = '';
});

const view = (s: TabStatus | null, onModeChange = vi.fn(), onOpenOptions = vi.fn()) =>
  render(<PopupView status={s} onModeChange={onModeChange} onOpenOptions={onOpenOptions} />)
    .container;

describe('PopupView', () => {
  it('shows counts, health and mode for a supported tab', () => {
    const c = view(status);
    expect(c.querySelector('h2')?.textContent).toBe('ChatGPT');
    expect(c.querySelector('.health.ok')).not.toBeNull();
    expect([...c.querySelectorAll('dd')].map((d) => d.textContent)).toEqual(['2', '5']);
    expect(c.querySelector('label.selected')?.textContent).toBe('Redact');
  });

  it('warns when the adapter cannot find the editor', () => {
    const c = view({ ...status, editorFound: false });
    expect(c.querySelector('[role="alert"]')?.textContent).toContain('not protected');
  });

  it('explains when Fishnet does not run on the tab', () => {
    const c = view(null);
    expect(c.textContent).toContain('Fishnet does not run on this page');
    expect(c.querySelector('fieldset')).toBeNull();
  });

  it('changes the mode and opens settings', () => {
    const onModeChange = vi.fn();
    const onOpenOptions = vi.fn();
    const c = view(status, onModeChange, onOpenOptions);
    act(() => c.querySelector<HTMLInputElement>('input[value="off"]')?.click());
    act(() => c.querySelector<HTMLButtonElement>('footer button')?.click());
    expect(onModeChange).toHaveBeenCalledWith('off');
    expect(onOpenOptions).toHaveBeenCalled();
  });
});
