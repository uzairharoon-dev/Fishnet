import { type Finding, type PlaceholderMap, scanSync } from '@fishnet/pii-core';
import type { SiteAdapter } from '../adapters/types';
import { replaceFindings } from '../editor/replace';
import type { Mode } from '../settings/mode';
import type { ReviewChoice } from '../ui/review';

export type SubmitAction = 'warned' | 'redacted' | 'sent-anyway' | 'cancelled' | 'failed';

export interface SubmitResult {
  action: SubmitAction;
  findings: Finding[];
}

export interface SubmitGuardOptions {
  adapter: SiteAdapter;
  getMode(): Mode;
  /** Placeholder map for the current conversation. */
  getMap(): PlaceholderMap;
  /** Asks the user what to do (block mode). */
  review(findings: Finding[]): Promise<ReviewChoice>;
  scan?(text: string): Finding[];
  /** Waits for the site to process edits before Fishnet presses send for it. */
  settle?(): Promise<void>;
  onResult?(result: SubmitResult): void;
}

/** Long enough for ProseMirror and React to sync state after an edit. */
const SETTLE_MS = 50;

/**
 * Checks a message when the user presses Enter or clicks send, before the
 * site sees either.
 *
 * Both listeners are on window in the capture phase. A clean message is never
 * delayed: the scan is synchronous and the event goes through untouched. When
 * Fishnet holds a message back, it presses send itself once the user decides,
 * and lets that one event through.
 */
export function installSubmitGuard(target: Window, opts: SubmitGuardOptions): () => void {
  const scan = opts.scan ?? ((text: string) => scanSync(text));
  const settle = opts.settle ?? (() => new Promise<void>((r) => setTimeout(r, SETTLE_MS)));
  // True while Fishnet itself presses send.
  let resending = false;
  // True while a review is open or a redaction is being applied.
  let busy = false;

  const stop = (e: Event) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  const resend = (editor: HTMLElement) => {
    resending = true;
    try {
      const button = opts.adapter.findSendButton();
      if (button && !(button as HTMLButtonElement).disabled) {
        button.click();
      } else {
        editor.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            bubbles: true,
            cancelable: true,
          }),
        );
      }
    } finally {
      resending = false;
    }
  };

  const redactAndSend = async (editor: HTMLElement, findings: Finding[]) => {
    replaceFindings(opts.adapter, editor, findings, opts.getMap());
    await settle();
    // Never send if anything is left, e.g. the editor rejected the edit.
    if (scan(opts.adapter.getText(editor).text).length > 0) {
      opts.onResult?.({ action: 'failed', findings });
      return;
    }
    resend(editor);
    opts.onResult?.({ action: 'redacted', findings });
  };

  const handle = async (e: Event, editor: HTMLElement) => {
    const mode = opts.getMode();
    if (mode === 'off') return;

    const findings = scan(opts.adapter.getText(editor).text);
    if (findings.length === 0) return;

    if (mode === 'warn') {
      opts.onResult?.({ action: 'warned', findings });
      return;
    }

    stop(e);
    busy = true;
    try {
      if (mode === 'redact') {
        await redactAndSend(editor, findings);
        return;
      }
      const choice = await opts.review(findings);
      if (choice === 'redact') {
        await redactAndSend(editor, findings);
      } else if (choice === 'send') {
        resend(editor);
        opts.onResult?.({ action: 'sent-anyway', findings });
      } else {
        editor.focus();
        opts.onResult?.({ action: 'cancelled', findings });
      }
    } finally {
      busy = false;
    }
  };

  /** Runs `handle` unless this event is Fishnet's own resend; swallows repeats while busy. */
  const guard = (e: Event, editor: HTMLElement) => {
    if (resending) return;
    if (busy) {
      stop(e);
      return;
    }
    void handle(e, editor);
  };

  const onKeyDown = (event: Event) => {
    const e = event as KeyboardEvent;
    if (!opts.adapter.isSubmitKey(e)) return;
    const editor = opts.adapter.findEditor();
    if (!editor || !(e.target instanceof Node) || !editor.contains(e.target)) return;
    guard(e, editor);
  };

  const onClick = (e: Event) => {
    const button = opts.adapter.findSendButton();
    if (!button || !(e.target instanceof Node) || !button.contains(e.target)) return;
    const editor = opts.adapter.findEditor();
    if (!editor) return;
    guard(e, editor);
  };

  target.addEventListener('keydown', onKeyDown, { capture: true });
  target.addEventListener('click', onClick, { capture: true });
  return () => {
    target.removeEventListener('keydown', onKeyDown, { capture: true });
    target.removeEventListener('click', onClick, { capture: true });
  };
}
