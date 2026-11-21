import type { EntityType } from '@fishnet/pii-core';

export type Severity = 'high' | 'medium';

/** High: secrets and IDs that are dangerous on their own. Medium: contact details. */
export const SEVERITY: Record<EntityType, Severity> = {
  PRIVATE_KEY: 'high',
  AWS_ACCESS_KEY: 'high',
  AWS_SECRET_KEY: 'high',
  GITHUB_TOKEN: 'high',
  JWT: 'high',
  SECRET_ASSIGNMENT: 'high',
  CREDIT_CARD: 'high',
  IBAN: 'high',
  CNIC: 'high',
  PASSPORT: 'high',
  EMAIL: 'medium',
  PHONE: 'medium',
  IP_ADDRESS: 'medium',
  PERSON: 'medium',
  ORG: 'medium',
  LOCATION: 'medium',
  CUSTOM: 'medium',
};

export const TYPE_LABELS: Record<EntityType, string> = {
  EMAIL: 'Email',
  PHONE: 'Phone',
  CREDIT_CARD: 'Card',
  IBAN: 'IBAN',
  CNIC: 'CNIC',
  PASSPORT: 'Passport',
  IP_ADDRESS: 'IP address',
  AWS_ACCESS_KEY: 'AWS key',
  AWS_SECRET_KEY: 'AWS secret',
  GITHUB_TOKEN: 'GitHub token',
  JWT: 'JWT',
  PRIVATE_KEY: 'Private key',
  SECRET_ASSIGNMENT: 'Secret',
  PERSON: 'Name',
  ORG: 'Organisation',
  LOCATION: 'Place',
  CUSTOM: 'Custom',
};

/**
 * Short preview that identifies a finding without showing it in full, so the
 * banner is safe to have on screen during a screen share.
 */
export function maskValue(type: EntityType, value: string): string {
  if (type === 'PRIVATE_KEY') return `${value.split('\n').length}-line key`;
  if (type === 'EMAIL') {
    const [local = '', domain = ''] = value.split('@');
    return `${local.slice(0, 2)}${'•'.repeat(Math.min(4, Math.max(1, local.length - 2)))}@${domain}`;
  }
  const compact = value.replace(/\s+/g, ' ');
  if (compact.length <= 6)
    return `${compact[0] ?? ''}${'•'.repeat(Math.max(1, compact.length - 1))}`;
  return `${compact.slice(0, 3)}••••${compact.slice(-3)}`;
}
