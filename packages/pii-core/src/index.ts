export { emailDetector } from './detectors/email';
export { createPatternDetector, type PatternSpec } from './detectors/pattern';
export { builtInDetectors, resolveOverlaps, type ScanOptions, scan, scanSync } from './scan';
export type { AsyncDetector, DetectContext, Detector, EntityType, Finding } from './types';
