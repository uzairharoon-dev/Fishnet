# Fishnet plan

Privacy-first Chrome extension (Manifest V3) that catches PII and secrets before they are sent to AI tools. It redacts them reversibly: real values become placeholders such as `[EMAIL_1]`, and the extension restores them in the AI's reply. Nothing leaves the device.

## Stack

| Decision | Choice | Reason |
|---|---|---|
| Extension framework | WXT | MV3-first, file-based entrypoints, HMR, typed storage, Shadow DOM UI helpers |
| Monorepo | pnpm workspaces | `workspace:*` linking for `pii-core`; no Turborepo needed for 2–3 packages |
| Language | TypeScript strict | Detector types are the core contract |
| Popup / options | React | Familiar, bundle size irrelevant on extension pages |
| In-page UI | Vanilla TS in Shadow DOM | Small content script, isolated from host CSS |
| Highlighting | CSS Custom Highlight API | Paints ranges without touching editor DOM |
| Phone parsing | libphonenumber-js | Proper PK/international validation |
| Lint / format | Biome | One fast tool |
| Tests | Vitest (unit + bench), Playwright (e2e) | |
| Storage | `storage.local` settings, `storage.session` placeholder maps | Never `storage.sync`: it uploads to the Google account |

## Layout

```
packages/pii-core     detection engine, redact/restore (framework-free, npm-publishable)
packages/pii-ner      v3: Transformers.js NER wrapper
apps/extension        WXT extension (content script, background, popup, options, offscreen)
bench/                datasets (JSONL), generator, precision/recall runner
```

## Architecture

- Regex detection runs synchronously in the content script (<5 ms per 10 KB). Submit interception needs a synchronous block/allow decision inside keydown.
- Service worker holds no important state; MV3 kills it when idle. Placeholder maps live in `storage.session`.
- Settings: popup/options write `storage.local`; content scripts react via `storage.onChanged`.
- One site adapter per host (selectors with fallbacks, `data-testid`/`aria-label` first). Health check warns when an editor is not found.
- v3 NER runs in an offscreen document + Web Worker, never in the service worker. Model is bundled locally; remote models disabled.

## Hard problems

- **Paste:** `window` capture listener runs before the editor. Redact via `document.execCommand('insertText')`; works with ProseMirror, Quill, Gmail, React textareas and keeps undo. Fallback: synthetic paste event.
- **Submit:** capture Enter (not Shift+Enter, not during IME composition) and send-button clicks. Review modal: Redact & send / Send anyway / Edit. Replace findings in reverse offset order.
- **Text offsets:** TreeWalker over editor text nodes, virtual `\n` between blocks, offset to DOM `Range` mapping.
- **Restore (v2):** MutationObserver on conversation; mutate `textNode.data` in place (never wrap nodes React owns). Handle tokens split across streamed chunks; final pass when streaming stops.

## Roadmap

- **MVP:** ChatGPT, regex detectors (email, phone, card+Luhn, IBAN+mod-97, CNIC, passport, IP, AWS/GitHub/JWT/private key/env secrets), highlight + banner, paste and submit interception, warn/redact/block modes per site, settings, benchmark, CI.
- **v2:** reversible placeholders restored in replies; Claude, Gemini, Gmail adapters.
- **v3:** in-browser NER (names, orgs, locations), custom dictionaries, published accuracy benchmark.
- **v4:** file uploads (PDF/DOCX text extraction), org policy via `chrome.storage.managed`, optional counts-only dashboard.

## MVP checklist

- [x] **D0 Scaffold.** pnpm workspace, Biome, WXT React app, `pii-core` with email detector. `pnpm build` passes, first commit.
- [x] **D1 Core.** `context.ts`, IP detector, overlap tests. 15+ unit tests including overlap and email-inside-URL.
- [ ] **D2 Validated detectors.** Luhn, mod-97, CNIC, card, IBAN, phone (PK default), passport (context-gated). Positive, hard-negative and context tests per type.
- [ ] **D3 Secrets + bench v0.** AWS, GitHub, JWT (header decode check), private key, env assignments (value span only). ~150 labelled samples + 50 negatives; `pnpm bench` prints per-type P/R/F1.
- [ ] **D4 ChatGPT adapter.** Adapter registry, `text-index.ts`. Correct offsets for multi-paragraph and code-block input.
- [ ] **D5 Paste interception.** Redact mode turns pasted email + CNIC into `[EMAIL_1] … [CNIC_1]`; send works; Ctrl+Z works; no double insert.
- [ ] **D6 Highlights + banner.** Live highlights in warn mode, Shadow DOM banner with finding chips and Redact buttons.
- [ ] **D7 Submit interception.** Three modes behave; Shift+Enter still newline; clean messages send instantly.
- [ ] **D8 Settings + UI.** Options page (per-site mode, detector toggles), popup (site toggle, counts, adapter health), badge. Changes apply without reload.
- [ ] **D9 e2e + CI.** Playwright with `--load-extension`, local ProseMirror fixture served at chatgpt.com via `page.route`. CI runs lint, typecheck, unit, bench (fail on F1 drop >2 pts), e2e.
- [ ] **D10 Ship v0.1.0.** README (GIF, diagram, benchmark table, honest limits), PRIVACY.md, minimal permissions, tag.

## Benchmark

- `bench/data/synthetic.jsonl` (generated), `handlabeled.jsonl` (realistic prompts, never tuned on), `negatives.jsonl` (UUIDs, SHAs, timestamps, non-Luhn numbers).
- Sample: `{"id","text","entities":[{"type","start","end"}],"source","tags"}`.
- Metrics per type: precision, recall, F1, F2 (exact and ≥50% overlap), false alarms per 1,000 words, `scanSync` latency p50/p95, `restore(redact(x)) === x` property test.

## Honest limits

- Safety net, not DLP. Cannot catch everything.
- Site DOM changes break adapters (biggest maintenance cost).
- Not covered: drag-and-drop, file uploads (until v4), images of text, desktop/mobile apps.
- Regex misses free-form secrets and names; NER is weak on South Asian / Roman Urdu names.
- Placeholders can lower answer quality; AI may alter tokens.
- Placeholder maps hold real values in session memory.
