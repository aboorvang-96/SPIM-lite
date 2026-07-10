import { SalaryDetails } from '../types';

/**
 * Salary calculation service.
 *
 * Pure, side-effect-free arithmetic for net-pay breakdowns. The same
 * functions are reused by:
 *   - the salary store (existing API: getDailyRate / getAttendanceEarnings / getNetPay)
 *   - the dashboard salary card
 *   - the salary screen breakdown
 *   - future SPIM Suite-fed payroll previews
 *
 * Net Pay = Attendance Earnings + OT/Extra Allowance - PF Amount - Advance Deduction
 */

export interface SalaryRule {
  baseMonthly: number;
  otAllowance: number;
  pfDeduction: number;
  advanceDeduction: number;
  totalWorkingDays: number;
}

export interface SalaryCalculationResult {
  role?: string;
  level?: string;
  monthlySalary: number;
  dailyRate: number;
  attendanceEarnings: number;
  otAllowance: number;
  pfAmount: number;
  advanceDeduction: number;
  netPay: number;
  presentDays: number;
  totalWorkingDays: number;
}

const round = (n: number) => Math.round(n);

export const SalaryCalculationService = {
  /** Convert a salary rule to a per-day rate. */
  computeDailyRate(rule: SalaryRule): number {
    if (!rule.totalWorkingDays) return 0;
    return rule.baseMonthly / rule.totalWorkingDays;
  },

  /** Earnings credited from attendance only (no allowances / deductions). */
  computeAttendanceEarnings(rule: SalaryRule, presentCount: number): number {
    return round(presentCount * this.computeDailyRate(rule));
  },

  /** Net Pay = Attendance Earnings + OT - PF - Advance. */
  computeNetPay(rule: SalaryRule, presentCount: number): number {
    const earnings = this.computeAttendanceEarnings(rule, presentCount);
    return earnings + rule.otAllowance - rule.pfDeduction - rule.advanceDeduction;
  },

  /**
   * Full breakdown. DEAD helper — retained per Phase 10.2's "no cleanup"
   * rule. No screen calls it. The inline `?? 0` fallbacks below exist only
   * to keep this unused code type-checking against the now-optional
   * SalaryDetails; no user-facing number flows through this function.
   */
  computeBreakdown(
    rule: SalaryRule | SalaryDetails,
    presentCount: number,
    meta?: { role?: string; level?: string },
  ): SalaryCalculationResult {
    const coerced: SalaryRule = {
      baseMonthly:      rule.baseMonthly      ?? 0,
      otAllowance:      rule.otAllowance      ?? 0,
      pfDeduction:      rule.pfDeduction      ?? 0,
      advanceDeduction: rule.advanceDeduction ?? 0,
      totalWorkingDays: rule.totalWorkingDays ?? 0,
    };
    const dailyRate = this.computeDailyRate(coerced);
    const attendanceEarnings = this.computeAttendanceEarnings(coerced, presentCount);
    const netPay = this.computeNetPay(coerced, presentCount);
    return {
      role: meta?.role,
      level: meta?.level,
      monthlySalary: coerced.baseMonthly,
      dailyRate: round(dailyRate),
      attendanceEarnings,
      otAllowance: coerced.otAllowance,
      pfAmount: coerced.pfDeduction,
      advanceDeduction: coerced.advanceDeduction,
      netPay,
      presentDays: presentCount,
      totalWorkingDays: coerced.totalWorkingDays,
    };
  },
};
