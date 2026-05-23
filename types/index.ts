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
}

export interface AttendanceRecord {
  date: string; // YYYY-MM-DD
  status: 'Present' | 'Absent' | 'Leave';
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

export interface Machine {
  id: string;
  machineNumber: string;
  location: string;
  assignedEmployees: string[];
  tmpCount: number;
  attendanceCount: number;
}

export interface MachineLog {
  id: string;
  employeeId: string;
  employeeName: string;
  machineNumber: string;
  date: string;
  time: string;
  location: string;
}
