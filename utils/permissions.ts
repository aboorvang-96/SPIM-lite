import { Employee } from '../types';

/**
 * Machine Log visibility gate.
 *
 * Hide the machine-log content (but keep the navigation entry) when the
 * logged-in employee's role OR level contains 'admin', 'hr', or 'accounts'
 * (case-insensitive, whitespace-trimmed). Matching is substring-based so
 * compound values like "Senior Accounts" or "Admin Level 2" are also blocked.
 */
const RESTRICTED_KEYWORDS = ['admin', 'hr', 'accounts'] as const;

export function isMachineLogRestricted(employee: Employee | null | undefined): boolean {
  if (!employee) return false;
  // Check role + level (primary fields per spec) AND department as a
  // fallback for the brief window between login and profile-refresh when
  // `level` may still be empty but `department` already carries the
  // organisational unit (e.g. "HR", "Accounts").
  const fields = [employee.role, employee.level, employee.department]
    .map(v => (v || '').trim().toLowerCase());
  return fields.some(field => RESTRICTED_KEYWORDS.some(k => field.includes(k)));
}
