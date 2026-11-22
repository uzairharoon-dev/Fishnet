import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModePicker } from './ModePicker';
import { act, render } from './render';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ModePicker', () => {
  it('shows the selected mode and its hint', () => {
    const { container } = render(
      <ModePicker label="Mode for ChatGPT" value="warn" onChange={() => {}} />,
    );
    expect(container.querySelector('fieldset')?.getAttribute('aria-label')).toBe(
      'Mode for ChatGPT',
    );
    expect(container.querySelector('label.selected')?.textContent).toBe('Warn');
    expect(container.querySelector('.hint')?.textContent).toBe(
      'Highlight findings, send as typed.',
    );
  });

  it('reports the picked mode', () => {
    const onChange = vi.fn();
    const { container } = render(<ModePicker label="Mode" value="redact" onChange={onChange} />);
    const block = container.querySelector<HTMLInputElement>('input[value="block"]');
    act(() => block?.click());
    expect(onChange).toHaveBeenCalledWith('block');
  });
});
