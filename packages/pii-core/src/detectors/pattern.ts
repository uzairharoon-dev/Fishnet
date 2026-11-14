import { CONTEXT_BOOST, hasContextBefore } from '../context';
import type { Detector, EntityType, Finding } from '../types';

export interface PatternSpec {
  id: string;
  type: EntityType;
  /** Each regex must use the g flag. */
  patterns: { regex: RegExp; score: number }[];
  /** Checksum or format check. Return a number to override the score. */
  validate?: (match: string) => boolean | number;
  /** Words that raise confidence when they appear shortly before a match. */
  contextWords?: string[];
  /** Return true to drop a match, e.g. an email inside a URL. */
  invalidate?: (match: string, text: string, start: number) => boolean;
}

export function createPatternDetector(spec: PatternSpec): Detector {
  for (const { regex } of spec.patterns) {
    if (!regex.global) throw new Error(`${spec.id}: pattern ${regex} needs the g flag`);
  }
  const contextWords = spec.contextWords ?? [];

  return {
    id: spec.id,
    types: [spec.type],
    detect(text) {
      const findings: Finding[] = [];
      for (const { regex, score } of spec.patterns) {
        for (const m of text.matchAll(regex)) {
          const value = m[0];
          const start = m.index;
          if (spec.invalidate?.(value, text, start)) continue;

          let confidence = score;
          if (spec.validate) {
            const result = spec.validate(value);
            if (result === false) continue;
            if (typeof result === 'number') confidence = result;
          }
          if (hasContextBefore(text, start, contextWords)) {
            confidence = Math.min(1, confidence + CONTEXT_BOOST);
          }

          findings.push({
            type: spec.type,
            start,
            end: start + value.length,
            value,
            confidence,
            detectorId: spec.id,
          });
        }
      }
      return findings;
    },
  };
}
