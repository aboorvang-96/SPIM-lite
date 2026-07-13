import { Employee } from '../types';

/**
 * Machine module visibility gate.
 *
 * The Machine tab (route + drawer + deep link) is hidden entirely for
 * management roles — admin, HR, manager, accounts/accountant. Everyone
 * else (regular employees) still sees the tab, but the screen renders
 * VIEW-ONLY: no save / edit / delete controls, no writable inputs.
 *
 * Matching is substring-based on the role / level / department fields
 * so compound values like "Senior Accountant", "HR Manager", or "Admin
 * Level 2" are also blocked.
 */
const RESTRICTED_KEYWORDS = ['admin', 'hr', 'manager', 'accounts', 'accountant'] as const;

export function isMachineLogRestricted(employee: Employee | null | undefined): boolean {
  if (!employee) return false;
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
