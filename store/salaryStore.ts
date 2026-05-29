import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// ---------------------------------------------------------------------------
// Direct AsyncStorage persistence — same pattern as attendanceStore to avoid
// the zustand-persist rehydration race where a late rehydration event can
// overwrite fresh API data that arrived first.
// ---------------------------------------------------------------------------

const SALARY_KEY = '@spim-lite/salary-data/v1';

async function loadPersistedSalary(): Promise<{ details: SalaryDetails; payslips: MobilePayslip[] }> {
  try {
    const raw = await AsyncStorage.getItem(SALARY_KEY);
    if (!raw) return { details: { ...DEFAULT_DETAILS }, payslips: [] };
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        details:  parsed.details  ?? { ...DEFAULT_DETAILS },
        payslips: parsed.payslips ?? [],
      };
    }
    return { details: { ...DEFAULT_DETAILS }, payslips: [] };
  } catch {
    return { details: { ...DEFAULT_DETAILS }, payslips: [] };
  }
}

async function saveSalary(details: SalaryDetails, payslips: MobilePayslip[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SALARY_KEY, JSON.stringify({ details, payslips }));
  } catch {
    // best effort — UI already updated
  }
}

export const useSalaryStore = create<SalaryState>((set, get) => ({
  details:  { ...DEFAULT_DETAILS },
  payslips: [],
  loaded:   false,
  loading:  false,

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true });

    // Step 1: show persisted data immediately (avoids flash of zeros on cold start)
    if (get().details.baseMonthly === 0) {
      const stored = await loadPersistedSalary();
      if (stored.details.baseMonthly > 0 || stored.payslips.length > 0) {
        set({ details: stored.details, payslips: stored.payslips });
      }
    }

    // Step 2: fetch fresh data from API
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

      // Step 3: set new data into store
      set({ details, payslips, loaded: true, loading: false });

      // Step 4: persist the fresh data
      await saveSalary(details, payslips);
    } catch (err: any) {
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
