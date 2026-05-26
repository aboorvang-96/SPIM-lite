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

// Conservative defaults so the UI never NaN's before the first refresh().
const DEFAULT_DETAILS: SalaryDetails = {
  baseMonthly:      0,
  otAllowance:      0,
  pfDeduction:      0,
  advanceDeduction: 0,
  totalWorkingDays: 30,
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
        totalWorkingDays: 30,
      };
      set({ details, payslips, loaded: true, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  getDailyRate: () => SalaryCalculationService.computeDailyRate(get().details),
  getAttendanceEarnings: (presentCount: number) =>
    SalaryCalculationService.computeAttendanceEarnings(get().details, presentCount),
  getNetPay: (presentCount: number) =>
    SalaryCalculationService.computeNetPay(get().details, presentCount),
}));
