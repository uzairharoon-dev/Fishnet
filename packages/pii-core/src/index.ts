export { CONTEXT_BOOST, CONTEXT_WINDOW, hasContextBefore } from './context';
export { emailDetector } from './detectors/email';
export { ipv4Detector, ipv6Detector } from './detectors/ip';
export { createPatternDetector, type PatternSpec } from './detectors/pattern';
export { builtInDetectors, resolveOverlaps, type ScanOptions, scan, scanSync } from './scan';
export type { AsyncDetector, DetectContext, Detector, EntityType, Finding } from './types';
export { isValidIPv4, isValidIPv6 } from './validators/ip';
