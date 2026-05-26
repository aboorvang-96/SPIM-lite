export interface CompanyInfo {
  name: string;
  logoUrl: string;
  address: string;
  phone: string;
  email: string;
  gstNumber: string;
  managingDirector: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  level: string;
  department: string;
  site: string;
  mobile: string;
  email: string;
  address: string;
  emergencyContact: string;
  bankDetails: string;
  pfNumber: string;
  joiningDate: string;
  // Task 2 additions — surfaced in the SPIM Lite Profile screen.
  branch?: string;
  location?: string;
  baseSalary?: string;
  foodAllowance?: string;
  otAllowance?: string;
  netPay?: string;
  // Company details for the logged-in employee's tenant (mirrors the
  // Suite's CompanySettings). Optional because legacy login payloads
  // don't carry it; the /api/mobile/profile/ refresh populates it.
  company?: CompanyInfo | null;
}

export interface AttendanceRecord {
  date: string; // YYYY-MM-DD
  // 'Holiday', 'Week Off' and 'No Week Off' are UI-only labels — backend
  // has no enum for them, so they round-trip as 'Leave' (see
  // store/attendanceStore.ts).
  status: 'Present' | 'Absent' | 'Leave' | 'Half Day' | 'Holiday' | 'Week Off' | 'No Week Off';
  timeIn?: string;
  timeOut?: string;
}

export interface SalaryDetails {
  baseMonthly: number;
  otAllowance: number;
  pfDeduction: number;
  advanceDeduction: number;
  totalWorkingDays: number;
}

/**
 * Simplified Machine model.
 *
 * Future: machine numbers will be fetched from the SPIM Suite Desktop App
 * (Projects Module → Machines List). Only `id` and `machineNo` are needed
 * on the mobile side; all TMP / assignment / attendance roll-ups are now
 * owned by the desktop ERP.
 */
export interface Machine {
  id: number | string;
  machineNo: string;
}

/**
 * Machine status is an open string — the four entries below seed the
 * dropdown, but employees can add their own (e.g. "Under Repair") via
 * the Add New Status modal. Custom statuses are persisted locally and
 * future-synced to SPIM Suite.
 */
export type MachineStatus = string;

export const DEFAULT_MACHINE_STATUSES: MachineStatus[] = [
  'Running',
  'Idle',
  'Maintenance',
  'Stopped',
];

/** @deprecated Use DEFAULT_MACHINE_STATUSES; kept as alias for back-compat. */
export const MACHINE_STATUSES: MachineStatus[] = DEFAULT_MACHINE_STATUSES;

/**
 * Simplified MachineLog model.
 *
 * Future: this payload will be POSTed to SPIM Suite Desktop API
 * (machine-logs endpoint). Keep the shape stable.
 */
export interface MachineLog {
  employeeId: string;
  machineNo: string;
  date: string; // YYYY-MM-DD
  status: MachineStatus;
  remarks: string;
}
