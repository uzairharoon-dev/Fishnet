import { describe, expect, it } from 'vitest';
import {
  type AsyncDetector,
  builtInDetectors,
  type Finding,
  resolveOverlaps,
  scan,
  scanSync,
} from '../src';

const finding = (start: number, end: number, confidence: number, type = 'CUSTOM'): Finding =>
  ({ type, start, end, value: '', confidence, detectorId: 't' }) as Finding;

describe('resolveOverlaps', () => {
  it('keeps the higher-confidence finding', () => {
    expect(resolveOverlaps([finding(0, 10, 0.6), finding(5, 8, 0.9)])).toEqual([
      finding(5, 8, 0.9),
    ]);
  });

  it('prefers the longer span on equal confidence', () => {
    expect(resolveOverlaps([finding(2, 4, 0.8), finding(0, 10, 0.8)])).toEqual([
      finding(0, 10, 0.8),
    ]);
  });

  it('keeps adjacent findings and sorts by start', () => {
    expect(resolveOverlaps([finding(5, 9, 0.5), finding(0, 5, 0.9)]).map((f) => f.start)).toEqual([
      0, 5,
    ]);
  });
});

describe('scanSync', () => {
  const text = 'mail ahmed@acme.pk from 10.0.0.1';

  it('runs all built-in detectors in order', () => {
    expect(scanSync(text).map((f) => f.type)).toEqual(['EMAIL', 'IP_ADDRESS']);
  });

  it('filters by enabledTypes', () => {
    expect(scanSync(text, { enabledTypes: ['EMAIL'] }).map((f) => f.type)).toEqual(['EMAIL']);
  });

  it('filters by minConfidence', () => {
    expect(scanSync(text, { minConfidence: 0.9 }).map((f) => f.type)).toEqual(['EMAIL']);
  });

  it('stops scanning at maxLength', () => {
    expect(scanSync(text, { maxLength: 10 })).toEqual([]);
  });

  it('reports an email in a URL query but not URL userinfo', () => {
    const found = scanSync('https://x.io/?to=ahmed@acme.pk and ftp://bob@files.acme.pk');
    expect(found.map((f) => f.value)).toEqual(['ahmed@acme.pk']);
  });
});

describe('scan', () => {
  it('merges async detector results', async () => {
    const fake: AsyncDetector = {
      id: 'fake-ner',
      types: ['PERSON'],
      detect: async () => [
        { type: 'PERSON', start: 0, end: 4, value: 'mail', confidence: 0.7, detectorId: 'fake' },
      ],
    };
    const found = await scan('mail ahmed@acme.pk', { detectors: [fake, ...builtInDetectors] });
    expect(found.map((f) => f.type)).toEqual(['PERSON', 'EMAIL']);
  });
});
