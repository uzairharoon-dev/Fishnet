import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// Tells React that tests wrap updates in act().
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Minimal test renderer: mounts into a fresh div and returns it. */
export function render(element: ReactElement): { container: HTMLElement; root: Root } {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, root };
}

export { act };
