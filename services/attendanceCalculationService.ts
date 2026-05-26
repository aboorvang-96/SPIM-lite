import { AttendanceRecord } from '../types';

/**
 * Attendance calculation service.
 *
 * This is the single, integration-ready entry point for any
 * attendance-derived figure (present count, working days,
 * cycle bounds). The existing zustand store still owns the raw
 * records; this service operates on plain inputs so the same
 * pure functions can later be reused with data coming from the
 * SPIM Suite backend without any UI changes.
 *
 * The flow this enables:
 *   employee marks attendance
 *     -> store updates
 *     -> AttendanceCalculationService.computeMonthlyAttendance(...)
 *     -> SalaryCalculationService.computeNetPay(...)
 *     -> dashboard / salary / machine log surfaces refresh
 */

/**
 * A rule describing how a single attendance status maps to a worked-day count.
 * `weight` is a fraction: 1 = full day, 0.5 = half day, 0 = no credit.
 *
 * Future: SPIM Suite project settings will publish these rules per role/site.
 */
export interface AttendanceRule {
  status: AttendanceRecord['status'];
  weight: number;
  countsAsPresent: boolean;
}

export const DEFAULT_ATTENDANCE_RULES: AttendanceRule[] = [
  { status: 'Present', weight: 1,   countsAsPresent: true  },
  { status: 'Leave',   weight: 0.5, countsAsPresent: false },
  { status: 'Absent',  weight: 0,   countsAsPresent: false },
];

export interface MonthlyAttendanceResult {
  /** Number of records counted as Present in the window. */
  presentCount: number;
  /** Sum of weighted attendance (e.g. 22 Present + 2 Leave = 23). */
  weightedDays: number;
  /** Records considered in the window. */
  totalConsidered: number;
}

export const AttendanceCalculationService = {
  /**
   * Aggregate attendance records over a [startDate, endDate] window
   * (inclusive, both YYYY-MM-DD strings).
   */
  computeMonthlyAttendance(
    records: Record<string, AttendanceRecord>,
    startDate: string,
    endDate: string,
    rules: AttendanceRule[] = DEFAULT_ATTENDANCE_RULES,
  ): MonthlyAttendanceResult {
    let presentCount = 0;
    let weightedDays = 0;
    let totalConsidered = 0;

    for (const rec of Object.values(records)) {
      if (rec.date < startDate || rec.date > endDate) continue;
      totalConsidered += 1;
      const rule = rules.find(r => r.status === rec.status);
      if (!rule) continue;
      if (rule.countsAsPresent) presentCount += 1;
      weightedDays += rule.weight;
    }

    return { presentCount, weightedDays, totalConsidered };
  },

  /**
   * Compute the 26th-to-25th payroll cycle that contains `today`.
   * Returns ISO date strings.
   */
  computePayrollCycle(today: Date = new Date()): { startISO: string; endISO: string } {
    const d = today.getDate();
    let startMonth = today.getMonth();
    let startYear = today.getFullYear();
    if (d <= 25) {
      startMonth -= 1;
      if (startMonth < 0) { startMonth = 11; startYear -= 1; }
    }
    const start = new Date(startYear, startMonth, 26);

    let endMonth = startMonth + 1;
    let endYear = startYear;
    if (endMonth > 11) { endMonth = 0; endYear += 1; }
    const end = new Date(endYear, endMonth, 25);

    const iso = (dt: Date) =>
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

    return { startISO: iso(start), endISO: iso(end) };
  },
};
