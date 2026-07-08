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

/**
 * HR gate for the SPIM Lite More → HR Panel entry and every /hr/* route.
 *
 * Independent of isMachineLogRestricted() by design — the two features
 * must not share code so a future change to one cannot silently alter
 * the other. Detection mirrors the same substring pattern: scan the
 * same fields (role / level / department) for the 'hr' keyword only.
 *
 * `employee.role` is populated from the SPIM Suite profile's
 * `designation` (see store/employeeStore.ts), so labels like
 * "HR Manager" or "HR Executive" are covered without needing a
 * separate designation field on the Employee type.
 */
export function isHrUser(employee: Employee | null | undefined): boolean {
  if (!employee) return false;
  const fields = [employee.role, employee.level, employee.department]
    .map(v => (v || '').trim().toLowerCase());
  return fields.some(field => field.includes('hr'));
}
