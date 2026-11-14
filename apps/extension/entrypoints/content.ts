import { scanSync } from '@fishnet/pii-core';

export default defineContentScript({
  matches: ['https://chatgpt.com/*'],
  main(ctx) {
    // D0 smoke test: log findings for pasted text. Real interception lands in D5.
    ctx.addEventListener(
      window,
      'paste',
      (e) => {
        const text = e.clipboardData?.getData('text/plain') ?? '';
        const findings = scanSync(text);
        if (findings.length > 0) console.log('[Fishnet] findings', findings);
      },
      { capture: true },
    );
  },
});
