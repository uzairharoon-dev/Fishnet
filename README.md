# Fishnet

Privacy-first Chrome extension that detects PII and secrets before you send them to AI tools, and redacts them reversibly. Everything runs locally; no data leaves the browser.

Status: early development. See [PLAN.md](PLAN.md).

## What it detects

| Kind | Types | How |
|---|---|---|
| Contact | Email, phone (PK default, international) | Regex; phones parsed with libphonenumber-js |
| Financial | Credit card, IBAN | Luhn + issuer prefix; mod-97 + country length |
| Identity | CNIC, passport | Format + province code; passport only next to a context word |
| Network | IPv4, IPv6 | Octet / group validation, version strings excluded |
| Secrets | AWS keys, GitHub tokens, JWT, private keys, `KEY=value` secrets | Prefix patterns, JWT header decode, value-only spans |

Names, organisations and places are not detected yet (planned in-browser NER, v3).

## Benchmark

`pnpm bench` scores the detectors against `bench/data` and fails if any type's F1 drops more than 2 points below `bench/baseline.json`.

Current results (v0 datasets: 150 synthetic + 39 hand-labelled prompts, 50 negatives):

| Metric | Value |
|---|---|
| Precision / recall (all supported types) | 100% / 100% |
| False alarms on negatives | 0 per 1,000 words |
| `scanSync` latency, 10 KB input | ~6 ms p50, ~8 ms p95 |

These numbers are optimistic. The same person wrote the detectors and the test data, and both datasets are small. Treat them as a regression guard, not a claim of real-world accuracy. A larger hand-labelled set written by someone else is the next step.

## Commands

```sh
pnpm install
pnpm dev          # opens Chrome with the extension loaded
pnpm test         # unit tests
pnpm bench        # accuracy benchmark (add --verbose to list misses)
pnpm bench:gen    # rebuild bench/data from the generator and handlabeled.src.txt
pnpm build        # build all packages
```

Detector patterns draw on ideas from [Microsoft Presidio](https://github.com/microsoft/presidio) and [gitleaks](https://github.com/gitleaks/gitleaks).
