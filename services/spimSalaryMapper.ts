import { SalaryDetails } from '../types';
import { SalaryRule } from './salaryCalculationService';

/**
 * SPIM Suite → SPIM Lite salary mapper (structure only).
 *
 * Defines the contract for converting the desktop ERP's salary master
 * payload into the local `SalaryDetails` / `SalaryRule` shape used by
 * the salary store and the salary calculation service.
 *
 * Do NOT add backend calls here.
 */

/** Raw salary master row expected from SPIM Suite. */
export interface SpimSuiteSalaryDTO {
  employee_id: string;
  role?: string;
  level?: string;
  base_monthly: number;
  ot_allowance: number;
  pf_amount: number;
  advance_deduction: number;
  total_working_days: number;
  effective_from?: string; // ISO date
}

export const SpimSalaryMapper = {
  /** Map a DTO to the canonical SalaryRule used by SalaryCalculationService. */
  toRule(dto: SpimSuiteSalaryDTO): SalaryRule {
    return {
      baseMonthly: Number(dto.base_monthly) || 0,
      otAllowance: Number(dto.ot_allowance) || 0,
      pfDeduction: Number(dto.pf_amount) || 0,
      advanceDeduction: Number(dto.advance_deduction) || 0,
      totalWorkingDays: Number(dto.total_working_days) || 0,
    };
  },

  /** Map a DTO to the local store-shaped SalaryDetails (alias of SalaryRule). */
  toLocal(dto: SpimSuiteSalaryDTO): SalaryDetails {
    return this.toRule(dto);
  },

  /** Convenience meta extractor for breakdown display. */
  toMeta(dto: SpimSuiteSalaryDTO): { role?: string; level?: string } {
    return { role: dto.role, level: dto.level };
  },
};
