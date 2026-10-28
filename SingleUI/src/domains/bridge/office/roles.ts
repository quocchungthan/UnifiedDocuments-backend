import type { OfficeRole } from './types';
export const OFFICE_ROLES: readonly OfficeRole[] = [
  'coordinator',
  'researcher',
  'coder',
  'reviewer',
  'functional-reviewer',
  'hr',
  'scrum-master',
  'product-owner',
];
export const officeRole = (agent?: string): OfficeRole =>
  OFFICE_ROLES.includes(agent as OfficeRole) ? (agent as OfficeRole) : 'unknown';
