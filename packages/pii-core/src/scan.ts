import { emailDetector } from './detectors/email';
import { ipv4Detector, ipv6Detector } from './detectors/ip';
import type { AsyncDetector, DetectContext, Detector, EntityType, Finding } from './types';

export const builtInDetectors: Detector[] = [emailDetector, ipv4Detector, ipv6Detector];

export interface ScanOptions {
  detectors?: (Detector | AsyncDetector)[];
  enabledTypes?: EntityType[];
  /** Findings below this confidence are dropped. Default 0.5. */
  minConfidence?: number;
  /** Text beyond this length is not scanned. Guards against slow regexes. Default 100_000. */
  maxLength?: number;
  context?: DetectContext;
}

const DEFAULT_MIN_CONFIDENCE = 0.5;
const DEFAULT_MAX_LENGTH = 100_000;

/** Higher confidence wins; ties go to the longer span. */
export function resolveOverlaps(findings: Finding[]): Finding[] {
  const ranked = [...findings].sort(
    (a, b) =>
      b.confidence - a.confidence || b.end - b.start - (a.end - a.start) || a.start - b.start,
  );
  const kept: Finding[] = [];
  for (const f of ranked) {
    if (!kept.some((k) => f.start < k.end && k.start < f.end)) kept.push(f);
  }
  return kept.sort((a, b) => a.start - b.start);
}

function filter(findings: Finding[], opts: ScanOptions): Finding[] {
  const min = opts.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const enabled = opts.enabledTypes && new Set(opts.enabledTypes);
  return resolveOverlaps(
    findings.filter((f) => f.confidence >= min && (!enabled || enabled.has(f.type))),
  );
}

/** Runs only synchronous detectors. Safe to call inside a keydown handler. */
export function scanSync(text: string, opts: ScanOptions = {}): Finding[] {
  const input = text.slice(0, opts.maxLength ?? DEFAULT_MAX_LENGTH);
  const ctx = opts.context ?? {};
  const findings: Finding[] = [];
  for (const d of opts.detectors ?? builtInDetectors) {
    const result = d.detect(input, ctx);
    if (Array.isArray(result)) findings.push(...result);
  }
  return filter(findings, opts);
}

/** Runs synchronous and asynchronous detectors (e.g. NER). */
export async function scan(text: string, opts: ScanOptions = {}): Promise<Finding[]> {
  const input = text.slice(0, opts.maxLength ?? DEFAULT_MAX_LENGTH);
  const ctx = opts.context ?? {};
  const results = await Promise.all(
    (opts.detectors ?? builtInDetectors).map((d) => d.detect(input, ctx)),
  );
  return filter(results.flat(), opts);
}
