export type EntityType =
  | 'EMAIL'
  | 'PHONE'
  | 'CREDIT_CARD'
  | 'IBAN'
  | 'CNIC'
  | 'PASSPORT'
  | 'IP_ADDRESS'
  | 'AWS_ACCESS_KEY'
  | 'AWS_SECRET_KEY'
  | 'GITHUB_TOKEN'
  | 'JWT'
  | 'PRIVATE_KEY'
  | 'SECRET_ASSIGNMENT'
  | 'PERSON'
  | 'ORG'
  | 'LOCATION'
  | 'CUSTOM';

export interface Finding {
  type: EntityType;
  /** UTF-16 offset, inclusive. */
  start: number;
  /** UTF-16 offset, exclusive. */
  end: number;
  /** Equal to text.slice(start, end). */
  value: string;
  /** 0..1 */
  confidence: number;
  detectorId: string;
  /** For CUSTOM findings: the dictionary entry name. */
  label?: string;
}

export interface DetectContext {
  locale?: string;
  /** ISO country code used to parse local phone numbers, e.g. 'PK'. */
  defaultRegion?: string;
}

export interface Detector {
  id: string;
  types: EntityType[];
  detect(text: string, ctx: DetectContext): Finding[];
}

export interface AsyncDetector {
  id: string;
  types: EntityType[];
  detect(text: string, ctx: DetectContext): Promise<Finding[]>;
}
