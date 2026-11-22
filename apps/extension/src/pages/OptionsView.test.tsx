import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Settings, withTypeEnabled } from '../settings/schema';
import { OptionsView } from './OptionsView';
import { act, render } from './render';

afterEach(() => {
  document.body.innerHTML = '';
});

const view = (settings: Settings, onChange = vi.fn(), onReset = vi.fn()) =>
  render(<OptionsView settings={settings} onChange={onChange} onReset={onReset} />).container;

const checkbox = (c: HTMLElement, label: string) =>
  [...c.querySelectorAll('label')]
    .find((l) => l.textContent === label)
    ?.querySelector<HTMLInputElement>('input[type="checkbox"]');

describe('OptionsView', () => {
  it('lists each site with its mode and every detector', () => {
    const c = view(DEFAULT_SETTINGS);
    expect(c.querySelector('.sites h3')?.textContent).toBe('ChatGPT');
    expect(c.querySelector('label.selected')?.textContent).toBe('Redact');
    expect([...c.querySelectorAll('legend')].map((l) => l.textContent)).toEqual([
      'Secrets',
      'Financial',
      'Identity',
      'Contact',
      'Network',
    ]);
    expect(c.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(13);
  });

  it('reflects disabled detectors', () => {
    const c = view(withTypeEnabled(DEFAULT_SETTINGS, 'PHONE', false));
    expect(checkbox(c, 'Phone')?.checked).toBe(false);
    expect(checkbox(c, 'Email')?.checked).toBe(true);
  });

  it('reports changes as new settings', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    const c = view(DEFAULT_SETTINGS, onChange, onReset);
    act(() => checkbox(c, 'Phone')?.click());
    expect(onChange).toHaveBeenLastCalledWith({ siteModes: {}, disabledTypes: ['PHONE'] });
    act(() => c.querySelector<HTMLInputElement>('input[value="warn"]')?.click());
    expect(onChange).toHaveBeenLastCalledWith({
      siteModes: { chatgpt: 'warn' },
      disabledTypes: [],
    });
    act(() => c.querySelector<HTMLButtonElement>('footer button')?.click());
    expect(onReset).toHaveBeenCalled();
  });
});
