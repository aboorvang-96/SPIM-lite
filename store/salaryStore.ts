import { create } from 'zustand';
import { SalaryDetails } from '../types';

interface SalaryState {
  details: SalaryDetails;
  getDailyRate: () => number;
  getNetPay: (presentCount: number) => number;
  getAttendanceEarnings: (presentCount: number) => number;
}

export const useSalaryStore = create<SalaryState>((set, get) => ({
  details: {
    baseMonthly: 30000,
    otAllowance: 1500,
    pfDeduction: 1800,
    advanceDeduction: 0,
    totalWorkingDays: 30,
  },
  getDailyRate: () => {
    const { details } = get();
    if (!details.totalWorkingDays) return 0;
    return details.baseMonthly / details.totalWorkingDays;
  },
  getAttendanceEarnings: (presentCount: number) => {
    const { getDailyRate } = get();
    return Math.round(presentCount * getDailyRate());
  },
  getNetPay: (presentCount: number) => {
    const { details, getAttendanceEarnings } = get();
    const earnings = getAttendanceEarnings(presentCount);
    return earnings + details.otAllowance - details.pfDeduction - details.advanceDeduction;
  }
}));
