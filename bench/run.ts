/**
 * Scores pii-core against bench/data and prints precision / recall per type.
 *
 *   pnpm bench                    print report, fail if F1 dropped vs baseline.json
 *   pnpm bench --update-baseline  save current scores as the new baseline
 *   pnpm bench --verbose          also list every miss and false alarm
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  builtInDetectors,
  type EntityType,
  type Finding,
  scanSync,
} from '../packages/pii-core/src';
import { type GoldEntity, readJsonl, type Sample } from './lib';

const DIR = import.meta.dirname;
const BASELINE = join(DIR, 'baseline.json');
const MAX_F1_DROP = 0.02;
const VERBOSE = process.argv.includes('--verbose');

const supported = new Set<EntityType>(builtInDetectors.flatMap((d) => d.types));
const labelled = [
  ...readJsonl(join(DIR, 'data/synthetic.jsonl')),
  ...readJsonl(join(DIR, 'data/handlabeled.jsonl')),
];
const negatives = readJsonl(join(DIR, 'data/negatives.jsonl'));

type Mode = 'exact' | 'overlap';
interface Counts {
  tp: number;
  fp: number;
  fn: number;
}

/** Exact: same span. Overlap: shared characters cover at least half of the longer span. */
function matches(g: GoldEntity, f: Finding, mode: Mode): boolean {
  if (g.type !== f.type) return false;
  if (mode === 'exact') return g.start === f.start && g.end === f.end;
  const shared = Math.min(g.end, f.end) - Math.max(g.start, f.start);
  return shared > 0 && shared / Math.max(g.end - g.start, f.end - f.start) >= 0.5;
}

function score(samples: Sample[], mode: Mode, log = false): Map<EntityType, Counts> {
  const counts = new Map<EntityType, Counts>();
  const get = (t: EntityType) => {
    const c = counts.get(t) ?? { tp: 0, fp: 0, fn: 0 };
    counts.set(t, c);
    return c;
  };
  for (const s of samples) {
    const gold = s.entities.filter((g) => supported.has(g.type));
    const found = scanSync(s.text);
    const used = new Set<Finding>();
    for (const g of gold) {
      const hit = found.find((f) => !used.has(f) && matches(g, f, mode));
      if (hit) {
        used.add(hit);
        get(g.type).tp++;
      } else {
        get(g.type).fn++;
        if (log) console.log(`MISS ${s.id} ${g.type} "${s.text.slice(g.start, g.end)}"`);
      }
    }
    for (const f of found) {
      if (used.has(f)) continue;
      get(f.type).fp++;
      if (log) console.log(`FALSE ${s.id} ${f.type} "${f.value}"`);
    }
  }
  return counts;
}

function metrics({ tp, fp, fn }: Counts) {
  const p = tp + fp ? tp / (tp + fp) : 1;
  const r = tp + fn ? tp / (tp + fn) : 1;
  const fb = (b: number) => (p + r ? ((1 + b * b) * p * r) / (b * b * p + r) : 0);
  return { p, r, f1: fb(1), f2: fb(2) };
}

const sum = (cs: Iterable<Counts>): Counts =>
  [...cs].reduce((a, c) => ({ tp: a.tp + c.tp, fp: a.fp + c.fp, fn: a.fn + c.fn }), {
    tp: 0,
    fp: 0,
    fn: 0,
  });

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const lines: string[] = [];
const out = (s = '') => lines.push(s);

// Per-type table on all labelled data.
const overlap = score(labelled, 'overlap', VERBOSE);
const exact = score(labelled, 'exact');
out(`# Fishnet benchmark\n`);
out(
  `Labelled samples: ${labelled.length} (synthetic + hand-labelled). Negatives: ${negatives.length}.\n`,
);
out('| Type | Gold | Precision | Recall | F1 | F2 | Exact-span F1 |');
out('|---|---:|---:|---:|---:|---:|---:|');
const f1ByType: Record<string, number> = {};
for (const type of [...overlap.keys()].sort()) {
  const c = overlap.get(type) as Counts;
  const m = metrics(c);
  f1ByType[type] = m.f1;
  const ex = metrics(exact.get(type) ?? c);
  out(
    `| ${type} | ${c.tp + c.fn} | ${pct(m.p)} | ${pct(m.r)} | ${pct(m.f1)} | ${pct(m.f2)} | ${pct(ex.f1)} |`,
  );
}
const micro = metrics(sum(overlap.values()));
out(
  `| **All** | | **${pct(micro.p)}** | **${pct(micro.r)}** | **${pct(micro.f1)}** | **${pct(micro.f2)}** | |`,
);

// Per dataset, so the hand-labelled set is visible on its own.
out('\n| Dataset | Precision | Recall | F1 |');
out('|---|---:|---:|---:|');
for (const source of ['synthetic', 'handlabeled'] as const) {
  const m = metrics(
    sum(
      score(
        labelled.filter((s) => s.source === source),
        'overlap',
      ).values(),
    ),
  );
  out(`| ${source} | ${pct(m.p)} | ${pct(m.r)} | ${pct(m.f1)} |`);
}

// False alarms on text with nothing sensitive in it.
const words = negatives.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
const alarms = negatives.flatMap((s) => scanSync(s.text).map((f) => ({ id: s.id, f })));
out(
  `\nFalse alarms on negatives: ${alarms.length} (${((alarms.length / words) * 1000).toFixed(1)} per 1,000 words)`,
);
for (const { id, f } of alarms) out(`- ${id}: ${f.type} "${f.value}"`);

// Types labelled in the data that no detector handles yet.
const unsupported = new Map<string, number>();
for (const s of labelled) {
  for (const g of s.entities) {
    if (!supported.has(g.type)) unsupported.set(g.type, (unsupported.get(g.type) ?? 0) + 1);
  }
}
if (unsupported.size) {
  out(
    `\nNot scored yet (no detector, planned for v3): ${[...unsupported].map(([t, n]) => `${t} ${n}`).join(', ')}`,
  );
}

// Latency of scanSync on realistic text of growing size.
const corpus = labelled.map((s) => s.text).join('\n');
out('\n| Input | p50 | p95 |');
out('|---|---:|---:|');
for (const kb of [1, 10, 100]) {
  let text = corpus;
  while (text.length < kb * 1024) text += `\n${corpus}`;
  text = text.slice(0, kb * 1024);
  const runs = kb === 100 ? 20 : 100;
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    scanSync(text);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const at = (q: number) => (times[Math.floor(q * (times.length - 1))] ?? 0).toFixed(2);
  out(`| ${kb} KB | ${at(0.5)} ms | ${at(0.95)} ms |`);
}

const report = lines.join('\n');
console.log(report);
writeFileSync(join(DIR, 'report.md'), `${report}\n`);

// Baseline check.
if (process.argv.includes('--update-baseline')) {
  writeFileSync(BASELINE, `${JSON.stringify(f1ByType, null, 2)}\n`);
  console.log(`\nBaseline updated: ${BASELINE}`);
} else if (existsSync(BASELINE)) {
  const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, number>;
  const drops = Object.entries(base).filter(([t, f1]) => (f1ByType[t] ?? 0) < f1 - MAX_F1_DROP);
  if (drops.length) {
    for (const [t, f1] of drops) {
      console.error(`F1 for ${t} dropped from ${pct(f1)} to ${pct(f1ByType[t] ?? 0)}`);
    }
    process.exit(1);
  }
  console.log('\nNo F1 regression against baseline.');
}
