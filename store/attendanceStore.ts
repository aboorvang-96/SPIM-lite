import { create } from 'zustand';
import { AttendanceRecord } from '../types';
import { format } from 'date-fns';
import {
  fetchAttendance,
  postAttendance,
  MobileAttendanceRecord,
} from '../services/api';

interface AttendanceState {
  records: Record<string, AttendanceRecord>; // Key is YYYY-MM-DD
  loading: boolean;
  loaded: boolean;
  /** Pull this employee's attendance from the SPIM Suite backend. */
  refresh: () => Promise<void>;
  /**
   * Mark attendance and persist to the backend. The backend upserts on
   * (employee, date) so this never creates a duplicate row, and SPIM Suite
   * payroll picks the value up immediately.
   */
  markAttendance: (date: string, status: AttendanceRecord['status']) => Promise<void>;
  getPresentCount: (startDate: string, endDate: string) => number;
}

// Map backend lower-snake-case status to the UI's title-case AttendanceRecord.
function fromBackend(r: MobileAttendanceRecord): AttendanceRecord {
  const map: Record<string, AttendanceRecord['status']> = {
    present:  'Present',
    absent:   'Absent',
    half_day: 'Half Day',
    leave:    'Leave',
  };
  return { date: r.date, status: map[r.status] ?? 'Absent' };
}

// Backend enum is {present, absent, half_day, leave}. 'Holiday',
// 'Week Off' and 'No Week Off' have no backend equivalent — persist
// them as 'leave' to preserve the API contract.
function toBackendStatus(s: AttendanceRecord['status']): 'present' | 'absent' | 'half_day' | 'leave' {
  if (s === 'Present')     return 'present';
  if (s === 'Leave')       return 'leave';
  if (s === 'Half Day')    return 'half_day';
  if (s === 'Holiday')     return 'leave';
  if (s === 'Week Off')    return 'leave';
  if (s === 'No Week Off') return 'leave';
  return 'absent';
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  records: {},
  loading: false,
  loaded: false,

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const list = await fetchAttendance();
      const recs: Record<string, AttendanceRecord> = {};
      for (const r of list) {
        recs[r.date] = fromBackend(r);
      }
      set({ records: recs, loading: false, loaded: true });
    } catch {
      set({ loading: false });
    }
  },

  markAttendance: async (date, status) => {
    try {
      const saved = await postAttendance(toBackendStatus(status), date);
      set((state) => ({
        records: {
          ...state.records,
          [date]: { ...fromBackend(saved), timeIn: format(new Date(), 'HH:mm') },
        },
      }));
    } catch {
      // Optimistic fallback so the UI still reflects the user's action even
      // if the network call fails (a subsequent refresh() reconciles state).
      set((state) => ({
        records: {
          ...state.records,
          [date]: { date, status, timeIn: format(new Date(), 'HH:mm') },
        },
      }));
    }
  },

  getPresentCount: (startDate, endDate) => {
    const { records } = get();
    let count = 0;
    Object.values(records).forEach(record => {
      if (record.date >= startDate && record.date <= endDate && record.status === 'Present') {
        count++;
      }
    });
    return count;
  },
}));
