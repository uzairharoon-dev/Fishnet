import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Highlighter } from './highlights';

// jsdom has no CSS Highlight API.
class FakeHighlight {
  ranges: Range[];
  constructor(...ranges: Range[]) {
    this.ranges = ranges;
  }
}
let registry: Map<string, FakeHighlight>;

function range(text: string): Range {
  const p = document.createElement('p');
  p.textContent = text;
  document.body.append(p);
  const r = document.createRange();
  r.selectNodeContents(p);
  return r;
}

beforeEach(() => {
  registry = new Map();
  vi.stubGlobal('Highlight', FakeHighlight);
  vi.stubGlobal('CSS', { highlights: registry });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('Highlighter', () => {
  it('injects the highlight stylesheet once', () => {
    new Highlighter();
    new Highlighter();
    expect(document.querySelectorAll('#fishnet-highlight-style')).toHaveLength(1);
  });

  it('groups ranges by severity', () => {
    const h = new Highlighter();
    h.show([
      { range: range('key'), severity: 'high' },
      { range: range('card'), severity: 'high' },
      { range: range('mail'), severity: 'medium' },
    ]);
    expect(registry.get('fishnet-high')?.ranges).toHaveLength(2);
    expect(registry.get('fishnet-medium')?.ranges).toHaveLength(1);
  });

  it('removes a severity when it has no ranges', () => {
    const h = new Highlighter();
    h.show([{ range: range('mail'), severity: 'medium' }]);
    h.show([]);
    expect(registry.size).toBe(0);
  });

  it('flashes a range and clears it after a moment', () => {
    vi.useFakeTimers();
    const h = new Highlighter();
    h.flash(range('mail'));
    expect(registry.has('fishnet-flash')).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(registry.has('fishnet-flash')).toBe(false);
  });

  it('cleans up on destroy', () => {
    const h = new Highlighter();
    h.show([{ range: range('key'), severity: 'high' }]);
    h.destroy();
    expect(registry.size).toBe(0);
    expect(document.getElementById('fishnet-highlight-style')).toBeNull();
  });

  it('does nothing when the browser lacks the API', () => {
    vi.stubGlobal('CSS', {});
    const h = new Highlighter();
    expect(() => h.show([{ range: range('x'), severity: 'high' }])).not.toThrow();
    expect(document.getElementById('fishnet-highlight-style')).toBeNull();
  });
});
