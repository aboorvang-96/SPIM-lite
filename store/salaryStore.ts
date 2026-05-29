import { create } from 'zustand';
import { SalaryDetails } from '../types';
import { SalaryCalculationService } from '../services/salaryCalculationService';
import { fetchProfile, fetchPayslips, MobilePayslip } from '../services/api';

interface SalaryState {
  details: SalaryDetails;
  payslips: MobilePayslip[];
  loaded: boolean;
  loading: boolean;
  /** Pull base salary + latest payslip snapshot from SPIM Suite. */
  refresh: () => Promise<void>;
  getDailyRate: () => number;
  getNetPay: (presentCount: number) => number;
  getAttendanceEarnings: (presentCount: number) => number;
}

/**
 * Required paid days for a calendar month — MUST match the Suite rule in
 * employees/views.py::_compute_attendance_earnings (Step 3):
 *   - 30-day month       → 26
 *   - 28- or 29-day mo.  → 24
 *   - 31-day month (or other) → actual non-Sunday days
 * Mobile previously hardcoded 30, which under-paid every cycle by ~13%.
 */
function requiredPaidDaysForMonth(year: number, monthIdx: number): number {
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  if (lastDay === 30) return 26;
  if (lastDay === 28 || lastDay === 29) return 24;
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    if (new Date(year, monthIdx, d).getDay() !== 0) count++;
  }
  return count;
}

/**
 * Working-days denominator for the current 26th→25th payroll cycle. Mirrors
 * the Suite's per-month logic by anchoring on the cycle's END month (the
 * month in which the cycle pays out).
 */
function currentCycleRequiredPaidDays(): number {
  const today = new Date();
  let endYear  = today.getFullYear();
  let endMonth = today.getMonth();
  if (today.getDate() > 25) {
    endMonth += 1;
    if (endMonth > 11) { endMonth = 0; endYear += 1; }
  }
  return requiredPaidDaysForMonth(endYear, endMonth);
}

// Conservative defaults so the UI never NaN's before the first refresh().
const DEFAULT_DETAILS: SalaryDetails = {
  baseMonthly:      0,
  otAllowance:      0,
  pfDeduction:      0,
  advanceDeduction: 0,
  totalWorkingDays: currentCycleRequiredPaidDays(),
};

function num(v: string | null | undefined): number {
  const n = parseFloat(v ?? '0');
  return Number.isFinite(n) ? n : 0;
}

export const useSalaryStore = create<SalaryState>((set, get) => ({
  details:  { ...DEFAULT_DETAILS },
  payslips: [],
  loaded:   false,
  loading:  false,

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const [profileResp, payslips] = await Promise.all([
        fetchProfile(),
        fetchPayslips(),
      ]);
      const prof = profileResp.profile;
      const latest = prof?.latest_salary ?? null;

      const baseMonthly = num(latest?.basic_salary) || num(prof?.base_salary);
      const details: SalaryDetails = {
        baseMonthly,
        otAllowance:      num(latest?.ot_allowance),
        pfDeduction:      num(latest?.pf_employee),
        advanceDeduction: num(latest?.advance_pay),
        // Match the Suite's per-month required paid days (see helper above).
        totalWorkingDays: currentCycleRequiredPaidDays(),
      };
      set({ details, payslips, loaded: true, loading: false });
    } catch (err: any) {
      // Surface the underlying error so a silent fetchProfile / fetchPayslips
      // failure doesn't leave the dashboard quietly stuck on the all-zero
      // defaults (which look identical to "real" zero earnings).
      console.warn('[salaryStore.refresh] failed:', err?.message || err);
      set({ loading: false });
    }
  },

  getDailyRate: () => SalaryCalculationService.computeDailyRate(get().details),
  getAttendanceEarnings: (presentCount: number) =>
    SalaryCalculationService.computeAttendanceEarnings(get().details, presentCount),
  getNetPay: (presentCount: number) =>
    SalaryCalculationService.computeNetPay(get().details, presentCount),
}));
